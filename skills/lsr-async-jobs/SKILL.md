---
name: lsr-async-jobs
description: Use for LSR RoadRunner jobs with TaskProducer, task dispatcher and payload contracts, serializers, DI task names, queue options, acknowledgement, retries, and async CQRS adapters.
---

# LSR Async Jobs

Use `lsr-roadrunner-runtime` for worker bootstrap, `.rr.yaml`, process lifecycle, and HTTP-worker isolation.

## Read the Installed Job Stack

- `vendor/lsr/roadrunner/src/Tasks/TaskProducer.php`
- `TaskDispatcherInterface.php`
- `TaskPayloadInterface.php`
- `Tasks/Serializers/*`
- `Workers/JobsWorker.php`
- `DI/RoadrunnerExtension.php`
- application task/payload classes, task DI definitions, and `.rr.yaml`

Do not assume a serializer, queue name, retry policy, or app-specific CQRS bridge. Read the DI and RoadRunner runtime configuration.

## Contracts

Payloads implement `Lsr\Roadrunner\Tasks\TaskPayloadInterface`.

Dispatchers implement:

```php
interface TaskDispatcherInterface
{
	public static function getDiName(): string;

	public function process(
		ReceivedTaskInterface $task,
		?TaskPayloadInterface $payload = null,
	): void;
}
```

`getDiName()` must be a stable, non-empty DI service name. Register the dispatcher under exactly that name because `JobsWorker` resolves incoming task names through `App::getService($name)`.

Keep task config in an included jobs NEON file:

```neon
services:
	application.rebuildIndexTask:
		create: App\Tasks\RebuildIndexTask
```

The static `getDiName()` for this dispatcher must return `application.rebuildIndexTask`.

## Payload Design

- Carry immutable scalar IDs, enums, timestamps, and small DTO data.
- Never carry closures, streams, PDO/dibi connections, file handles, DI services, or loaded ORM graphs.
- Prefer identifiers over serialized models; load fresh state inside `process()`.
- Treat payload schema as a versioned interface when queued jobs may survive a deployment.
- Verify the configured serializer supports every field. Current options include igbinary, JSON, and PHP serializers; none is universally configured.

## Producing Work

```php
$producer->push(RebuildIndexTask::class, $payload, $options);

$producer->plan(FirstTask::class, $firstPayload);
$producer->plan(SecondTask::class, $secondPayload);
$producer->dispatch();
```

`push()` sends immediately. `plan()` only accumulates prepared tasks in the producer; `dispatch()` sends and clears that batch. A successful push/dispatch proves enqueueing, not processing.

Use RoadRunner `OptionsInterface` for delay, priority, retry, or pipeline behavior only when the feature requires it and `.rr.yaml` supports it.

## Worker Behavior

Current `JobsWorker`:

1. clears `ModelRepository` instances;
2. resolves the dispatcher by task name;
3. deserializes a non-empty payload;
4. calls `process()`;
5. acknowledges if the dispatcher has not completed the task;
6. nacks and logs thrown failures.

A dispatcher may explicitly `ack`, `nack`, or requeue according to RoadRunner's task interface. Avoid acknowledging before the durable state transition succeeds. Make retryable handlers idempotent and distinguish permanent invalid payloads from transient infrastructure failures.

Guard the concrete payload type at the start of `process()`. Do not let a type mismatch become partial work.

## Async CQRS

`lsr/cqrs` only delegates `dispatchAsync()` to the configured `AsyncCommandBusInterface`. An application may implement that adapter using `TaskProducer`, but this bridge is not supplied automatically.

If commands are serialized as payloads, their interface must remain compatible with queued deployments. An ID-based job payload often gives a safer deployment seam.

## Verification

Run the actual jobs worker against a disposable queue and assert:

- correct DI dispatcher resolution;
- payload round trip through the configured serializer;
- successful state transition and acknowledgement;
- invalid payload behavior;
- exception/nack/retry behavior;
- duplicate delivery idempotency;
- isolation between sequential jobs.

Also run application static analysis and job tests.

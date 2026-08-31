---
name: lsr-async-jobs
description: Use for LSR app async work with RoadRunner jobs, TaskProducer, TaskDispatcherInterface, task payloads, and async CQRS command dispatch.
---

# Async Jobs Workflow

## Read First

- RoadRunner config: `config/di/extensions/roadrunner.neon`.
- RoadRunner runtime config: `.rr.yaml`.
- Task service registrations: `config/di/configs/jobs.neon`.
- Existing task: `src/Tasks/HandleCommandTask.php`.
- Existing payload: `src/Tasks/Payloads/HandleCommandPayload.php`.
- Async command bus: `src/CQRS/AsyncCommandBus.php`.
- Package APIs: `vendor/lsr/roadrunner/src/Tasks/TaskProducer.php`, `TaskDispatcherInterface.php`, `TaskPayloadInterface.php`.

## Existing Flow

- `Lsr\CQRS\CommandBus::dispatchAsync()` delegates to `App\CQRS\AsyncCommandBus`.
- `App\CQRS\AsyncCommandBus` pushes `HandleCommandTask::class` with `HandleCommandPayload`.
- `TaskProducer` uses `HandleCommandTask::getDiName()` as the RoadRunner job name.
- `config/di/configs/jobs.neon` maps that DI name to `App\Tasks\HandleCommandTask`.
- `.rr.yaml` consumes the `tasks` pipeline with memory queue driver and configures the jobs worker pool.
- `HandleCommandTask` validates the payload type and dispatches the contained command synchronously inside the worker.

## Adding a Task

- Put dispatchers under `src/Tasks`.
- Put payload DTOs under `src/Tasks/Payloads`.
- Payloads implement `Lsr\Roadrunner\Tasks\TaskPayloadInterface`.
- Dispatchers implement `Lsr\Roadrunner\Tasks\TaskDispatcherInterface`.
- `getDiName()` must return a non-empty DI service name.
- Register the task service in `config/di/configs/jobs.neon` using the same DI name.
- Inject required dependencies into the dispatcher constructor through DI.
- In `process()`, guard payload type first. Use `$task->nack('reason')` for invalid payloads.

## Dispatching

- Inject `Lsr\Roadrunner\Tasks\TaskProducer` to push or plan jobs directly.
- Use `$taskProducer->push(TaskClass::class, $payload)` for immediate dispatch.
- Use `plan(...)` and `dispatch()` when batching multiple prepared tasks.
- For command-shaped work, prefer `CommandBus::dispatchAsync($command)` so the existing CQRS bridge handles the job.
- Keep async command payloads as command objects for now. Do not switch to scalar-ID payloads unless the app changes that convention.
- Keep the default queue/runtime behavior unless a feature explicitly needs custom options such as delay, priority, or retries.

## Serialization

- The configured serializer is `Lsr\Roadrunner\Tasks\Serializers\IgBinaryTaskSerializer`.
- Keep payloads and commands serializable: avoid closures, open resources, PDO/Dibi connections, and service objects in payload properties.
- Pass IDs and scalar data; load models/services inside the task handler.

## Validation

```sh
composer phpstan
composer cs
```

Runtime verification requires RoadRunner jobs to be running; do not assume `push()` was processed just because it returned successfully.

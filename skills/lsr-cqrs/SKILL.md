---
name: lsr-cqrs
description: Use for LSR CQRS commands, handlers, query markers, DI registration, synchronous dispatch, and explicitly configured asynchronous command dispatch.
---

# LSR CQRS

## Read the Installed Contract

Read:

- `vendor/lsr/cqrs/src/CommandInterface.php`
- `CommandHandlerInterface.php`
- `CommandBus.php`
- `AsyncCommandBusInterface.php`
- `QueryInterface.php`
- `DI/CqrsExtension.php`
- the application's CQRS NEON files and handler discovery rules

Do not infer an application folder layout or async transport from the package. `lsr/cqrs` supplies contracts and a command bus; applications own organization, handler registration, query execution, and async adapters.

## DI Setup

```neon
extensions:
	cqrs: Lsr\CQRS\DI\CqrsExtension

cqrs:
	asyncBus: null
```

Every command handler must be a DI service. The package does not scan an application handler directory. Use the application's existing Nette search convention or explicit definitions.

Configure `asyncBus` with a service implementing `Lsr\CQRS\AsyncCommandBusInterface` only when an async transport exists:

```neon
cqrs:
	asyncBus: @application.asyncCommandBus
```

Without it, `CommandBus::dispatchAsync()` throws `RuntimeException`.

## Commands

```php
use Lsr\CQRS\CommandInterface;

/** @implements CommandInterface<Result> */
final readonly class RenameArticle implements CommandInterface
{
	public function __construct(
		public int $articleId,
		public string $title,
	) {}

	public function getHandler(): string
	{
		return RenameArticleHandler::class;
	}
}
```

- Commands are intent/data objects; keep them serializable if async dispatch is possible.
- `getHandler()` returns a non-empty handler class or DI service name.
- Class handlers are resolved by DI type; named handlers are resolved by service name.
- Use the generic `CommandInterface<TResult>` PHPDoc so dispatch results remain analyzable.
- Do not put open resources, closures, DB connections, or service instances in async commands.

## Handlers

- Implement `CommandHandlerInterface` and register the handler in DI.
- Guard/assert the concrete command type at the start of `handle()`.
- Inject dependencies through the constructor.
- Own transaction scope around one atomic command.
- Return the command's declared result type.
- Keep transport acknowledgement/retry behavior in the async adapter/task layer, not in a reusable handler.

## Dispatch

```php
$result = $commandBus->dispatch($command);
$commandBus->dispatchAsync($command);
```

Synchronous dispatch resolves a handler and returns `handle()`'s result. Async dispatch delegates to the configured adapter and returns `void`; enqueue success does not prove processing success.

## Queries

`Lsr\CQRS\QueryInterface` is currently a marker. The package does not provide a query bus or prescribe fluent query methods.

- Follow the application's established query style.
- Keep query modules side-effect free.
- Return typed DTOs/models/scalars rather than leaking `Dibi\Row` across a public module interface.
- Use DB/ORM cache tags or `cache: false` according to freshness requirements.
- Do not invent a query bus unless the application has a real dispatch seam that earns it.

## Verification

- Unit-test handler behavior through its command interface.
- Integration-test handler resolution through the real compiled container.
- Test missing/invalid handler failures when changing registration.
- For async adapters, run the actual worker and assert the command's state transition, failure, and retry/ack behavior.
- Run the application's static analysis and CQRS tests.

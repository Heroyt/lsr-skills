---
name: lsr-cqrs
description: Use for LSR app CQRS work with the lsr/cqrs package, including commands, command handlers, queries, DI discovery, and async command dispatch.
---

# CQRS Workflow

## Read First

- CQRS config: `config/di/extensions/cqrs.neon`.
- App CQRS namespace: `src/CQRS`.
- Async bus: `src/CQRS/AsyncCommandBus.php`.
- Async task bridge: `src/Tasks/HandleCommandTask.php`, `src/Tasks/Payloads/HandleCommandPayload.php`.
- Package APIs: `vendor/lsr/cqrs/src/CommandInterface.php`, `CommandHandlerInterface.php`, `CommandBus.php`, `QueryInterface.php`.
- Keep CQRS files grouped by technical layer: `Commands`, `CommandHandlers`, `CommandResponses`, and `Queries`.

## Commands

- Put command DTOs under `src/CQRS/Commands`.
- Commands implement `Lsr\CQRS\CommandInterface`.
- `getHandler()` must return either the handler class name or a DI service name.
- Keep commands as immutable intent/data objects where possible.
- Put command result DTOs under `src/CQRS/CommandResponses` when a command returns structured success/failure data.
- If a command returns a value, document it with the generic PHPDoc form used by `lsr/cqrs`: `@implements CommandInterface<ResultType>`.

Example shape:

```php
use Lsr\CQRS\CommandInterface;

/** @implements CommandInterface<void> */
readonly class DoSomethingCommand implements CommandInterface
{
    public function __construct(public int $id) {}

    public function getHandler(): string
    {
        return DoSomethingHandler::class;
    }
}
```

## Command Handlers

- Put handlers under `src/CQRS/CommandHandlers`.
- Handlers implement `Lsr\CQRS\CommandHandlerInterface`.
- The DI search extension auto-registers handlers from `src/CQRS/CommandHandlers` when they implement the interface.
- In `handle(CommandInterface $command): mixed`, assert or guard the concrete command type before using it.
- Inject dependencies through the constructor; avoid service locator calls in handlers unless the package API requires it.

## Dispatch

- Inject `Lsr\CQRS\CommandBus` where synchronous or async dispatch is needed.
- Use `$commandBus->dispatch($command)` for in-process handling.
- Use `$commandBus->dispatchAsync($command)` when the work should be pushed to RoadRunner jobs through `App\CQRS\AsyncCommandBus`.
- Async commands must be serializable by the configured RoadRunner task serializer.

## Queries

- Put query objects/services under `src/CQRS/Queries`.
- The current config auto-registers classes from `src/CQRS/Queries` that implement `Lsr\CQRS\QueryInterface`.
- Queries are simple query services. Do not introduce a query bus unless explicitly requested.
- Implement `Lsr\CQRS\QueryInterface` on concrete query services.
- Build the fluent DB/model query in the constructor or named filter methods.
- Use chainable filter/paging/sorting methods that return `self`/`static`.
- Expose execution through explicit terminal methods such as `get()`, `first()`, or `count()`.
- Keep read models side-effect free.
- Include a `noCache()` or equivalent switch when a query normally uses cached DB fetches but callers may need fresh reads.

## Validation

```sh
composer phpstan
composer cs
```

---
name: lsr-scheduler
description: Use for lsr/scheduler DI setup, SchedulerJobInterface services, cron/periodic triggers, scheduled console commands, state and locking, RoadRunner supervision, idempotency, and scheduler verification.
---

# LSR Scheduler

## Read the Installed Package

- `vendor/lsr/scheduler/README.md`
- `src/Di/SchedulerExtension.php`
- `SchedulerJobInterface.php` and `SchedulerJobContext.php`
- `Commands/SchedulerRunCommand.php`
- application scheduler NEON and process supervisor config

`lsr/scheduler` integrates standalone Symfony Scheduler. It does not require Messenger, and its supported attribute/transport surface is intentionally narrower than the full Symfony component.

## DI Setup

Keep scheduler configuration in a focused NEON file included by the shared DI root:

```neon
extensions:
	scheduler: Lsr\Scheduler\Di\SchedulerExtension

services:
	- App\Tasks\DeleteExpiredSessionsJob

scheduler:
	sleep: 1000000
	processOnlyLastMissedRun: true
	jobs:
		delete-expired-sessions:
			cron: '0 * * * *'
			timezone: Europe/Prague
			task: @App\Tasks\DeleteExpiredSessionsJob
```

Each configured job must select exactly one trigger: `cron` or `every`. Current options also include `from`, `until`, state, lock, and clock services. Read the installed schema for exact types.

## Job Contract

```php
final readonly class DeleteExpiredSessionsJob implements SchedulerJobInterface
{
	public function run(SchedulerJobContext $context): void
	{
		// bounded, observable, idempotent orchestration
	}
}
```

- Register jobs as DI services.
- Keep `run()` orchestration-thin and put reusable behavior in injected application modules.
- Make work idempotent because missed-run recovery, restarts, or operator retries can repeat it.
- Dispatch long/retryable work to RoadRunner jobs; do not block the scheduler loop unnecessarily.
- Never retain per-run mutable state on a singleton job between invocations.

## Periodic Jobs

Use `every` for intervals:

```neon
scheduler:
	jobs:
		refresh-stats:
			every: '30 seconds'
			from: now
			until: '3000-01-01'
			task: @App\Tasks\RefreshStatsJob
```

Choose cron for wall-clock schedules and `every` for intervals. Always set timezone intentionally for human schedules.

## Scheduled Console Commands

DI-registered Symfony Console commands may use repeatable `AsCronTask` and `AsPeriodicTask` attributes:

```php
#[AsCommand(name: 'sessions:delete-expired')]
#[AsCronTask('0 * * * *', timezone: 'Europe/Prague')]
final class DeleteExpiredSessionsCommand extends Command
{
}
```

Arguments may use ArrayInput-style arrays or command-line strings as supported by the installed integration. Scheduled commands run non-interactively. A non-zero exit code fails the scheduler run; preserve it so supervision can observe failures.

The standalone integration does not automatically support every Symfony Scheduler feature. Check the installed README before using Messenger transports, method-based attributes, or non-default schedules.

## State and Locking

For restart recovery and single execution across replicas, configure shared implementations:

```neon
scheduler:
	state: @scheduler.cache
	lock: @scheduler.lock
```

- state implements `Symfony\Contracts\Cache\CacheInterface`;
- lock implements `Symfony\Component\Lock\LockInterface`;
- multi-replica deployments require shared backing storage;
- local filesystem/in-memory state does not coordinate containers.

Locking reduces concurrent execution; it does not remove the need for idempotency or DB-level invariants.

## Process Supervision

Run one supervised scheduler process per intended scheduling cluster:

```sh
php bin/console scheduler:run
```

When RoadRunner supervises it, configure it as a service with one process and restart policy. Do not launch it inside every HTTP worker.

## Verification

- Force container compilation and confirm `scheduler:run` is registered.
- Use a test clock or deliberately short disposable interval for deterministic verification.
- Assert job invocation, context, timezone, missed-run policy, and failure visibility.
- Test lock contention with the actual shared lock backend when running replicas.
- Send termination and confirm graceful command shutdown.
- Run scheduler tests, static analysis, and a real supervised smoke run.

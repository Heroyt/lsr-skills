---
name: lsr-logging
description: Use for lsr/logging DI setup, PSR-3 logging, structured context, exception and DB-event logging, file/storage/formatter choices, sensitive-data safety, RoadRunner lifetime, and operational verification.
---

# LSR Logging

## Read the Installed Logging Stack

- `vendor/lsr/logging/services.neon`
- `src/Logger.php`, `ContextExtractor.php`, and `LogLevel.php`
- `src/Storage/*`, `Formatter/*`, `ContextSerializer/*`, and their interfaces when used
- application logging/Tracy/RoadRunner configuration
- deployment log collection and rotation

Do not assume file paths, retention, JSON formatting, or centralized collection from the package name alone.

## DI Setup

The package's current service file expects application constants/parameters and defines a logger, filesystem helper, and archiver. Include or reproduce it according to the application's config conventions:

```neon
parameters:
	logger:
		dir: %constants.appDir%logs
		name: app
		logLife: '-2 days'
```

Keep logging config in a focused included NEON file. Ensure the runtime user can create/write the directory without broad `0777` deployment permissions.

Prefer injecting `Psr\Log\LoggerInterface` or the narrow concrete capability needed. Use `Lsr\Logging\Logger` only when calling package-specific methods such as `exception()` or `logDb()`.

## Logging Interface

Use PSR-3 levels according to operator action:

- debug: diagnostic detail disabled/filtered in normal production collection;
- info: expected lifecycle/business milestones worth retaining;
- notice/warning: degraded or unexpected conditions that may need attention;
- error/critical/alert/emergency: failed work or service-impacting conditions.

Do not log every method entry or successful query. Prefer one event at the owning interface with enough structured context to correlate it.

```php
$logger->info('Result import completed', [
	'importId' => $importId,
	'system' => $system,
	'durationMs' => $durationMs,
]);
```

Use stable context keys. Include correlation/job/request IDs where the application has them.

## Sensitive Data

Never log:

- passwords or password hashes;
- session IDs/cookies;
- access/refresh tokens or authorization headers;
- full request bodies by default;
- database credentials;
- personal data not required for diagnosis.

Redact at the source, before data enters a generic context/exception serializer. Treat exception messages from external systems as potentially sensitive.

## Exceptions and Database Events

`Lsr\Logging\Logger::exception()` logs an error summary and a debug trace. Use it at the interface that owns failure reporting; do not repeatedly log and rethrow the same exception at every layer.

`logDb()` accepts dibi events and records failed SQL context. Ensure production collection does not expose secrets embedded in SQL. Parameterized queries reduce this risk but do not eliminate sensitive selected values in manually composed SQL.

Coordinate LSR logs, Tracy, RoadRunner stderr/log plugins, and centralized collection so one failure is observable without uncontrolled duplication.

## Long-Running Processes

The current basic `Logger` chooses its dated file name in the constructor. A logger instance that survives midnight may continue writing to the old file. For RoadRunner/scheduler deployments, explicitly verify the selected storage/rotation strategy across date boundaries; use the package storage modules or process recycling/collector rotation as appropriate rather than assuming constructor-based filenames rotate themselves.

Bound context size and avoid retaining throwable/object graphs in singleton state.

## Operational Design

- Container stdout/stderr collection is often preferable to writable in-container files; follow deployment conventions.
- If files are used, define ownership, retention, archiving, disk limits, and failure behavior.
- Structured JSON is useful only when the collector/parser expects it.
- Logging failures must not silently replace the original application failure; test unwritable/full storage behavior.
- Metrics measure rates/durations; logs explain individual events. Do not use high-cardinality logs as a metric substitute.

## Verification

- Emit representative PSR levels through the real application/runtime.
- Assert context formatting and redaction.
- Trigger one handled and one unhandled failure and inspect all destinations for duplication.
- Test unwritable storage behavior in a disposable directory.
- For long-running workers, cross a simulated/restarted date boundary and verify rotation/collection.
- Run logging tests and static analysis.

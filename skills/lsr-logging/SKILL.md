---
name: lsr-logging
description: Use for lsr/logging DI setup, PSR-3 logging, structured context, OpenTelemetry correlation/export, storage and formatting, redaction, RoadRunner lifetime, and operational verification.
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

The package service file expects application constants/parameters. Its default `logger` service preserves the legacy daily text output and constructor behavior:

```neon
parameters:
	logger:
		dir: %constants.appDir%logs
		name: app
		logLife: '-2 days'
```

In `lsr/logging` 0.3.2 and later, the same service file also registers:

- `loggerFactory` and `loggerClock`;
- `loggerContextNormalizer`;
- `loggerLegacyFormatter`, `loggerJsonFormatter`, `loggerLsrFormatter`, and `loggerSyslogFormatter`;
- JSON and RFC 5424 structured-data context serializers.

Alternative formatters and serializers are deliberately not autowired. Reference the required named service explicitly when creating a structured logger. This keeps an application update from silently changing its existing log format.

Keep logging config in a focused included NEON file. Ensure the runtime user can create/write the directory without broad `0777` deployment permissions.

Prefer injecting `Psr\Log\LoggerInterface` or the narrow concrete capability needed. Use `Lsr\Logging\Logger` only when calling package-specific methods such as `exception()` or `logDb()`.

## Storage and Formatting

On 0.3.2 and later, `Logger` accepts an optional third `StorageInterface` argument. Prefer `LoggerFactory` for explicit storage/formatter combinations:

- `create()` preserves the default daily legacy logger unless a storage is supplied;
- `createDaily()` writes `name-YYYY-MM-DD.log` with the selected formatter;
- `createRotating()` writes one size-bounded file and retains complete newest records.

Available formats serve different consumers:

- `LegacyFormatter`: compatible human-readable application logs;
- `JsonLogFormatter`: one JSON object per record for JSON-aware collectors;
- `LsrFormatter`: LSR text envelope with JSON context;
- `SyslogFormatter`: RFC 5424 output with structured data.

Context normalization is defensive, not redaction. It keeps records writable when context contains invalid UTF-8, recursion, exceptions, resources, dates, enums, or non-finite floats. Sensitive values must still be removed before logging.

Check `composer.lock` before using these APIs. Earlier 0.3.x versions may not provide `LoggerFactory`, the named DI services, clock injection, or the hardened storage behavior.

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

## OpenTelemetry Integration

Keep `lsr/logging` free of OpenTelemetry SDK dependencies. For `lsr/logging` 0.3.2 and later,
`lsr/otel` 0.1.1 and the official `open-telemetry/opentelemetry-auto-psr3` package provide the
integration:

- `OTEL_PHP_PSR3_MODE=inject` adds the active `trace_id` and `span_id` to context while preserving
  the configured file/structured output;
- `OTEL_PHP_PSR3_MODE=export` preserves that output and additionally emits one OTEL log record.

The mode must be set before Composer autoload, and the automatic instrumentation requires
`ext-opentelemetry`. Let `lsr/otel` own global SDK registration by default. If another SDK bootstrap
owns the globals, configure `otel.registerGlobal: false` deliberately rather than running two
provider stacks. Never combine automatic export with a manual bridge, and do not route SDK-internal
diagnostics through the instrumented PSR-3 logger.

Load `lsr-observability` for package installation, global provider ownership, lifecycle, export, and
conflict verification.

## Long-Running Processes

The 0.3.2 daily storage resolves the dated pathname for every record, so a singleton logger continues into a new file after midnight without worker recycling. Verify the installed version before relying on this behavior; earlier 0.3.x releases selected the date when the logger was constructed.

Simple and rotating file storage serialize append/rotation under an exclusive file lock. Rotation retains complete newest records within its byte limit; a single oversized record is kept intact even when it exceeds that limit. This protects process concurrency, not network filesystem semantics or multi-host collection.

Bound context size and avoid retaining throwable/object graphs in singleton state.

## Operational Design

- Container stdout/stderr collection is often preferable to writable in-container files; follow deployment conventions.
- If files are used, define ownership, retention, archiving, disk limits, and failure behavior.
- Structured JSON is useful only when the collector/parser expects it.
- Logging failures must not silently replace the original application failure; test unwritable/full storage behavior.
- Metrics measure rates/durations; logs explain individual events. Do not use high-cardinality logs as a metric substitute.

Use `lsr-observability` for OpenTelemetry traces, metrics, context propagation, and runtime flush behavior. Logging and telemetry may correlate one operation, but do not duplicate event export through automatic and manual bridges.

## Verification

- Emit representative PSR levels through the real application/runtime.
- Assert context formatting, redaction, and fallback normalization for unsafe values.
- Trigger one handled and one unhandled failure and inspect all destinations for duplication.
- Test unwritable storage behavior in a disposable directory.
- For long-running workers, cross a simulated date boundary and verify a new dated file.
- Exercise concurrent writers when file storage is shared by multiple local workers.
- For rotating storage, cover the exact byte boundary and an oversized record.
- Compile the real DI container, then run logging tests and static analysis.
- When OpenTelemetry logging is enabled, run `inject` and `export` in fresh processes that set the mode before Composer autoload; verify correlation IDs, preserved local output, and exactly one exported record.

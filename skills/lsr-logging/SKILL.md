---
name: lsr-logging
description: Use for lsr/logging LoggerExtension and named loggers, recursive storage stacks, per-destination filtering and redaction, PSR-20 clocks, PSR-3 logging, OTEL storage/correlation, formatting, and worker lifetime.
---

# LSR Logging

## Read the Installed Logging Stack

- `composer.lock`, `vendor/lsr/logging/composer.json`, and `services.neon`
- package `src/DI/LoggerExtension.php`, `Logger.php`, `LogRecord.php`, `ContextExtractor.php`, and `LogLevel.php`
- package `src/Storage/*`, `Filter/*`, `Formatter/*`, `ContextSerializer/*`, and their interfaces when used
- application logging/Tracy/RoadRunner configuration
- deployment log collection and rotation

Do not assume file paths, retention, JSON formatting, or centralized collection from the package name alone.

## DI Setup

Since **`lsr/logging` 0.3.4**, `Lsr\Logging\DI\LoggerExtension` owns logger, storage, formatter, serializer, clock, factory, normalization, and archiver registrations. It requires Nette DI `^3.2`; direct logger construction needs neither Nette DI nor OTEL.

Use named logger instances for distinct streams, not a runtime channel manager. Define reusable storage graphs with native Nette constructor statements (FQNs) or `@service` references; there are no magic driver names:

```neon
extensions:
    logging: Lsr\Logging\DI\LoggerExtension

logging:
    dir: '%constants.appDir%logs'
    default: @logging.loggers.app
    storages:
        local: Lsr\Logging\Storage\RotatingFileStorage(
            '%constants.appDir%logs/application.log',
            @loggerJsonFormatter,
            5242880
        )
        stack: Lsr\Logging\Storage\StackStorage([@logging.storages.local])
    loggers:
        app:
            storage: @logging.storages.stack
        imports:
            name: result-import
            storage: @logging.storages.stack
```

Resolve `@logging.loggers.imports` explicitly where needed. Only the configured default logger is autowired by type; `@logger` is its compatibility alias. A logger's name defaults to its map key, `dir` can be overridden per logger, and omitted `storage` selects legacy daily text output. Omitting the whole `loggers` map creates an `app` logger. Constructor-reference cycles are rejected during compilation.

For existing applications, keep including `vendor/lsr/logging/services.neon` **instead of** registering the extension separately. In 0.3.4 this file is a compatibility wrapper, not a second set of service definitions. It registers `logging` and preserves the `constants.appDir` requirement, application `logger` service overrides, and legacy parameters:

```neon
parameters:
	logger:
		dir: %constants.appDir%logs
		name: app
		logLife: '-2 days'
```

Since 0.3.2 the standard DI setup exposes these helper service IDs, retained by the extension in 0.3.4:

- `loggerFactory` and `loggerClock`;
- `loggerContextNormalizer`;
- `loggerLegacyFormatter`, `loggerJsonFormatter`, `loggerLsrFormatter`, and `loggerSyslogFormatter`;
- JSON and RFC 5424 structured-data context serializers.

Alternative formatters and serializers are deliberately not autowired. Reference the required named service explicitly when creating a structured logger. This keeps an application update from silently changing its existing log format.

Keep logging config in a focused included NEON file. Ensure the runtime user can create/write the directory without broad `0777` deployment permissions.

Prefer injecting `Psr\Log\LoggerInterface` or the narrow concrete capability needed. Use `Lsr\Logging\Logger` only when calling package-specific methods such as `exception()` or `logDb()`.

## Package-Owned Logger Selection

Compatible package-owned logger wiring is available since **Core 0.5.1, DB 0.3.17, ORM 0.3.25 and RoadRunner 0.1.16**. Check installed versions before using the options below. A skill update does not install or upgrade Composer packages.

Configure destinations in `LoggerExtension`, then select those logger services in the consuming package:

```neon
# Add to existing package configuration; this is not a complete DI bootstrap.
lsr:
    logger: @logging.loggers.app

db:
    logger: @logging.loggers.app
    connections:
        reporting:
            logger: @logging.loggers.imports

roadrunner:
    logger: @logging.loggers.app
    loggers:
        jobs: @logging.loggers.imports

orm:
    logging:
        storage: @logging.storages.stack
```

The named loggers/storage come from the earlier logging example. The database fragment supplements existing connection definitions, including a required `main` connection. Register each package extension once.

- Core exposes `<extension>.logger`. Published 0.5.1 keeps `App::getLogger(): Lsr\Logging\Logger`; 0.6 changes its getter, setter and protected property to `Psr\Log\LoggerInterface`, admitting ordinary PSR implementations without a wrapper. The concrete default is unchanged.
- DB accepts PSR-3 loggers. A connection-specific reference overrides the package reference; omitted references preserve the legacy `LOG_DIR`/`db` destination. Its Dibi-event adapter belongs to `lsr/db`, not the selected logging implementation.
- RoadRunner accepts PSR-3 loggers. A purpose-specific reference overrides the common reference; omitted settings preserve HTTP `worker` and jobs `worker-jobs` destinations. Custom worker replacement constructors must remain compatible with application DI alterations.
- ORM exposes `<extension>.loggerProvider`, not a single autowired global logger. Published 0.3.25 requires concrete LSR results; 0.4 widens the provider/getters/protected property to `Psr\Log\LoggerInterface`. Choose base storage or a custom provider through `orm.logging`; see [lsr-orm](../lsr-orm/SKILL.md). The built-in provider still returns concrete per-model LSR loggers.
- Package logger definitions do not participate in global type autowiring. Merely changing `@logger` does not redirect the legacy package defaults; choose references explicitly.
- Separate named loggers may share a storage stack while retaining identity. Selecting the same logger reference instead shares the exact instance and its logger name.

`Logger::exception()` and `Logger::logDb()` remain available to applications. DB uses its own PSR-3 Dibi adapter; worker/ORM internal exception reporting uses PSR-3 calls with the legacy error/debug records preserved. Do not consolidate records, remove public helpers, widen Core/ORM concrete getter contracts, or remove default logging dependencies as part of the compatible patches.

The Core 0.6 / ORM 0.4 contracts are deliberate minor migrations, not backports into the compatible patches. Before adoption, migrate concrete helper calls through generic getters and invariant protected-property redeclarations; see the package READMEs. Preserve the existing exception error/debug pair, including its message prefix and empty contexts, rather than replacing it with one structured error. Logger helpers and default `lsr/logging ^0.3` dependencies remain intact. Check the [cross-package compatibility set](../../README.md#psr-logger-compatibility-set) before updating constraints.

Validate both legacy defaults and configured paths. Exercise real failed queries and worker/model error reporting, not only logger service resolution. Pure packages without log-producing behavior do not acquire an unused logger dependency.

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

Context normalization is defensive, not redaction. It keeps records writable when context contains invalid UTF-8, recursion, exceptions, resources, dates, enums, or non-finite floats. Remove globally forbidden data before logging; destination-specific filters can further restrict export.

Check `composer.lock` before using these APIs. Earlier 0.3.x versions may not provide `LoggerFactory`, the named DI services, clock injection, or the hardened storage behavior.

### Recursive Stacks and Destination Filters (0.3.4+)

- `StackStorage` accepts a fixed array of destinations, including other stacks, and attempts every child in order before throwing `StackStorageException`. Its `exceptions` list preserves ordered failures and nested aggregates.
- `ignoreExceptions: true` makes that stack best-effort; nested stacks retain their own policies. Choose the policy explicitly when logging must not mask an application failure. This covers synchronous calls, not deferred SDK exporter failures.
- `FilteredStorage($storage, level: 'warning', filter: $filter)` accepts a severity string or `LogLevel`. It applies the inclusive minimum severity before invoking the optional filter; the default `DEBUG` threshold allows every level.
- A callable or invokable `Lsr\Logging\Interface\LogFilterInterface` receives a `LogRecord` and returns a replacement record or `null` to drop it. Filters receive detached, normalized context: objects/exceptions become arrays, and recursive/deep values are bounded. They cannot mutate sibling destinations or caller-owned context through the supplied record.
- `ContextBlacklistFilter(['password', 'token'])` removes exact, case-sensitive keys recursively. Wrapping one destination leaves its siblings unchanged; wrapping a whole stack applies the policy to all its descendants. It does not redact message text or secrets embedded in string values.
- `LogRecord` carries `level`, `message`, `context`, and optional `loggerName`; preserve the name when constructing replacement records. `Logger` supplies its existing `$fileName`, including when several loggers share one storage.
- Custom metadata-aware storage implements `RecordStorageInterface` and forwards through `LogRecord::storeTo()`. Legacy `StorageInterface::store()` remains supported without injecting identity into context. Custom composites/decorators expose children via `CompositeStorageInterface::getStorages()` for recursive discovery.
- `Logger::getStorage()` inspects the current destination; `addStorage()` composes it with another destination. Record-aware pipelines reject unknown severities with `Psr\Log\InvalidArgumentException`.

### PSR-20 Clocks (0.3.4+)

Formatter, daily-storage, and factory clock arguments use `Psr\Clock\ClockInterface` from `psr/clock:^1.0`. Implement `now(): DateTimeImmutable` for a custom/test clock or use a standard third-party implementation. `SystemClock` implements PSR-20, and `@loggerClock` remains available for DI overrides.

The former internal `Lsr\Logging\Interface\ClockInterface` was removed; do not generate new code against it. Normal construction and default file output are unchanged, and existing consumers need no migration.

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

Keep `lsr/logging` free of OpenTelemetry SDK dependencies. With **`lsr/logging` 0.3.4+ and `lsr/otel` 0.1.6+**, prefer explicit `Lsr\Otel\Logging\OtelStorage` in a stack. Register `OtelExtension` and reference `@otel.logging.storage`; wrap that destination in `FilteredStorage` for export-only severity/redaction. It needs neither `ext-opentelemetry`, PSR-3 hooks, nor global SDK registration.

`otel.integrations.logging.autoWire` is an optional, default-off alternative for DI-managed loggers. Explicit OTEL storage anywhere in a discoverable composite tree wins over automatic settings and prevents an additional attachment. The existing logger name becomes the protected `lsr.logger.name` OTEL attribute; the active span supplies trace/span correlation.

The separate official `open-telemetry/opentelemetry-auto-psr3` integration remains available with logging 0.3.2+ and OTEL 0.1.1+. It requires `ext-opentelemetry` and its mode must be set before Composer autoload:

- `OTEL_PHP_PSR3_MODE=inject` adds active `trace_id` and `span_id` to context while preserving configured output. Injection-only instrumentation can coexist with OTEL storage.
- `OTEL_PHP_PSR3_MODE=export` preserves that output and additionally emits an OTEL record through global providers. **Never combine it with explicit or automatically attached `OtelStorage`**: these are independent export paths and duplicate records.

Let `lsr/otel` own global registration when hooks need its providers. If another SDK bootstrap owns the globals, configure `otel.registerGlobal: false` deliberately. Keep SDK-internal diagnostics off the instrumented logging path to prevent recursive export.

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

Use `lsr-observability` for OTEL storage wiring, exported attribute semantics, traces, metrics, context propagation, and runtime flush behavior. Storage does not flush per write; deferred export uses the provider's existing lifecycle.

## Verification

- Emit representative PSR levels through the real application/runtime.
- Assert context formatting, redaction, and fallback normalization for unsafe values.
- For stacks, verify every sibling is attempted despite an earlier failure, nested aggregates remain observable, and the chosen ignore policy works.
- Verify threshold-before-filter behavior, `null` drops, recursive case-sensitive blacklists, and isolation between filtered exports and sibling output.
- Trigger one handled and one unhandled failure and inspect all destinations for duplication.
- Test unwritable storage behavior in a disposable directory.
- For long-running workers, cross a simulated date boundary and verify a new dated file.
- Exercise concurrent writers when file storage is shared by multiple local workers.
- For rotating storage, cover the exact byte boundary and an oversized record.
- Compile the real DI container, then run logging tests and static analysis.
- For OTEL storage, verify logger-name identity, active-span correlation, export-only redaction, automatic attachment once, and nested explicit-destination precedence.
- When PSR-3 hooks are used, run `inject` and `export` in separate fresh processes that set the mode before Composer autoload; verify correlation IDs, preserved local output, and exactly one exported record. Do not enable storage export in the hook-export scenario.

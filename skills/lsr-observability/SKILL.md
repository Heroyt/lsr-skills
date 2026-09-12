---
name: lsr-observability
description: Use for lsr/otel OpenTelemetry setup, explicit OTEL log storage and opt-in Logger auto-wiring, global SDK ownership, PSR-3 correlation/export, tracing and metrics, OTLP export, context cleanup, cardinality, and worker flushing.
---

# LSR Observability

## Read the Installed Telemetry Stack

Before configuring telemetry, inspect:

- `composer.lock` and `vendor/lsr/otel/composer.json`;
- `vendor/lsr/otel/src/DI/OtelExtension.php` for the installed config schema;
- `vendor/lsr/otel/src/GlobalSdkRegistration.php`, `Tracing.php`, `Metrics.php`, and `InstrumentationRegistry.php`;
- the installed `lsr/logging` and `open-telemetry/opentelemetry-auto-psr3` versions when logs are in scope;
- package `src/Logging/OtelStorage.php` and `LoggerAutoWire.php`, plus logging's record/composite storage interfaces, when using storage integration;
- installed lifecycle interfaces in every framework package being instrumented;
- runtime entrypoints for FPM, RoadRunner HTTP/jobs, Console, and Scheduler;
- deployment `OTEL_*` variables and the Collector/export endpoint.

LSR packages release independently. An installed framework package without the lifecycle interface expected by `lsr/otel` is intentionally not instrumented.

## Register the Extension

Register the extension once in a focused included NEON file:

```neon
extensions:
    otel: Lsr\Otel\DI\OtelExtension

otel:
    enabled: true
    autoShutdown: true
    registerGlobal: true

    applicationInstrumentation:
        name: vendor/application
        version: 1.2.3
```

`applicationInstrumentation.name` is a Composer-style package name. When configured, DI exposes autowireable `Lsr\Otel\Tracing` and `Lsr\Otel\Metrics` services. They remain safe no-op services when `otel.enabled` is false.

Keep provider, exporter, sampler, propagator, resource, and OTLP transport configuration in standard `OTEL_*` variables. In particular, define a stable deployed `OTEL_SERVICE_NAME`; do not generate a new service or instance identity per request.

## Global SDK Ownership

In `lsr/otel` 0.1.1 and later, `registerGlobal` defaults to `true`. The DI-created tracer, meter,
logger, event logger, and propagators become the OpenTelemetry globals used by automatic
instrumentation. Registration preserves the current active context and the telemetry lifecycle
detaches it before provider shutdown.

Exactly one bootstrap may own the global SDK. Container initialization rejects existing non-noop
global providers instead of silently splitting signals between SDKs. If another bootstrap
intentionally owns the globals, opt out explicitly:

```neon
otel:
    registerGlobal: false
```

Do not use the opt-out merely to suppress the conflict: identify which bootstrap owns provider
construction, configuration, flushing, and shutdown. `otel.enabled: false` creates the safe no-op
services without registering them globally.

## OTEL Log Storage (0.1.6+)

Use **`lsr/otel` 0.1.6+ with `lsr/logging` 0.3.4+** for record-aware storage. Logging remains an optional dependency: telemetry without this integration still works with missing/older logging packages when automatic wiring is off.

### Explicit Storage by Default

`Lsr\Otel\Logging\OtelStorage` accepts an injected OpenTelemetry API `LoggerInterface`, for example `$registry->logger('vendor/application')`. With compatible logging installed, `OtelExtension` exposes non-autowired `@otel.logging.logger` (scope `lsr/logging`) and `@otel.logging.storage` even when automatic wiring is off.

Register both extensions once, then use the storage in a named logger's graph. This is a complete registration alternative to the earlier OTEL-only example; if logging's `services.neon` is already included, it registers `LoggerExtension` for you:

```neon
extensions:
    logging: Lsr\Logging\DI\LoggerExtension
    otel: Lsr\Otel\DI\OtelExtension

logging:
    dir: '%constants.appDir%logs'
    default: @logging.loggers.app
    storages:
        local: Lsr\Logging\Storage\SimpleFileStorage(
            '%constants.appDir%logs/application.log',
            @loggerJsonFormatter
        )
        telemetry: Lsr\Logging\Storage\FilteredStorage(
            @otel.logging.storage,
            warning,
            Lsr\Logging\Filter\ContextBlacklistFilter([password, token, authorization])
        )
        stack: Lsr\Logging\Storage\StackStorage([@logging.storages.local, @logging.storages.telemetry])
    loggers:
        app:
            storage: @logging.storages.stack
        imports:
            name: result-import
            storage: @logging.storages.stack
```

Storage export does not require `ext-opentelemetry`, PSR-3 interception, or global SDK registration. It uses the injected provider's processor/exporter and existing flush/shutdown lifecycle, not a flush on every write. `StackStorage` attempts all destinations before reporting synchronous failures; `ignoreExceptions: true` opts out. Deferred export failures belong to the SDK lifecycle, not stack exception handling.

### Opt-in Automatic Attachment

With both extensions registered, add:

```neon
otel:
    integrations:
        logging:
            autoWire: true
            level: warning
            filter: @exportFilter

services:
    exportFilter: Lsr\Logging\Filter\ContextBlacklistFilter([password, token])
```

- Defaults are `autoWire: false`, `level: DEBUG`, and `filter: null`. Every level/context key is allowed unless a destination filter restricts it.
- Automatic attachment preserves existing storage on DI-managed `Lsr\Logging\Logger` services, including manually declared services and service factories whose resolved service type is `Logger`. It does not intercept arbitrary `new Logger(...)`, unrelated PSR-3 implementations, or products of Nette-generated factory interfaces.
- Discovery recursively follows `CompositeStorageInterface::getStorages()`. An explicit `OtelStorage` anywhere in that tree, including under filters/nested stacks, prevents another automatic attachment. Automatic level/filter settings do not override explicit storage policies. Custom wrappers must expose their children for discovery.
- `otel.enabled: false` skips automatic attachment and gives explicit OTEL storage no-op providers. With telemetry enabled, opting into automatic wiring without compatible logging fails configuration.

Since Core **0.5.1**, DB **0.3.17**, RoadRunner **0.1.16** and ORM **0.3.25**, use [package-owned logger selection](../lsr-logging/SKILL.md#package-owned-logger-selection) to route Core/DB/worker internals into selected DI logger services. Old package versions still construct private loggers and bypass this discovery. ORM provider-created model loggers remain dynamic: include `@otel.logging.storage` explicitly in their base storage stack. A generic PSR-3 logger selected for DB/workers is not an LSR `Logger` and needs its own export integration; automatic LSR storage attachment does not configure Monolog handlers.

The same limitation applies to arbitrary PSR loggers selected by **Core 0.6 / ORM 0.4**. Shared aliases retain their selected logger identity; selecting a PSR service does not make it an LSR storage target. `@otel.logging.logger` implements the OpenTelemetry Logs API, not PSR-3, and is not a valid Core logger reference.

### Exported Record Contract

- The body preserves the message, severity maps to OTEL numbers/text, and the active span supplies trace/span correlation.
- The logger's existing `$fileName` becomes protected `lsr.logger.name`, distinguishing loggers sharing storage. Context cannot overwrite it. Direct anonymous `OtelStorage::store()` calls do not add the name.
- Context is normalized with the logging package. Scalars/homogeneous scalar lists remain native attributes; nested objects/arrays and mixed lists become JSON strings; top-level null attributes are omitted. Resource/service identity remains provider-owned.
- `['exception' => $throwable]` maps to `exception.type`, `exception.message`, and `exception.stacktrace` from the filtered context, so removed details are not restored. `Logger::exception()` still emits two text records; it does not automatically supply semantic exception attributes.
- Blacklists are exact, case-sensitive, recursive key filters, not message/string sanitizers. Use `FilteredStorage` to isolate export restrictions from sibling file output; redact globally forbidden data before logging.

Use [lsr-logging](../lsr-logging/SKILL.md) for named loggers, stack failure policies, custom filters/storage, the compatibility wrapper, and PSR-20 clocks.

## PSR-3 Log Correlation and Export

As a separate alternative, logging 0.3.2+ supports the official optional PSR-3 instrumentation:

```sh
composer require open-telemetry/opentelemetry-auto-psr3:^0.3
```

The instrumentation requires `ext-opentelemetry`. Set its mode before Composer autoload:

```sh
OTEL_PHP_PSR3_MODE=inject
```

- `inject` keeps the normal logger output and adds the active `trace_id` and `span_id` to PSR-3
  context;
- `export` keeps the normal logger output and emits one OTEL log record through the global logger
  provider registered by `lsr/otel`.

The PSR-3 package registers its hooks through Composer. Do not enable a second automatic SDK
bootstrap merely to use those hooks; `lsr/otel` already constructs and owns the SDK through DI.
Disable the hook with `OTEL_PHP_DISABLED_INSTRUMENTATIONS=psr3` when it is not wanted. **Never combine
`export` with explicit or automatically attached `OtelStorage`, or another manual PSR-3 bridge**:
independent export paths duplicate records. Injection-only mode can coexist with storage export.
Keep SDK diagnostics off the instrumented PSR-3 path to avoid recursive log export.

## Framework Integrations

Tracing/metric integrations default to enabled with traces and metrics enabled. Logging uses the separate default-off `autoWire` configuration above, not `enabled`/`traces`/`metrics` switches. Disable only the tracing/metric signal or seam that is not required:

```neon
otel:
    integrations:
        core:
            enabled: true
            traces: true
            metrics: true

        roadrunner:
            enabled: true
            traces: true
            metrics: true
            flushEvery: 100
            flushInterval: 10.0

        database:
            enabled: true
            traces: true
            metrics: true
            includeRawSql: false

        orm:
            enabled: true
            traces: true
            metrics: true
            mutations: true
            queries: true
            hydration: false
            modelMetrics: false
```

Available seams cover Core HTTP and route resolution, RoadRunner workers/tasks, Console, CQRS, Cache, Scheduler, Auth, Request mapping, Inertia rendering, DB operations, and ORM model operations when their owning packages are installed.

Keep `database.includeRawSql` false unless reviewed production diagnostics require query text. Keep `orm.modelMetrics` false unless model-class dimensions have bounded, reviewed cardinality.

## Application Tracing

Use `Tracing::trace()` for one owned operation boundary:

```php
return $this->tracing->trace(
    'result.import',
    fn(): Result => $this->importResult(),
    ['result.format' => 'lasermaxx'],
);
```

The callback may accept the active `SpanInterface` when it needs additional attributes or events. The module activates the new span, records and marks callback exceptions, rethrows the original exception, then always detaches and ends the span.

Use `Tracing::start()` only when a callback boundary cannot represent the lifecycle. The returned `ActiveSpan` must be ended in `finally`; `end()` is idempotent:

```php
$activeSpan = $this->tracing->start('result.import');

try {
    return $this->importResult();
} catch (Throwable $exception) {
    $activeSpan->fail($exception);
    throw $exception;
} finally {
    $activeSpan->end();
}
```

Use stable operation names. Put dynamic values in reviewed attributes, never in span names.

## Application Metrics

Declare instruments once during service construction and retain the typed handle:

```php
$this->imports = $metrics->counter(
    'result.imports',
    '{result}',
    'Imported result files.',
);
$this->duration = $metrics->histogram(
    'result.import.duration',
    's',
    'Result import duration.',
);
```

Record measurements at the owned outcome boundary:

```php
$this->imports->add(1, ['result.outcome' => 'success']);
$this->duration->record($seconds, ['result.outcome' => 'success']);
```

`Metrics` caches instruments by name. Repeating the same declaration returns the same handle; conflicting type, unit, or description declarations are developer errors. Provider creation and recording failures degrade to no-op behavior so telemetry cannot change application control flow.

Metric names and attribute keys must be stable. Never use user IDs, request IDs, model IDs, raw paths, SQL, cache keys, exception messages, or unbounded class/input values as metric dimensions.

## Additional Instrumentation Scopes

Inject `InstrumentationRegistry` when a library or module owns a distinct Composer instrumentation scope:

```php
$tracing = $registry->tracing('vendor/package', '1.2.3');
$metrics = $registry->metrics('vendor/package', '1.2.3');
```

The registry also exposes official OpenTelemetry tracer, meter, and logger interfaces. Prefer the `Tracing` and `Metrics` modules for application-owned synchronous operations because they centralize lifecycle cleanup, stable instrument declarations, and failure isolation.

## Context and Long-Running Workers

- Every activated scope detaches in `finally`.
- Every started span ends exactly once.
- Do not retain active contexts, spans, request attributes, or metric dimensions between worker iterations.
- Extract standard W3C context before a server/consumer span and inject it when producing outbound work.
- FPM, CLI, jobs, and RoadRunner have different flush boundaries; do not treat process shutdown as a RoadRunner request boundary.
- Metric collection is driven by collection, force-flush, or shutdown boundaries. Do not assume `OTEL_METRIC_EXPORT_INTERVAL` creates an independent PHP timer.
- Export, flush, and shutdown failures must not replace application responses, exceptions, acknowledgements, or exit codes.

## Sensitive Data

Telemetry is an operational data export. Apply the same or stricter review as structured logs:

- do not capture authorization headers, cookies, sessions, credentials, request/response bodies, task payloads, or personal data by default;
- do not capture raw SQL unless explicitly enabled and reviewed;
- record exception type/status by default, not arbitrary messages as metric attributes;
- keep resource attributes deployment-owned and free of per-request values.

Use `lsr-logging` for event detail and storage composition, and `lsr-observability` for OTEL storage/export, traces, rates, durations, and correlations. Choose one log export path.

## Verification

1. Compile the real application container and resolve `Tracing`, `Metrics`, providers, propagator, and lifecycle services.
2. With global registration enabled, prove `Globals` resolves the same DI providers and preserves any active context.
3. Configure a deliberate external provider owner and prove startup fails unless `registerGlobal` is false.
4. Exercise one successful and one failed operation; confirm parent/child spans, status, attributes, and cleanup.
5. Record a counter and histogram; confirm units, descriptions, values, and bounded attributes at the Collector/backend.
6. For storage export, compile explicit/default-off and opt-in auto-wiring configurations. Emit through loggers sharing nested storage; verify one exported record per eligible call, logger-name identity, active-span correlation, and filtered export without changing sibling output. Check nested explicit-destination precedence and unmapped custom wrappers.
7. Disable telemetry and prove the same application path and DI graph still work through no-op providers without changing globals.
8. Run two sequential RoadRunner requests/jobs and prove the second cannot see the first context.
9. Exercise the configured flush threshold and worker/process shutdown path.
10. Inspect exported data for sensitive values and cardinality before production enablement.
11. If PSR-3 hooks are selected, run `inject` and `export` in separate processes that set the mode before Composer autoload. Confirm injected IDs and preserved logger output; only test hook `export` with storage export disabled.

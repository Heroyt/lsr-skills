---
name: lsr-observability
description: Use for lsr/otel OpenTelemetry setup, global SDK ownership, PSR-3 correlation/export, application tracing and metrics, lifecycle integrations, OTLP export, context cleanup, cardinality, and worker flushing.
---

# LSR Observability

## Read the Installed Telemetry Stack

Before configuring telemetry, inspect:

- `composer.lock` and `vendor/lsr/otel/composer.json`;
- `vendor/lsr/otel/src/DI/OtelExtension.php` for the installed config schema;
- `vendor/lsr/otel/src/GlobalSdkRegistration.php`, `Tracing.php`, `Metrics.php`, and `InstrumentationRegistry.php`;
- the installed `lsr/logging` and `open-telemetry/opentelemetry-auto-psr3` versions when logs are in scope;
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

## PSR-3 Log Correlation and Export

Use `lsr/logging:^0.3.2` with the official optional instrumentation:

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
Disable the hook with `OTEL_PHP_DISABLED_INSTRUMENTATIONS=psr3` when it is not wanted. Never combine
`export` with a manual PSR-3 bridge, and keep SDK diagnostics off the instrumented PSR-3 path to
avoid recursive log export.

## Framework Integrations

Installed integrations default to enabled with traces and metrics enabled. Disable only the signal or seam that is not required:

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

Use `lsr-logging` for event detail and `lsr-observability` for traces, rates, durations, and correlations. Avoid exporting the same log through both an automatic PSR-3 integration and a manual bridge.

## Verification

1. Compile the real application container and resolve `Tracing`, `Metrics`, providers, propagator, and lifecycle services.
2. With global registration enabled, prove `Globals` resolves the same DI providers and preserves any active context.
3. Configure a deliberate external provider owner and prove startup fails unless `registerGlobal` is false.
4. Exercise one successful and one failed operation; confirm parent/child spans, status, attributes, and cleanup.
5. Record a counter and histogram; confirm units, descriptions, values, and bounded attributes at the Collector/backend.
6. Run PSR-3 `inject` and `export` in processes that set the mode before Composer autoload. Confirm injected IDs, preserved logger output, active span correlation, and exactly one exported record.
7. Disable telemetry and prove the same application path and DI graph still work through no-op providers without changing globals.
8. Run two sequential RoadRunner requests/jobs and prove the second cannot see the first context.
9. Exercise the configured flush threshold and worker/process shutdown path.
10. Inspect exported data for sensitive values and cardinality before production enablement.

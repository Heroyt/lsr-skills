---
name: lsr-roadrunner-runtime
description: Use for LSR RoadRunner installation, DI and .rr.yaml coordination, worker entrypoints, HTTP/jobs modes, RPC/queue configuration, long-running state isolation, supervision, and runtime verification.
---

# LSR RoadRunner Runtime

Use `lsr-async-jobs` for task payload/dispatcher implementation.

## Read Both Configuration Layers

RoadRunner behavior is split across:

- application DI: `vendor/lsr/roadrunner/src/DI/RoadrunnerExtension.php` plus app NEON;
- runtime config: `.rr.yaml`;
- PHP worker entrypoint passed to `server.command`;
- installed RoadRunner binary/plugin versions.

Read all four. A queue/RPC/worker name must agree across layers.

## DI Configuration

Current extension options include:

```neon
extensions:
	roadrunner: Lsr\Roadrunner\DI\RoadrunnerExtension

roadrunner:
	rpc:
		host: tcp://localhost
		port: 6001
	jobs:
		queue: tasks
		serializer: @roadrunner.tasks.serializer
	workers:
		http: @roadrunner.worker.http
		jobs: @roadrunner.worker.jobs
```

Read the installed schema and generated service names before copying this shape. The default worker map keys follow RoadRunner environment modes.

## Worker Entrypoint

The application owns a small entrypoint:

```php
require __DIR__ . '/include/load.php';

$app = App::getInstance();
$server = $app::getService('roadrunner.server');
assert($server instanceof Lsr\Roadrunner\Server);
$server->run();
```

`Server::run()` reads RoadRunner environment globals, selects the configured worker by mode, and fails when the mode is unmapped. Keep bootstrap identical to the application's other entrypoints through container/DB initialization; do not maintain a second partial bootstrap for RoadRunner.

## `.rr.yaml`

At minimum coordinate:

- `server.command` with the PHP worker entrypoint;
- `rpc.listen` with the DI RPC host/port;
- `http` address/pool/headers/timeouts with application behavior;
- `jobs.consume` and pipeline names with the DI job queue;
- worker counts, max jobs, memory, execution TTL, and graceful shutdown with deployment capacity;
- logging/metrics with operational requirements.

Use syntax supported by the installed RoadRunner version. Do not copy an old `.rr.yaml` wholesale.

A memory queue is process-local and loses queued work on restart. Choose a durable driver when job durability is a requirement.

## HTTP Worker Lifecycle

Current `HttpWorker`:

1. waits for a PSR-7 request;
2. converts it through the configured `RequestFactoryInterface`;
3. clears `ModelRepository` instances;
4. installs the request on `App`;
5. initializes/uses the session;
6. runs the application and emits response/session cookies;
7. closes the session and updates translations in `finally`.

Application services remain alive between requests. Therefore:

- no mutable request/auth/tenant/locale state in singleton/static application modules;
- close files, DB cursors, sessions, and temporary resources deterministically;
- avoid unbounded in-memory caches;
- reset custom request-scoped registries explicitly;
- test sequential requests with different identities and locales.

## Jobs Worker Lifecycle

Current `JobsWorker` clears ORM instances, resolves a DI dispatcher by task name, deserializes payload, invokes it, and acknowledges unless already completed. Exceptions are nacked/logged. Queue acceptance is not processing success.

Keep HTTP and jobs worker services safe for their respective modes. Do not inject request-bound state into job dispatchers.

## Error Handling and Supervision

- Map HTTP 403/404/405/500 handlers through DI according to the installed extension.
- Keep production error responses free of traces/secrets.
- Send unexpected failures to observable logs/metrics and preserve worker failure semantics.
- Bound worker lifetime/memory as a safety net, not a substitute for leak-free code.
- Configure scheduler or other long-lived services under supervision separately; do not run one scheduler per HTTP worker.

## Verification

1. Validate `.rr.yaml` with the installed RoadRunner binary.
2. Start the actual worker and issue HTTP requests through RoadRunner.
3. Test 2xx, 403, 404, 405, and 500 behavior.
4. Send sequential requests with different session/auth/locale and inspect isolation.
5. Push and process a real job through the configured pipeline.
6. Restart workers and verify durability expectations.
7. Observe logs, metrics, timeouts, memory limits, and graceful shutdown.
8. Run application static analysis/tests for touched runtime modules.

---
name: lsr-framework-orchestration
description: Use when orienting in an LSR application, choosing package ownership, tracing bootstrap and request/runtime lifecycles, coordinating DI, routing, persistence, presentation, workers, scheduler, and localization.
---

# LSR Framework Orchestration

Use this skill first for cross-cutting LSR work, then load the focused package skills it identifies.

## Establish the Application

1. Read repository instructions.
2. Read `composer.json`, `composer.lock`, and package scripts.
3. Read bootstrap entrypoints for HTTP/FPM, RoadRunner, console, installers, and tests.
4. Read `config/services.php` and follow every NEON `includes:` edge.
5. Read routing registration, migration root, templates/Inertia entrypoint, and `.rr.yaml` when present.
6. Inspect installed `vendor/lsr/*` source for every interface being changed.

LSR packages are independently versioned. The source installed in the application is authoritative; this skill provides navigation and invariants, not a substitute for version inspection.

## Package Map

Foundation:

- `lsr/interfaces` — shared PSR/LSR interfaces and request method types;
- `lsr/helpers` — helpers, common exceptions, gettext support dependencies;
- `lsr/logging` — PSR logger and storage/formatting helpers.

Application core:

- `lsr/core` — container bootstrap, `App`, request dispatch, controllers, sessions/cookies, Latte, links, translations, migration loading;
- `lsr/routing` — router, groups, middleware, localized routes, route attributes/cache;
- `lsr/request` — PSR request/response factories, mapped request validation, response DTOs;
- `lsr/cache`, `lsr/db`, `lsr/serializer`, `lsr/object-validation`, `lsr/orm` — persistence/data stack.

Optional orchestration:

- `lsr/auth` — users, authentication middleware, session auth;
- `lsr/cqrs` — command bus/contracts and optional async adapter seam;
- `lsr/console` — Symfony Console DI command loading;
- `lsr/inertia` — Inertia response/middleware adapter;
- `lsr/roadrunner` — HTTP/jobs workers and task production;
- `lsr/scheduler` — Symfony Scheduler integration;
- `lsr/otel` — OpenTelemetry providers and global SDK ownership, PSR-3 correlation/export, application tracing/metrics, lifecycle adapters, and runtime flush/shutdown handling.

Require optional packages only for real application behavior. Do not introduce a package merely because a skill exists.

## Bootstrap Order

The typical application-owned startup sequence is:

1. define constants/environment and load Composer;
2. call `App::setupDi()`; core loads root configs returned by `config/services.php`;
3. resolve `Lsr\Db\Connection` and call `DB::init()` when the app uses DB/ORM;
4. initialize application modules that truly require an explicit lifecycle;
5. obtain `App` or the runtime `Server`/Console application;
6. run the selected HTTP, RoadRunner, console, installer, or scheduler interface.

Preserve local error handling and no-DB/test modes. Container construction does not initialize the static DB facade automatically.

## Configuration Ownership

Keep configuration navigable:

- root DI files index focused NEON files through `includes:`;
- the registered `routes` directory contains multiple domain route files, all loaded automatically;
- the migration root indexes domain migration files through `includes:`;
- worker, jobs, scheduler, cache, serializer, and localization config each live near their owning concern;
- private credentials/environment overrides remain outside committed shared config.

Do not create a second registration convention beside an existing search/include/module convention.

## End-to-End Request Flow

```text
runtime request
  -> RequestFactory / RequestInterface
  -> App route selection
  -> route middleware
  -> RouteHandler argument mapping / DI controller
  -> application module (CQRS/ORM/DB/etc.)
  -> Latte or Inertia/structured ResponseInterface
  -> cookies/session close
  -> runtime response
```

Trace the complete path when changing auth, locale, caching, DTOs, or error handling. A controller-only check misses middleware and runtime cleanup.

## Background Flow

```text
producer or scheduler
  -> serializable command/job identity
  -> RoadRunner queue or scheduler trigger
  -> DI-resolved task/job/command
  -> transaction/state transition
  -> ack/failure/exit status
```

Jobs and schedules are application services. Make retryable work idempotent, keep payloads versionable, and preserve supervisor-visible failure.

## State and Runtime Invariants

- Constructor injection inside application modules; service lookup only at framework/bootstrap seams.
- `ResponseInterface` at HTTP handler interfaces.
- DB initialized once; transaction scope owns atomic state transitions.
- Cache keys/tags include all visibility/dependency dimensions.
- Models/migrations/serialization stay aligned.
- RoadRunner/scheduler processes never retain request, auth, tenant, locale, or model state between work items.
- Backend owns active locale; Latte, Inertia, routes, catalogs, and browser formatting stay synchronized.
- Telemetry context and attributes never leak between work items; exporter failure never changes application control flow.

## Choose the Focused Skill

- DI/bootstrap: `lsr-app-di`
- routes/localized routes: `lsr-routing`
- HTTP/controllers/DTO binding: `lsr-request-flow`
- migrations: `lsr-db-migrations`
- DB/ORM/cache: `lsr-db`, `lsr-orm`, `lsr-cache`
- serialization/validation: `lsr-serializer-validation`
- auth/session: `lsr-auth-session`
- CQRS: `lsr-cqrs`
- console: `lsr-console`
- jobs/runtime/scheduler: `lsr-async-jobs`, `lsr-roadrunner-runtime`, `lsr-scheduler`
- Latte/Inertia/Vue: `lsr-latte-stack`, `lsr-inertia-backend`, `lsr-vue-inertia`
- translations: `lsr-localization`
- logging/telemetry: `lsr-logging`, `lsr-observability`
- review: `lsr-quality-rules`

## Verification Strategy

Verify at the deepest changed interface, then cross the integration seam:

- config: compile the real container;
- route/request: issue an HTTP request;
- persistence: run against a disposable DB and observe cache behavior;
- job: process through the actual worker;
- scheduler: run through `scheduler:run` or the runner;
- presentation: render/navigate in a browser;
- localization: compile catalogs and compare PHP/Vue output;
- observability: inspect exported spans/metrics and exercise no-op, flush, and context-cleanup paths;
- always run repository-defined static analysis/tests for changed contracts.

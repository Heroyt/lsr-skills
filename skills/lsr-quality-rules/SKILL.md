---
name: lsr-quality-rules
description: Use when reviewing or implementing an LSR application to separate framework contracts from local conventions and check DI, HTTP, persistence, caching, long-running state, types, security, and verification.
---

# LSR Quality Rules

Use this with the specific LSR skill for the touched package. These are framework integration guardrails, not a replacement for the application's own architecture and repository rules.

## Evidence Order

Before judging code, establish facts in this order:

1. repository instructions and current application patterns;
2. `composer.json` / `composer.lock`;
3. installed `vendor/lsr/*` source and package config schema;
4. application DI, routes, migrations, and runtime bootstrap;
5. tests covering the interface.

Do not present a convention from one LSR application as framework behavior.

## Configuration Structure

- Keep `config/services.php` as the explicit list of root DI configs expected by `App::setupDi()`.
- Split NEON by environment, technical concern, and domain with `includes:`; do not accumulate all services in one file.
- Split route definitions into focused direct `.php` files under the registered `routes` directory.
- Split migrations by domain through `MigrationLoader`'s `includes:` tree.
- Keep secrets out of committed config.
- Register each extension and service ownership rule once.

## Module Interfaces

- Prefer constructor injection; restrict `App::getService*()` to bootstrap/integration seams.
- Keep route actions, commands, handlers, jobs, and scheduler jobs thin enough to expose clear orchestration.
- Use typed DTOs/models/scalars at stable module interfaces. Do not leak `Dibi\Row`, container objects, or transport request arrays across them.
- Do not add CQRS, repositories, adapters, or abstract interfaces unless the application already has a real seam/variation that needs them.
- Preserve PSR-4 paths and one primary declaration per file according to the repository's coding rules.

## HTTP and Security

- Validate mapped request DTOs and enforce authorization server-side.
- Use SQL placeholders and serializer exclusions.
- Never log credentials, session content, access tokens, or sensitive request bodies.
- Treat translated/user-authored HTML as untrusted.
- Keep cookies and sessions secure for the deployment.
- Return explicit response types/statuses and preserve middleware ordering.

## Persistence and Cache

- Initialize `DB` once during bootstrap.
- Use ORM for model lifecycle behavior; use DB projections/bulk/atomic SQL when that is the deeper interface.
- Keep model properties, migration definitions, indexes, and foreign keys aligned.
- Tag cached reads with their dependencies and invalidate raw writes explicitly.
- Scope cache keys by tenant/user/locale/permission when output varies.
- Never use broad cache clearing as application logic.

## Long-Running Runtimes

RoadRunner and scheduler processes reuse memory:

- no request, auth, tenant, locale, or model state in static/singleton mutable fields;
- reset ORM/request/session state at each work item;
- payloads contain serializable data, not live services/resources;
- jobs are idempotent when retries are possible;
- graceful shutdown and observable failures are preserved.

## Review Checklist

For every change, ask:

- Which package/application module owns the behavior?
- Is the claimed interface present in the installed version?
- Are all DI services and extension keys valid?
- Does startup order initialize the container, DB, request/session, and runtime correctly?
- Are route/DI/migration files split at coherent ownership seams?
- Are returned DTO/wire shapes stable and typed?
- Are cache dependencies and invalidation complete?
- Is state isolated across sequential RoadRunner work items?
- Does the verification exercise the real interface and failure path?

## Verification

Use commands defined by the application. Run the narrow behavior first, then static analysis, coding standards, tests for changed contracts, and the actual HTTP/CLI/worker/scheduler smoke path. Do not copy command names from another app without checking `composer.json`, `package.json`, and `bin/console list`.

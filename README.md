# LSR framework skills

Agent skills for building, maintaining, and reviewing applications based on the independently versioned [LSR framework](https://packages.laserliga.cz) Composer packages and optional frontend integrations.

The collection covers framework-wide orchestration plus focused guidance for DI, routing, HTTP, data, authentication, rendering, background processes, localization, and quality review. Skills are installed with the [`skills` CLI](https://www.skills.sh/docs/cli).

## Install

Install the repository and choose skills interactively:

```sh
npx skills add Heroyt/lsr-skills
```

Install every skill for every detected agent without prompts:

```sh
npx skills add Heroyt/lsr-skills --all
```

Install one or more skills:

```sh
npx skills add Heroyt/lsr-skills \
  --skill lsr-framework-orchestration \
  --skill lsr-routing
```

Install globally instead of in the current project:

```sh
npx skills add Heroyt/lsr-skills --global
```

List the repository catalog without installing:

```sh
npx skills add Heroyt/lsr-skills --list
```

Update installed skills later:

```sh
npx skills update
```

Use the CLI's `--agent` option when installation must target specific supported agents.

## Start here

Use **[`lsr-framework-orchestration`](skills/lsr-framework-orchestration/SKILL.md)** first for cross-cutting work or an unfamiliar LSR application. It maps package ownership, bootstrap order, the HTTP and background lifecycles, configuration structure, and the focused skills to load next.

For a narrow task, install/use only the matching skill. Explicit invocation syntax depends on the agent; supported agents normally discover installed skills from their descriptions, and many accept prompts such as “Use `$lsr-routing` to split and localize these routes.”

## Skill catalog

### Framework and application structure

| Skill | Use for |
| --- | --- |
| [`lsr-framework-orchestration`](skills/lsr-framework-orchestration/SKILL.md) | Package ownership, bootstrap order, end-to-end HTTP/background flow, and cross-package changes. |
| [`lsr-app-di`](skills/lsr-app-di/SKILL.md) | `App::setupDi()`, Nette extensions/services, package logger selection, modular NEON includes, and container debugging. |
| [`lsr-quality-rules`](skills/lsr-quality-rules/SKILL.md) | Evidence-based LSR review across configuration, interfaces, security, persistence, cache, and long-running state. |

### HTTP and routing

| Skill | Use for |
| --- | --- |
| [`lsr-routing`](skills/lsr-routing/SKILL.md) | Modular routes, groups, middleware, domain constraints/aliases since 0.5.0, attributes, metadata, named/localized routes, sitemap discovery and links. |
| [`lsr-request-flow`](skills/lsr-request-flow/SKILL.md) | Route dispatch, controllers, middleware, action argument/model binding, mapped request DTOs, and responses. |
| [`lsr-auth-session`](skills/lsr-auth-session/SKILL.md) | `lsr/auth`, user models, login/register/logout, authorization middleware, sessions, and cookies. |

### Persistence and data

| Skill | Use for |
| --- | --- |
| [`lsr-db`](skills/lsr-db/SKILL.md) | Connection/bootstrap, configurable PSR-3 logging and Dibi event translation, the DB facade, fluent queries, DTOs, caching, transactions, and opt-in idle MySQL reconnects. |
| [`lsr-db-migrations`](skills/lsr-db-migrations/SKILL.md) | Domain-split migration includes, definitions/modifications, indexes, foreign keys, views, and installer verification. |
| [`lsr-orm`](skills/lsr-orm/SKILL.md) | Models, per-model logger providers and shared storage, properties, relations, owned locale-keyed content translations since 0.3.23, caching, and schema alignment. |
| [`lsr-cache`](skills/lsr-cache/SKILL.md) | File/Redis cache configuration, namespaces, dependencies, tags, invalidation, and commands. |
| [`lsr-serializer-validation`](skills/lsr-serializer-validation/SKILL.md) | Symfony serializer integration, mapping, typed DTOs, validation attributes, request mapping, and DB DTO fetches. |

### Application orchestration

| Skill | Use for |
| --- | --- |
| [`lsr-cqrs`](skills/lsr-cqrs/SKILL.md) | Commands, handlers, query markers, DI resolution, synchronous dispatch, and async adapters. |
| [`lsr-console`](skills/lsr-console/SKILL.md) | Symfony Console DI discovery, `AsCommand`, lazy commands, maintenance commands, and CLI behavior. |
| [`lsr-scheduler`](skills/lsr-scheduler/SKILL.md) | `SchedulerJobInterface`, cron/periodic triggers, scheduled commands, diagnostics, shared state/locks, and supervision. |
| [`lsr-async-jobs`](skills/lsr-async-jobs/SKILL.md) | RoadRunner task payloads/dispatchers, `TaskProducer`, serializers, acknowledgement, retries, and async CQRS. |
| [`lsr-roadrunner-runtime`](skills/lsr-roadrunner-runtime/SKILL.md) | DI + `.rr.yaml`, configurable PSR-3 worker loggers, HTTP/jobs workers, RPC/queues, supervision, optional SSR Node services, and long-running isolation. |
| [`lsr-logging`](skills/lsr-logging/SKILL.md) | `LoggerExtension`, named loggers, recursive storage stacks, destination filtering/redaction, PSR-20 clocks, formatting, and worker lifetime. |
| [`lsr-observability`](skills/lsr-observability/SKILL.md) | `lsr/otel` DI, explicit log storage and opt-in auto-wiring, global SDK ownership, PSR-3 correlation/export, tracing/metrics, OTLP export, and worker flushing. |

### Presentation and localization

| Skill | Use for |
| --- | --- |
| [`lsr-latte-stack`](skills/lsr-latte-stack/SKILL.md) | Server-rendered Latte, typed parameters, LSR tags/functions, extensions, assets, and sandbox rendering. |
| [`lsr-inertia-backend`](skills/lsr-inertia-backend/SKILL.md) | `lsr/inertia` middleware/responses, normalized typed props, partial/deferred/merge/once behavior, opt-in V3 SSR with CSR fallback, and Latte head/body outlets. |
| [`lsr-vue-inertia`](skills/lsr-vue-inertia/SKILL.md) | Optional Vue 3 + TypeScript + Inertia frontend pages, typed props/forms, navigation, layouts, shared state, SSR entrypoints and hydration/fallback. |
| [`lsr-localization`](skills/lsr-localization/SKILL.md) | Native gettext PO/MO catalogs, plurals/contexts/domains, localized routes/Latte, sitemap hreflang alternatives, optional `vue3-gettext` parity, and separation from database-backed multilingual content. |
| [`lsr-text-catalog`](skills/lsr-text-catalog/SKILL.md) | `lsr/text-catalog` + `lsr-text-catalog`: canonical NEON source copy, gettext compilation, typed Vue facades, runtime/compiled Vite modes, HTML safety and SSR isolation. |

## Core principles

The skills intentionally require agents to inspect the application before editing:

- **Installed source is authoritative.** Packages are independently versioned; read `composer.lock`, the frontend lockfile, `vendor/lsr/*` and installed npm exports before using an interface or DI key.
- **Configuration is modular.** Split DI NEON by concern/domain with `includes:`. Register the project `routes` directory once and keep routes in multiple concern-focused files; hostname constraints are separate. Split migration NEON through its own `includes:` tree.
- **Applications own orchestration.** Bootstrap, package selection, service discovery, migration execution, session storage, queue durability, and deployment remain application decisions.
- **Long-running workers reuse memory.** Request/auth/tenant/locale/model state must not leak between RoadRunner requests, jobs, or scheduler runs.
- **The backend owns locale.** Native gettext, localized routes, Latte, Inertia props, optional `vue3-gettext`, `<html lang>`, and browser `Intl` formatting must stay synchronized.
- **Verification crosses the real interface.** Compile the actual container, issue HTTP requests, exercise disposable DB/cache state, run workers/scheduler, and inspect changed UI in a browser.

## Compatibility

The repository tracks the current LSR `0.x` package family and PHP 8.4-era framework source. Because each Composer package releases independently, no skill assumes that all installed packages share one version. Guidance repeatedly points to installed config schemas and source where behavior is version-sensitive.

Domain routing is available since **`lsr/routing` 0.5.0**; automatic host dispatch and domain-aware links, redirects and menus require **`lsr/core` 0.5.0+** as well. Core 0.5 requires routing `^0.5`. Existing `^0.3` / `^0.4` constraints do not accept these releases. The routing skill documents deferred aliases, exact-host matching, attribute precedence and compiled cache format 4; upgrade each application deliberately rather than assuming framework-wide version alignment.

The optional text-catalog pair has its own requirements: `lsr/text-catalog` starts at PHP 8.5, while `lsr-text-catalog` has separate Node/Vue/Vite constraints. Do not infer compatibility from an application's older LSR framework version or require the frontend package for PHP-only catalog use.

Owned database content translations require installed **`lsr/orm` 0.3.23+**: older versions lack `Translations`, `TranslationCollection` and `withTranslations()`. This opt-in relation does not change ordinary relations or migrate application schemas. The [ORM skill](skills/lsr-orm/SKILL.md#owned-locale-keyed-content-0323) covers explicit locale keys, exact editing versus whole-row fallback, schema ownership, batch reads and lifecycle-scoped cache invalidation; UI gettext/NEON catalogs remain separate. Check each application's lock file and installed source before adoption; these instructions do not establish publication or update dependencies.

Named logger DI, recursive storage stacks, per-destination filtering and PSR-20 clocks require **`lsr/logging` 0.3.4+**; `LoggerExtension` and its `services.neon` compatibility wrapper require Nette DI `^3.2`. Explicit OTEL storage and opt-in automatic Logger attachment require **`lsr/otel` 0.1.6+** with that logging API. These exports do not need `ext-opentelemetry` or global SDK registration; do not combine them with PSR-3 hook export. Existing default file output is preserved. See the logging and observability skills before updating each application's dependencies.

The package-owned logger configuration described in these skills is an **unreleased compatible patch set** for Core, DB, ORM and RoadRunner. Verify installed schemas or use explicit Composer path installations; it has not been made available by a version tag or Satis publication. Core/ORM preserve concrete LSR logger contracts, while DB/workers accept PSR-3 implementations. ORM's configurable base storage requires logging `^0.3.2`; default output and public logging helpers are retained. Generic PSR-only Core/ORM contracts remain a later minor-release migration. Application dependencies are not updated by this repository.

Distribution intentionally follows rolling `master` for now; tagged releases and a package-version compatibility matrix are not maintained. Run `npx skills update` to receive the latest reviewed guidance.

The skills themselves contain Markdown instructions only and do not install PHP or frontend dependencies.

## Contributing

Each skill lives at `skills/<skill-name>/SKILL.md` and starts with:

```yaml
---
name: skill-name
description: Clear trigger conditions and covered interfaces.
---
```

When changing a skill:

1. verify claims against current LSR package source, config schema, and tests;
2. distinguish framework behavior from one application's convention;
3. keep examples generic and avoid credentials or private infrastructure;
4. link related skills instead of duplicating large workflows;
5. preserve modular DI, route, and migration guidance;
6. run the repository contract checks and verify Skills CLI discovery:

```sh
npm run validate
npx --yes skills@1.5.23 add . --list
```

GitHub Actions runs both checks for every push and pull request.

Use focused Gitmoji commits according to [`CONTEXT.md`](CONTEXT.md).

## License

[MIT](LICENSE)

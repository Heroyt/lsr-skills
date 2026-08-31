# LSR framework skills

Agent skills for building, maintaining, and reviewing applications based on the independently versioned [LSR framework](https://packages.laserliga.cz) Composer packages.

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
| [`lsr-app-di`](skills/lsr-app-di/SKILL.md) | `App::setupDi()`, Nette extensions/services, modular NEON includes, and container debugging. |
| [`lsr-quality-rules`](skills/lsr-quality-rules/SKILL.md) | Evidence-based LSR review across configuration, interfaces, security, persistence, cache, and long-running state. |

### HTTP and routing

| Skill | Use for |
| --- | --- |
| [`lsr-routing`](skills/lsr-routing/SKILL.md) | Modular route files, groups, middleware, attributes, parameter validators, named/localized routes, and links. |
| [`lsr-request-flow`](skills/lsr-request-flow/SKILL.md) | Route dispatch, controllers, middleware, action argument/model binding, mapped request DTOs, and responses. |
| [`lsr-auth-session`](skills/lsr-auth-session/SKILL.md) | `lsr/auth`, user models, login/register/logout, authorization middleware, sessions, and cookies. |

### Persistence and data

| Skill | Use for |
| --- | --- |
| [`lsr-db`](skills/lsr-db/SKILL.md) | Connection/bootstrap, the DB facade, dibi fluent queries, typed DTO fetches, caching, and transactions. |
| [`lsr-db-migrations`](skills/lsr-db-migrations/SKILL.md) | Domain-split migration includes, definitions/modifications, indexes, foreign keys, views, and installer verification. |
| [`lsr-orm`](skills/lsr-orm/SKILL.md) | Models, primary keys, properties, queries, persistence, relations, model cache, and schema alignment. |
| [`lsr-cache`](skills/lsr-cache/SKILL.md) | File/Redis cache configuration, namespaces, dependencies, tags, invalidation, and commands. |
| [`lsr-serializer-validation`](skills/lsr-serializer-validation/SKILL.md) | Symfony serializer integration, mapping, typed DTOs, validation attributes, request mapping, and DB DTO fetches. |

### Application orchestration

| Skill | Use for |
| --- | --- |
| [`lsr-cqrs`](skills/lsr-cqrs/SKILL.md) | Commands, handlers, query markers, DI resolution, synchronous dispatch, and async adapters. |
| [`lsr-console`](skills/lsr-console/SKILL.md) | Symfony Console DI discovery, `AsCommand`, lazy commands, maintenance commands, and CLI behavior. |
| [`lsr-scheduler`](skills/lsr-scheduler/SKILL.md) | `SchedulerJobInterface`, cron/periodic triggers, scheduled commands, shared state/locks, and supervision. |
| [`lsr-async-jobs`](skills/lsr-async-jobs/SKILL.md) | RoadRunner task payloads/dispatchers, `TaskProducer`, serializers, acknowledgement, retries, and async CQRS. |
| [`lsr-roadrunner-runtime`](skills/lsr-roadrunner-runtime/SKILL.md) | DI + `.rr.yaml`, HTTP/jobs workers, RPC/queues, process supervision, and long-running isolation. |
| [`lsr-logging`](skills/lsr-logging/SKILL.md) | PSR-3/LSR logging, DI, structured context, redaction, storage/formatting, worker lifetime, and operations. |

### Presentation and localization

| Skill | Use for |
| --- | --- |
| [`lsr-latte-stack`](skills/lsr-latte-stack/SKILL.md) | Server-rendered Latte, typed parameters, LSR tags/functions, extensions, assets, and sandbox rendering. |
| [`lsr-inertia-backend`](skills/lsr-inertia-backend/SKILL.md) | `lsr/inertia` middleware/responses, typed props, partial/deferred/merge/once behavior, and the Latte shell. |
| [`lsr-vue-inertia-shadcn`](skills/lsr-vue-inertia-shadcn/SKILL.md) | Optional Vue 3 + TypeScript + Inertia frontend work and project-configured shadcn-vue integration. |
| [`lsr-localization`](skills/lsr-localization/SKILL.md) | Native gettext PO/MO catalogs, plurals/contexts/domains, localized routes/Latte, and optional `vue3-gettext` parity. |

## Core principles

The skills intentionally require agents to inspect the application before editing:

- **Installed source is authoritative.** LSR packages are independently versioned; read `composer.lock` and `vendor/lsr/*` before using an interface or DI key.
- **Configuration is modular.** Split DI NEON by concern/domain with `includes:`. Register the project `routes` directory once and keep routes in multiple domain files. Split migration NEON through its own `includes:` tree.
- **Applications own orchestration.** Bootstrap, package selection, service discovery, migration execution, session storage, queue durability, and deployment remain application decisions.
- **Long-running workers reuse memory.** Request/auth/tenant/locale/model state must not leak between RoadRunner requests, jobs, or scheduler runs.
- **The backend owns locale.** Native gettext, localized routes, Latte, Inertia props, optional `vue3-gettext`, `<html lang>`, and browser `Intl` formatting must stay synchronized.
- **Verification crosses the real interface.** Compile the actual container, issue HTTP requests, exercise disposable DB/cache state, run workers/scheduler, and inspect changed UI in a browser.

## Compatibility

The repository tracks the current LSR `0.x` package family and PHP 8.4-era framework source. Because each Composer package releases independently, no skill assumes that all installed packages share one version. Guidance repeatedly points to installed config schemas and source where behavior is version-sensitive.

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
6. list the catalog locally and smoke-test installation:

```sh
npx skills add . --list
npx skills add . --skill lsr-framework-orchestration --agent '*' --yes
```

Use focused Gitmoji commits according to [`CONTEXT.md`](CONTEXT.md).

## License

[MIT](LICENSE)

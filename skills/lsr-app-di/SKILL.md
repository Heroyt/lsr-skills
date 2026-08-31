---
name: lsr-app-di
description: Use for LSR application bootstrap, Nette DI services, config files, constants, service discovery, injected controller properties, and container/cache cleanup.
---

# LSR App + DI Workflow

## Read First

- Config entrypoint: `config/services.php`.
- Shared DI config: `config/di/services-common.neon`.
- Production/debug DI: `config/di/services.neon`, `config/di/servicesDebug.neon`.
- Local overrides: `config/di/services.local.neon`, `config/di/services.local.neon.dist`, `private/config.neon`.
- Constants: `config/di/constants.php`, `include/constants.php`.
- Bootstrap/load: `include/load.php`, `include/config.php`, `src/Core/Loader.php`.
- LSR app API: `vendor/lsr/core/src/App.php`.

## DI Structure

- Keep framework extension includes under `config/di/extensions/*.neon`.
- Keep grouped app config under `config/di/configs/*.neon` when it belongs to a specific subsystem.
- Use `services-common.neon` for shared wiring that applies to production and debug.
- For domain-level separation in larger apps, create a domain-specific NEON file and include it from `services-common.neon`.
- Use `services.neon` and `servicesDebug.neon` only for environment-specific setup.
- Use `services.local.neon` or `private/config.neon` for machine/private overrides.
- Do not hard-code environment-specific secrets into committed config.

## Service Registration

- Prefer constructor injection for ordinary services, commands, CQRS handlers, jobs, and controllers.
- Auto-discover broad technical-layer services when there is a stable directory/interface pattern, especially controllers, CLI commands, CQRS command handlers, and CQRS query services.
- Explicitly define specific services in NEON when they need a stable service name, custom factory/setup, scalar constructor args, or domain-specific wiring.
- Controllers extend `Lsr\Core\Controllers\Controller` and are auto-discovered from `src/Http/Controllers`.
- Controller properties using Nette `#[Inject]` require the controller decorator/inject setup in `services-common.neon`.
- Use explicit service names when other code references a name, for example RoadRunner task DI names.

## Service Lookup

- Prefer constructor injection when adding new code.
- Existing bootstrap/config files may use `App::getService(...)`, `App::getServiceByType(...)`, or `App::getContainer()`.
- When looking up a service by name, assert or type-check the result before use.
- Avoid service locator calls inside domain/application services unless the LSR package API expects them.

## Cache and Container Cleanup

- DI/container changes may require clearing generated container files.
- Console commands supplied by `lsr/console` include:

```sh
php ./bin/console container:clean
php ./bin/console cache:clean
```

- `cache:clean` also has alias `cache:clear` and supports repeated `--tag` / `-t` options, but it is an operational/troubleshooting command. Automated tests should not rely on manually cleaning cache.

## Validation

```sh
composer phpstan
composer cs
php ./bin/console
```

---
name: lsr-app-di
description: Use for LSR application bootstrap, Nette DI extensions, modular NEON configuration, service registration, container lookup, and generated-container cleanup.
---

# LSR Application and DI

## Establish the Installed Version

1. Read the application's `composer.json` and `composer.lock`.
2. Read `config/services.php`; `Lsr\Core\App::setupDi()` loads the config files returned by this file.
3. Read every root NEON file returned by `config/services.php` and follow its `includes:` recursively.
4. Inspect the installed extension classes under `vendor/lsr/*/src/{DI,Di}` before adding configuration keys. LSR packages are independently versioned and their schemas can differ.
5. Read the application's bootstrap entrypoints before changing startup order.

Do not copy paths, service names, or parameters from another LSR application without checking the local container configuration.

## Keep DI Configuration Modular

Do not grow one application-wide NEON file. Keep root files as indexes and split stable concerns into focused files:

```neon
# config/services-common.neon
includes:
	- di/database.neon
	- di/http.neon
	- di/console.neon
	- di/jobs.neon
	- di/features/tournaments.neon
```

Nette resolves relative `includes:` paths from the including NEON file and detects recursive includes. Prefer:

- one shared root included by environment roots;
- one file per technical concern or domain with coherent services and parameters;
- environment files containing only environment differences;
- uncommitted/private files for credentials and machine overrides.

Example environment roots:

```neon
# config/services.neon
includes:
	- services-common.neon
	- di/production.neon
```

```neon
# config/servicesDebug.neon
includes:
	- services-common.neon
	- di/debug.neon
```

Register a directory once; do not repeat individual services in a central file when Nette's search extension already owns that convention.

## Package Extensions

Register only installed packages. Current extension classes include:

```neon
extensions:
	cache: Lsr\Caching\DI\CacheExtension
	console: Lsr\Console\Di\ConsoleExtension
	cqrs: Lsr\CQRS\DI\CqrsExtension
	inertia: Lsr\Inertia\DI\InertiaExtension
	lsr: Lsr\Core\DI\LsrExtension
	orm: Lsr\Orm\DI\OrmExtension
	request: Lsr\Core\Requests\DI\RequestExtension
	roadrunner: Lsr\Roadrunner\DI\RoadrunnerExtension
	routing: Lsr\Core\Routing\DI\RoutingExtension
	scheduler: Lsr\Scheduler\Di\SchedulerExtension
	serializer: Lsr\Serializer\DI\SerializerExtensions
```

Some packages ship a `vendor/lsr/<package>/services.neon`; others expose only an extension. Include package config when it matches the installed package, otherwise register the extension and services explicitly. Define each extension name once across the complete include graph.

The core `lsr` extension requires valid `appDir` and `tempDir` values. Read `Lsr\Core\DI\LsrExtension::getConfigSchema()` for the installed options.

## Service Registration

- Prefer constructor injection and autowiring for application modules.
- Register commands, CQRS handlers, middleware, task dispatchers, and scheduler jobs as DI services.
- Use explicit service names when framework configuration or a runtime payload resolves by name. RoadRunner task names are one example.
- Use scalar constructor arguments from typed parameters, not hidden global reads.
- Use Nette `#[Inject]` property injection only where the application intentionally enables `InjectExtension`; constructor injection remains the default.
- Keep service discovery rules near the concern they discover, not in an unrelated central config.

## Container Access

Prefer injected dependencies. At bootstrap or framework integration seams, these installed core methods are available:

- `App::getContainer()`
- `App::getService($name)`
- `App::getServiceByType($type)`
- `App::findServicesByType($type)`

Treat service-locator use inside application/domain modules as a design smell. When lookup by name or type is unavoidable, assert the returned interface before use.

## Generated Container and Cache

After DI changes, use the commands actually registered by the installed packages:

```sh
php bin/console container:debug
php bin/console container:clean
php bin/console config:cache:clean
php bin/console latte:cache:clean
```

`lsr/cache` separately provides `cache:clean`; `lsr/orm` provides `orm:cache:clean`. Do not use broad cache clearing as a substitute for correct configuration or invalidation.

## Verification

1. Run the application's narrow static-analysis and coding-standard commands from `composer.json`.
2. Run `php bin/console container:debug` or list commands to force container compilation.
3. Exercise the relevant HTTP, console, worker, or scheduler entrypoint. Container compilation alone does not prove runtime initialization order.

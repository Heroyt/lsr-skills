---
name: lsr-cache
description: Use for LSR cache configuration, Nette cache dependencies, file or Redis storage, namespace isolation, bulk loading, tag invalidation, query/model caching, and cache commands.
---

# LSR Cache

## Establish the Storage

Read the installed `lsr/cache` package and application DI before changing behavior:

- `vendor/lsr/cache/src/Cache.php`
- `vendor/lsr/cache/src/DI/CacheExtension.php`
- `vendor/lsr/cache/src/Redis/{RedisStorage,RedisJournal}.php`
- the application's cache NEON file and Redis services

Do not assume Redis. `CacheExtension` currently defaults to Nette file storage and requires `cacheDir`; Redis is an explicit application service choice.

Example extension configuration:

```neon
extensions:
	cache: Lsr\Caching\DI\CacheExtension

cache:
	cacheDir: %constants.tempDir%
	namespace: my-app
	debug: false
	commands: true
```

Read the installed schema for supported keys. Keep this config in a focused cache NEON file included by the shared root.

## Redis Isolation

When multiple application caches share Redis/KeyDB, give storage and journal the same application-specific namespace:

```php
$journal = new RedisJournal($redis, 'arena-control:cache:');
$storage = new RedisStorage($redis, 'arena-control:cache:', $journal);
```

Current Redis full-clean behavior deletes values tracked for that storage prefix and metadata owned by the journal namespace. It does not use `FLUSHALL`. Never replace this with broad Redis/database clearing on a shared instance.

Legacy values created before ownership tracking may require a one-time, application-aware maintenance cleanup. Do not guess which unprefixed keys are safe to delete.

## Loading and Dependencies

```php
$value = $cache->load(
	$key,
	static function (?array &$dependencies = null): Result {
		$dependencies = [
			Cache::Expire => '10 minutes',
			Cache::Tags => ['articles'],
		];
		return loadResult();
	},
);
```

`Lsr\Caching\Cache` extends Nette cache. Use Nette dependency constants such as `Expire`, `Tags`, `All`, `Files`, and `Callbacks` as supported by the storage.

`bulkLoad($keys, $generator)` uses storage bulk reads when available and otherwise falls back to individual loads. The generator receives the requested key and dependency reference. Use it for real batches, not as a more complicated spelling of one load.

## Invalidation

- Prefer deterministic keys and tag-based invalidation.
- Include tenant, user, locale, permission, and other visibility scope in the key when the value varies by that scope.
- Tag DB projections with every table/model they depend on.
- If the application model base uses `WithCacheClear`, preserve its table/query/instance/relation tags.
- Raw DB writes must explicitly invalidate every affected cache contract.
- Do not make tests pass by calling a global cache clear; fix ownership and invalidation.

## Commands

When Symfony Console is installed and `commands: true`, the cache extension registers:

```sh
php bin/console cache:clean
php bin/console cache:clear
php bin/console cache:clean --tag=articles --tag=articles/query
```

`lsr/orm` separately registers `orm:cache:clean` when enabled. Core/container/Latte generated caches use their own commands.

## Verification

- Test miss -> generate -> hit behavior.
- Test the exact invalidating write and confirm the next read regenerates.
- For user/tenant/locale-scoped data, prove two scopes cannot see each other's cached value.
- For Redis, use a disposable namespace and verify full clean preserves unrelated keys.
- Run the application's cache tests and static analysis.

---
name: lsr-cache
description: Use for LSR app caching with lsr/cache, Redis storage, Cache::load/clean, model cache clearing, query cache tags, and operational cache:clean.
---

# LSR Cache Workflow

## Read First

- Cache config: `config/di/extensions/cache.neon`.
- Cache wrapper: `vendor/lsr/cache/src/Cache.php`.
- Redis storage: `vendor/lsr/cache/src/Redis/RedisStorage.php`, `RedisJournal.php`.
- App base model: `src/Models/BaseModel.php`.
- Model cache trait: `vendor/lsr/core/src/Models/WithCacheClear.php`.
- DB fluent cache helpers: `vendor/lsr/db/src/Dibi/FetchFunctions.php`.
- Cache clean command: `vendor/lsr/console/src/Commands/Cache/CacheCleanCommand.php`.

## Cache Service

- Inject or fetch `Lsr\Caching\Cache` as service `cache`.
- The app config uses Redis storage through `cache.storage`.
- `Cache::load($key, $generator, $dependencies)` reads or generates cache values.
- `Cache::bulkLoad(...)` supports efficient multi-key reads when storage implements bulk reading.
- Dependencies follow Nette cache dependency keys such as `Expire`, `Tags`, and `All`.

## Model Cache

- App-owned models extend `App\Models\BaseModel`.
- `BaseModel` uses `Lsr\Core\Models\WithCacheClear`.
- Model insert/update/delete clears tags:
  - `Model::TABLE`
  - `Model::TABLE . '/query'`
  - `Model::TABLE . '/' . $id`
  - `Model::TABLE . '/' . $id . '/relations'`
  - any extra tags from `getCacheTags()` if the model provides it.
- `Model::query()` automatically tags model query cache with model/table tags.

## DB Query Cache

- DB fluent fetches cache by default.
- Pass `cache: false` for fresh reads.
- Add model table tags to DB facade queries that depend on model data:

```php
DB::select(Item::TABLE, '*')
    ->where('id_item = %i', $id)
    ->cacheTags(Item::TABLE)
    ->fetch();
```

- Relation queries should add relation-specific tags when available:

```php
->cacheTags(Item::TABLE, Item::TABLE . '/' . $id . '/relations')
```

## Cleaning Cache

- `cache:clean` is for operations and troubleshooting. Automated tests should not rely on manually cleaning cache.
- Clean all system cache:

```sh
php ./bin/console cache:clean
```

- Alias:

```sh
php ./bin/console cache:clear
```

- Clean only tagged records:

```sh
php ./bin/console cache:clean --tag=playlists --tag=playlists/query
```

## Rules

- Prefer tag-based invalidation over broad cache clears in application code.
- Keep cache keys deterministic and scoped by feature/entity.
- Do not cache user-specific or permission-specific data without including the user/permission scope in the key or tags.
- If a DB facade query depends on ORM model data, add the model table tag so model updates invalidate it.

## Validation

```sh
composer phpstan
composer cs
```

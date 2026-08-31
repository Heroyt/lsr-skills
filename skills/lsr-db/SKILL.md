---
name: lsr-db
description: Use for LSR app database work with the Lsr\Db\DB facade and the dibi/dibi-based fluent query builder, including transactions, DTO fetching, caching, and raw SQL.
---

# DB Facade + Dibi Fluent Workflow

## Read First

- DB config: `config/di/services-common.neon` parameter `db`.
- Facade: `vendor/lsr/db/src/DB.php`.
- Connection wrapper: `vendor/lsr/db/src/Connection.php`.
- Fluent wrapper: `vendor/lsr/db/src/Dibi/Fluent.php`.
- Fetch helpers: `vendor/lsr/db/src/Dibi/FetchFunctions.php`.
- Migrations: `config/migrations/migrations.neon`.

## Facade Basics

- Use `Lsr\Db\DB` for database access.
- Common methods include `select`, `insert`, `insertGet`, `insertIgnore`, `update`, `delete`, `query`, `begin`, `commit`, `rollback`, and `transaction`.
- Dibi placeholders are available in SQL fragments; use placeholders instead of manual interpolation.
- Use `%n` for identifiers, `%s` for strings, `%i` for integers, and `%SQL` only for vetted SQL fragments.

## Fluent Queries

```php
$row = DB::select('users', '*')
    ->where('email = %s', $email)
    ->fetch();
```

- `DB::select($table, ...$fields)` returns `Lsr\Db\Dibi\Fluent`.
- For the `DB::select()` FROM table, use `[Model::TABLE, 'alias']` when an alias is needed because later arguments are the SELECT clause. For joins, do not use array alias syntax: use `->join(Model::TABLE, 'alias')` / `->leftJoin(Model::TABLE, 'alias')`. `->join([Model::TABLE, 'alias'])` generates invalid SQL like `table, alias`.
- Chain `where`, `join`, `leftJoin`, `on`, `groupBy`, `having`, `orderBy`, `limit`, and `offset` as needed.
- Use `fetch()` for one row, `fetchSingle()` for one scalar, `fetchAll()` for rows, and `fetchIterator()` for large result sets.
- Use `fetchDto(ClassName::class)` / `fetchAllDto(ClassName::class)` for DTO mapping through the serializer mapper.

## Caching

- Fluent fetches cache by default.
- Pass `cache: false` to fetch helpers for fresh reads:

```php
$row = DB::select('users', '*')->where('id_user = %i', $id)->fetch(cache: false);
```

- Use `cacheTags(...)` for invalidation grouping and `cacheExpire(...)` for custom expiry.
- ORM models are tagged automatically through model/cache handling.
- Specific DB facade queries should add model table tags they depend on, usually `Model::TABLE`, so model updates clear related query cache automatically.
- Relation queries should also add relation-specific tags when available, for example `Model::TABLE . '/' . $id . '/relations'`.
- Writes through DB facade do not automatically document feature-level cache intent; clear or tag caches deliberately where required.

## Writes and Transactions

- Use array data for inserts/updates:

```php
DB::insert('table_name', ['name' => $name]);
DB::update('table_name', ['name' => $name], ['id = %i', $id]);
```

- Wrap multi-step writes in `DB::transaction()` or explicit `begin` / `commit` / `rollback`.
- The `Connection::transaction()` callback must return `true` to commit and `false` to roll back.

## Choosing DB vs ORM

- Use `Lsr\Orm\Model` for aggregate/entity lifecycle code.
- Use `DB` facade for reporting, projections, aggregate reads, bulk operations, and DTO queries.
- Keep raw SQL contained and typed at boundaries.

## Validation

```sh
composer phpstan
composer cs
php ./bin/console install
```

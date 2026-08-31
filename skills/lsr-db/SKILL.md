---
name: lsr-db
description: Use for LSR database setup and access with Lsr\Db\Connection, the DB facade, dibi fluent queries, typed DTO fetches, caching, named connections, and transactions.
---

# LSR Database

## Establish the Local Setup

- Read `composer.lock` for the installed `lsr/db` version.
- Find the DI definition for `Lsr\Db\Connection` and the bootstrap call to `Lsr\Db\DB::init()`.
- Read `vendor/lsr/db/src/{DB,Connection}.php` and `src/Dibi/{Fluent,FetchFunctions}.php` before using an unfamiliar option.
- Read cache and serializer wiring because the connection requires `Lsr\Caching\Cache` and `Lsr\Serializer\Mapper`.

Creating a `Connection` service is not enough. The static facade must be initialized once after the container is available:

```php
$connection = App::getServiceByType(Lsr\Db\Connection::class);
assert($connection instanceof Lsr\Db\Connection);
Lsr\Db\DB::init($connection);
```

Keep this in the application bootstrap, not in request handlers. Named connections use `DB::initNamed()` and an explicit connection selection policy.

## Connection Configuration

`Connection` accepts a configuration array. Current options include `driver`, host/port/database credentials, `dsn`, `pdoDriver`, `options`, `prefix`, `lazy`, and `strictSelectForUpdate`. Treat credentials as private runtime configuration.

Use an explicit PDO driver/DSN for non-MySQL databases. Read `Connection::normalizeConfig()` in the installed package rather than guessing DSN behavior.

## Fluent Reads

```php
$user = DB::select('users', 'id_user, email')
	->where('[email] = %s', $email)
	->cacheTags('users')
	->fetchDto(UserRow::class);
```

- Use dibi placeholders: `%n` for identifiers, `%s` for strings, `%i` for integers, and `%SQL` only for intentionally composed SQL.
- `DB::select($table, ...$fields)` treats later arguments as selected fields. Use `[Model::TABLE, 'alias']` for the initial table alias.
- Use `->join(Model::TABLE, 'alias')` / `->leftJoin(...)` for join aliases; array alias syntax in `join()` is not the same interface.
- Prefer `fetchDto()` / `fetchAllDto()` for projections crossing a module interface.
- Available fetch forms also include `fetch`, `fetchSingle`, `fetchIterator`, `fetchAssoc`, `fetchPairs`, `exists`, and DTO variants.
- Alias SQL columns to DTO property names explicitly.

Fluent fetches cache by default. Use `cache: false` only for reads that require fresh state:

```php
$row = DB::select('users', '*')
	->where('[id_user] = %i', $id)
	->fetch(cache: false);
```

Tag cached projections with every table/entity whose change invalidates the result. Do not depend on a broad operational cache clear.

## Writes

```php
DB::insert('users', ['email' => $email]);
DB::update('users', ['email' => $newEmail], ['id_user = %i', $id]);
DB::delete('users', ['id_user = %i', $id]);
```

- Prefer ORM lifecycle operations when model validation, relations, hooks, and cache invalidation are part of the change.
- Use the DB facade for projections, aggregates, bulk operations, atomic SQL expressions, migrations, and lock-sensitive operations.
- Raw writes do not automatically know application-level cache dependencies. Invalidate the affected tags explicitly.
- Never interpolate request/user values into SQL strings.

## Transactions

`Connection::transaction()` expects a callback returning `bool`: `true` commits, `false` rolls back, and an exception rolls back then rethrows.

```php
DB::transaction(static function (Connection $connection): bool {
	// coordinated writes
	return true;
});
```

The method returns `void`; return application results through an outer variable or a deeper application module, not by assuming the callback result is returned. Explicit `begin`, `commit`, and `rollback` support nested savepoints.

## Verification

- Run the smallest query against a disposable/test database and assert the returned DTO/value.
- For writes, verify commit and rollback paths plus cache visibility.
- Run the project's DB tests, static analysis, and coding-standard command.
- When changing connection configuration, exercise the real application entrypoint so bootstrap initialization is covered.

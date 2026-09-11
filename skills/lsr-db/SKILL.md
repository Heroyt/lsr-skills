---
name: lsr-db
description: Use for LSR database setup and access with Lsr\Db\Connection, the DB facade, dibi queries, configurable PSR-3 logging, typed DTO fetches, caching, named connections, transactions, and opt-in MySQL reconnects.
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

`Connection` accepts a configuration array. Current options include `driver`, host/port/database credentials, `dsn`, `pdoDriver`, `options`, `prefix`, `lazy`, `strictSelectForUpdate`, and (since `lsr/db` 0.3.15) `autoReconnect`. Treat credentials as private runtime configuration.

Use an explicit PDO driver/DSN for non-MySQL databases. Read `Connection::normalizeConfig()` in the installed package rather than guessing DSN behavior.

## Package Logger Selection

Configurable logger integration is available since **`lsr/db` 0.3.17**. Check the installed version, `DbExtension` schema and `Connection`/`DB` signatures before using it; older published versions do not contain these options.

```neon
# Supplement existing connection definitions.
db:
    logger: @logging.loggers.app
    connections:
        reporting:
            logger: @logging.loggers.imports
```

The named logger services are configured through [lsr-logging](../lsr-logging/SKILL.md), or may be any other PSR-3 implementation. Connection-level selection takes precedence over the package-level logger. Omitted settings preserve the lazy `LOG_DIR`/`db` file logger; an unrelated global autowired logger does not replace that default. Logger references are DI configuration, not driver options.

`Lsr\Db\Logging\DibiEventLogger` translates Dibi failures into PSR-3 records. It preserves the existing error summary and optional SQL debug record, not a new stream of successful queries. SQL can contain secrets; select an appropriate destination/filter and avoid production debug collection of sensitive queries. Synchronous logging failures keep their existing propagation behavior.

The logging package's `Logger::logDb()` remains an application compatibility helper, but DB internals no longer require it. Use the optional logger argument shown by the installed `Connection`/factory signatures for standalone construction; do not change existing positional arguments. Test actual SQL failures against a disposable database with both the default logger and a non-LSR PSR logger.

## Idle MySQL Connections in Long-Running Processes

RoadRunner, jobs, and scheduler processes can retain the same connection after the server closes an idle socket. Dibi's `isConnected()` only indicates that a driver exists; it is not a liveness check.

Starting with `lsr/db` **0.3.15**, opt in per connection with `autoReconnect: true`. It defaults to **false**. Inspect the installed package version and the application's existing connection configuration before enabling it.

For an application that passes `%db%` directly to `Connection`, add the option to that existing parameter:

```neon
parameters:
	db:
		autoReconnect: true
```

For the optional `Lsr\Db\DI\DbExtension`, add it to the intended connection:

```neon
db:
	connections:
		main:
			autoReconnect: true
```

These are additions to existing configuration, not complete connection definitions. PHP callers can add `'autoReconnect' => true` to the array passed to `Connection` or `DB::createConnection()`. `DB_autoReconnect=true` is read only by `DB::getMain()` when it builds configuration from the environment; it does not override an explicit array or DI configuration.

### Recovery Contract

- Supported drivers are MySQLi and PDO-MySQL. Other database drivers are unchanged.
- Package query/write helpers and LSR fluent execution/fetch/count paths check health before submitting SQL outside a managed transaction. Cache hits do not execute a database health check.
- The check adds one server round trip per executed operation outside a managed transaction: MySQLi uses `stat()` rather than deprecated `ping()`; PDO-MySQL uses `SELECT 1`.
- A health-check connection loss (MySQL codes `2006`, `2013`, or `2055`) triggers one disconnect/connect attempt. A failed reconnect propagates; there is no retry loop.
- The same Dibi connection object is retained, so existing fluent builders, substitutions, and lifecycle listeners remain attached.
- An application statement that loses its connection is **never replayed** by this mechanism. Syntax/constraint errors propagate without reconnecting. Cached fetches must not treat a database exception as a cache failure and rerun the SQL.

### Safety Limits

- Manage transactions through `Connection`/`DB` `begin()`, `commit()`, `rollback()`, or `transaction()`. No reconnect occurs while a managed transaction or nested scope remains active.
- A failed commit does not clear transaction tracking. On connection loss, unwind with rollback; the outermost failed rollback discards the dead connection when reconnect is enabled, allowing later work to establish a fresh session.
- `transaction()` preserves the original callback/commit exception even if rollback also fails. A caught nested failure does not make the outer transaction safe to continue. `close()` discards connection/transaction state; it never commits unfinished work.
- Raw Dibi/native-handle access, retained native resources, and raw SQL transaction control are outside the guarantee. Do not enable automatic reconnect for flows relying on these or on connection-scoped session state.
- Temporary tables, advisory locks, session variables, and other session state cannot be restored by reconnecting. A disconnect during SQL execution can leave its outcome unknown; do not blindly replay writes, transaction callbacks, or entire jobs.

Use `lsr-roadrunner-runtime` and `lsr-scheduler` for process lifecycle and supervision. Package-level reconnect does not install a worker lifecycle hook or require closing/reopening the DB on every request.

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
- For reconnect changes, kill an idle session or expire `wait_timeout` on a disposable MySQL/MariaDB server. Verify reads, writes, prebuilt fluent queries, and insert ID/affected-row metadata with both MySQLi and PDO-MySQL.
- Kill a query during execution and a connection inside nested transactions: the operation must fail without replay or partial continuation, preserve the original exception, and allow fresh work only after transaction unwind.
- Verify opt-out, a failed reconnect, and ordinary SQL errors. Do not use a production database for these checks.
- In the package checkout, the MySQL tests opt in via `LSR_DB_TEST_PORT=<port> vendor/bin/phpunit --no-coverage`, targeting `127.0.0.1`, database `reconnect_test`, and a disposable root account with an empty password. Without the variable, those integration cases skip.

---
name: lsr-db-migrations
description: Use for LSR app database schema work, including config/migrations NEON files, table definitions, versioned modifications, indexes, foreign keys, views, and install/update behavior.
---

# LSR DB Migration Workflow

## Read First

- Root migration file: `config/migrations/migrations.neon`.
- Installer: `src/Install/DbInstall.php`, called through `src/Install/Install.php` and `php ./bin/console install`.
- Migration DTO/loader reference: `vendor/lsr/core/src/Migrations/MigrationLoader.php`, `Migration.php`, `Index.php`, `ForeignKey.php`.
- Existing models: `src/Models`, plus package-provided auth models from `vendor/lsr/auth`.

## Format

Migration files are NEON. This repo currently uses one app migration file:

- `includes`: migration files loaded before app tables, currently `vendor/lsr/auth/migrations.neon`.
- `tables`: map of table keys to schema data.
- `views`: optional map of view names to SQL `SELECT` definitions.

Table keys may be literal table names or model class names. If the key is a class extending `Lsr\Orm\Model`, `DbInstall` resolves the real DB table from the model `TABLE` constant.

App-owned ORM model conventions:

- SQL table and column names use `snake_case`.
- ORM properties use `camelCase`.
- Table names use plural snake_case model names, for example `Playlist` -> `playlists`.
- Primary keys use `id_{model}` in singular snake_case, for example `id_playlist`.
- The model must explicitly define both `public const string TABLE = '...'` and `#[PrimaryKey('...')]`.

Table data supports:

- `order`: table creation ordering only. Lower numbers are created earlier; when tables depend on each other, assign values so dependencies are created first, in descending dependency order. Tables with no dependency between them may use the same order.
- `definition`: full `CREATE TABLE` body. Define only the primary key here, plus unsupported key types that cannot be represented in `indexes` or `foreignKeys`, for example spatial keys.
- `modifications`: map of schema version to `ALTER TABLE` fragments.
- `indexes`: list with `name`, `columns`, optional `unique`, optional `pk`.
- `foreignKeys`: list with `column`, `refTable`, `refColumn`, optional `onDelete`, optional `onUpdate`.

## Rules

- Put app schema in `config/migrations/migrations.neon` unless the app grows a clear domain split.
- For a brand-new table, write the full current `definition`; do not rely on modifications to create its initial shape.
- For an existing table, update the `definition` to the final schema and add a new `modifications` version with the needed `ALTER TABLE` fragments.
- Use a new monotonically increasing semantic version under that table, compatible with PHP `version_compare()`. Do not reuse an existing version key for a different historical change.
- `modifications` versions do not have to follow a global app or package version. They may represent only that table's local schema version; using a shared global version is also acceptable when it improves release semantics.
- Use the special `always` modifications key only for idempotent `ALTER TABLE` fragments that must run on every non-fresh install. `always` bypasses version comparison and does not update the stored table version.
- `modifications` values are `ALTER TABLE` fragments. Do not include `ALTER TABLE table_name`; `DbInstall` adds that.
- Prefer safe defaults for non-null columns on existing tables.
- Define indexes only in `indexes`. Do not define regular, unique, or composite indexes in `definition` or `modifications`.
- Define foreign keys only in `foreignKeys`. Do not define foreign keys in `definition` or `modifications`.
- Only primary keys belong in `definition`. Unsupported key types that cannot be represented by `indexes` or `foreignKeys`, for example spatial keys, may be defined in `definition` for new tables or `modifications` for existing tables.
- The installer creates missing listed indexes and foreign keys separately, and drops undefined non-primary indexes.
- Keep `views` as `SELECT` bodies only; the installer wraps them in `CREATE OR REPLACE VIEW`.
- When changing an ORM model property that maps to DB schema, update the matching migration in the same change.
- Keep table definitions, foreign keys, model `TABLE` constants, and `#[PrimaryKey]` attributes consistent.

## Installer Workflow

`DbInstall` applies migrations in this order:

- Load included migration files and app migrations, merge them, resolve model class table names, and sort tables by `order`.
- On `install --fresh`, drop tables in reverse creation order, then recreate them from `definition`.
- Create every table with `CREATE TABLE IF NOT EXISTS` from the current `definition`.
- On non-fresh installs, read each table's stored `db_version`, run newer `modifications` fragments through `ALTER TABLE`, run `always` fragments every time, then store the highest processed version for that table.
- Reconcile listed indexes after table modifications. If an index listed in `indexes` already exists by name, it is left in place; otherwise the installer creates it as a normal or unique index.
- Reconcile listed foreign keys after indexes. If exactly one matching relation already exists, it is left in place. If multiple matching foreign keys exist for the same relation, duplicate constraints are detected and removed, leaving one relation.
- Remove undefined non-primary indexes after listed indexes and foreign keys are checked. The installer preserves `PRIMARY` and the names from `indexes`; it also tracks foreign-key columns because MySQL creates supporting indexes for them. An undefined index that is still needed by a foreign key is skipped if MySQL rejects the drop.
- Recreate views from `views` with `CREATE OR REPLACE VIEW`.

## Validation

Use the smallest useful validation:

```sh
php -l src/Install/DbInstall.php
composer phpstan
php ./bin/console install
```

For fresh-install compatibility, use only a disposable database:

```sh
php ./bin/console install --fresh
```

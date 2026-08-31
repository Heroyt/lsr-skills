---
name: lsr-orm
description: Use for LSR app model work with lsr/orm, including Model subclasses, primary keys, relations, querying, saving, caching, and migration alignment.
---

# LSR ORM Workflow

## Read First

- Existing app models: `src/Models`.
- Base app model: `src/Models/BaseModel.php`.
- Current app model examples: `src/Models/Auth/User.php`, temporary example `src/Models/Playlist.php`.
- Package APIs: `vendor/lsr/orm/src/Model.php`, `ModelQuery.php`, `ModelRepository.php`, `Attributes`, `ModelTraits`.
- DB migrations: `config/migrations/migrations.neon`.

## Model Shape

- App-owned models extend `App\Models\BaseModel`; `BaseModel` extends `Lsr\Orm\Model` and adds cache clearing through `Lsr\Core\Models\WithCacheClear`.
- Extend package models only when customizing package behavior, such as the auth `User` model.
- Always define `public const string TABLE = 'plural_snake_case_table';` on app-owned models. Table names are not resolved automatically.
- Always set `#[Lsr\Orm\Attributes\PrimaryKey('id_model')]` on app-owned models. Primary keys are not resolved automatically.
- SQL columns use `snake_case`; PHP ORM properties use `camelCase`.
- Table names use the plural snake_case form of the PascalCase model name, for example `Playlist` -> `playlists`.
- Primary keys use `id_{model}` in singular snake_case, for example `id_playlist`; foreign keys should use the same column name in related tables.
- Public properties map to DB columns. CamelCase properties can map to snake_case columns through the ORM fetch/save logic.
- Use `#[Lsr\Orm\Attributes\NoDB]` for runtime-only properties and `#[Lsr\Orm\Attributes\JsonExclude]` for serialization exclusions.
- Use object validation attributes on model properties when they should be enforced by `save()`.

## Loading and Querying

- Use `Model::get($id)` to load by primary key; it participates in `ModelRepository` instance caching.
- Use `Model::query()` for fluent model queries:

```php
$items = Item::query()
    ->where('active = %i', 1)
    ->orderBy('created_at')
    ->desc()
    ->get();
```

- Use `first()` for a nullable single model, `get()` for an array keyed by primary key, and `count()` for counts.
- Use `cacheTags(...)` on model queries when a feature needs additional cache invalidation grouping.

## Saving

- Create a new model, assign validated public properties, then call `$model->save()`.
- `save()` wraps insert/update in a DB transaction and calls validation.
- For loaded models, `save()` updates changed DB-backed properties and relations.
- Use timestamp traits such as `WithCreatedAt` / `WithUpdatedAt` only when the table has matching columns.

## Relations

- Relation attributes are available under `Lsr\Orm\Attributes\Relations`: `ManyToOne`, `OneToOne`, `OneToMany`, `ManyToMany`.
- Prefer explicit relation attributes over manual ID juggling when the model is the aggregate boundary.
- For custom relation loaders or DB facade relation queries, add cache tags that include the relevant model table tag and, when appropriate, relation tags such as `Model::TABLE . '/' . $id . '/relations'`.
- For large read-only screens, consider DB facade/DTO queries instead of hydrating broad object graphs.

## Schema Alignment

- Every DB-backed model property must match the schema in `config/migrations/migrations.neon`.
- When adding a model or changing columns, update migrations in the same change.
- If a migration table key uses a model class, `DbInstall` resolves the actual table from the model `TABLE` constant.
- Keep migration table names and foreign key names aligned with the explicit `TABLE` constant and `#[PrimaryKey]` value.

## Validation

```sh
composer phpstan
composer cs
php ./bin/console install
```

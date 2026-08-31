---
name: lsr-orm
description: Use for LSR ORM models, model configuration, primary keys, typed properties, querying, persistence, relations, serialization, validation, and model cache behavior.
---

# LSR ORM

## Read Before Editing

- Read the installed `vendor/lsr/orm/src/Model.php`, `ModelQuery.php`, `ModelRepository.php`, attributes, relations, and traits.
- Read the application's model base class if one exists. The framework requires `Lsr\Orm\Model`; an application-specific `BaseModel` is a local convention, not an LSR requirement.
- Read the migration entry for every affected table.
- Read serializer, object-validation, and cache configuration because ORM behavior composes those packages.

## Model Shape

A minimal model is explicit about its table and primary key:

```php
use Lsr\Orm\Attributes\PrimaryKey;
use Lsr\Orm\Model;

#[PrimaryKey('id_article')]
final class Article extends Model
{
	public const string TABLE = 'articles';

	public string $title;
}
```

Rules:

- Extend the application's established model base when it adds required behavior; otherwise extend `Model` directly.
- Define `TABLE` explicitly. Do not assume table-name inference.
- Define `#[PrimaryKey(...)]` explicitly unless the inherited model already owns the mapping.
- Keep public typed properties aligned with database columns and nullability.
- Check the installed serializer/name-conversion behavior before relying on camelCase-to-snake_case mapping.
- Use `#[NoDB]` for runtime-only properties and `#[JsonExclude]` for values excluded from serialization when those installed attributes fit the requirement.
- Use object-validation attributes for invariants enforced by model persistence.

## Loading and Querying

```php
$article = Article::get($id);

$published = Article::query()
	->where('[published] = %i', 1)
	->orderBy('published_at')
	->desc()
	->get();
```

- `Model::get()` loads by primary key and participates in `ModelRepository` instance caching; handle `ModelNotFoundException` where absence is expected.
- `first()` returns a nullable model, `get()` returns models keyed by primary key, and `count()` returns a count.
- Use `cacheTags()` for additional application invalidation dependencies.
- Prefer DB facade DTO projections for reporting, aggregates, bulk reads, or screens that do not need model lifecycle behavior.

## Persistence

- Assign typed, validated properties and call the model persistence method used by the installed version (`save()`, `insert()`, or `update()` as appropriate).
- Read the installed `ModelSave` trait before relying on hook order or change detection.
- Coordinate multi-model invariants in an explicit DB transaction.
- Use timestamp traits only when the schema contains matching columns.
- Do not bypass model persistence with raw DB writes when validation, relations, hooks, instance caching, or cache clearing must run.

`Lsr\Core\Models\WithCacheClear` is an optional application base-model trait supplied by `lsr/core`. If the application uses it, preserve its table, query, instance, and relation tag contract. It is not automatically applied to every `Lsr\Orm\Model`.

## Relations

Installed relation attributes live under `Lsr\Orm\Attributes\Relations`:

- `ManyToOne`
- `OneToOne`
- `OneToMany`
- `ManyToMany`

Read each constructor in the installed package before writing positional arguments. Keep relation property types, local/foreign keys, through-table schema, and migration foreign keys aligned.

Use relations when they are part of the model's lifecycle interface. For large read-only graphs, prefer a typed projection rather than hydrating many models.

## Long-Running Workers

`ModelRepository` keeps static instance state. Current LSR RoadRunner HTTP and jobs workers clear it before each request/task. Any custom long-running worker must provide the same request/job isolation or prove that it never uses the ORM.

Never store a loaded model in a singleton expecting it to remain fresh across requests or jobs.

## Verification

- Cover load, missing-row, insert/update/delete, validation failure, and relation behavior affected by the change.
- Verify serialization for dates, enums, exclusions, aliases, and relation collections when exposed externally.
- Run the migration update/fresh-install checks against disposable databases when schema changed.
- Run package/application static analysis and the smallest relevant test suite.

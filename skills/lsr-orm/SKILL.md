---
name: lsr-orm
description: Use for LSR ORM models, model configuration, primary keys, typed properties, querying, persistence, relations, opt-in owned locale-keyed content translations since 0.3.23, serialization, validation, and model cache behavior.
---

# LSR ORM

## Read Before Editing

- Read the installed `vendor/lsr/orm/src/Model.php`, `ModelQuery.php`, `ModelRepository.php`, attributes, relations, and traits.
- Read the application's model base class if one exists. The framework requires `Lsr\Orm\Model`; an application-specific `BaseModel` is a local convention, not an LSR requirement.
- Read the migration entry for every affected table.
- Read serializer, object-validation, and cache configuration because ORM behavior composes those packages.
- Check `composer.lock` and installed package source before using version-sensitive APIs. `Translations`, `TranslationCollection` and `ModelQuery::withTranslations()` require `lsr/orm` **0.3.23+**; older installations lack them. Skill updates do not install, publish or upgrade Composer packages.

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
- `Translations` (opt-in owned content relation, since 0.3.23; see below)

Read each constructor in the installed package before writing positional arguments. Keep relation property types, local/foreign keys, through-table schema, and migration foreign keys aligned.

Use relations when they are part of the model's lifecycle interface. For large read-only graphs, prefer a typed projection rather than hydrating many models.

## Owned Locale-Keyed Content (0.3.23+)

Use this relation for database-backed, administrator/user-authored multilingual content. UI source copy and gettext catalogs remain separate: follow [localization](../lsr-localization/SKILL.md) and, when installed, [text-catalog](../lsr-text-catalog/SKILL.md). Do not add an ambient locale dependency to models or assume the application has a translatable base class.

Read installed `Attributes/Relations/Translations.php`, `TranslationCollection.php`, generated relation metadata and the [package example](https://github.com/Heroyt/lsr-orm/blob/master/README.md#owned-content-translations-since-0323) before adapting:

```php
use Lsr\Orm\Attributes\PrimaryKey;
use Lsr\Orm\Attributes\Relations\ManyToOne;
use Lsr\Orm\Attributes\Relations\Translations;
use Lsr\Orm\Model;
use Lsr\Orm\TranslationCollection;

#[PrimaryKey('id_product')]
final class Product extends Model
{
	public const string TABLE = 'products';

	public string $sku;

	/** @var TranslationCollection<ProductTranslation> */
	#[Translations(class: ProductTranslation::class, mappedBy: 'product', localeProperty: 'locale')]
	public TranslationCollection $translations;
}

#[PrimaryKey('id_product_translation')]
final class ProductTranslation extends Model
{
	public const string TABLE = 'product_translations';

	#[ManyToOne(foreignKey: 'id_product', localKey: 'product_id')]
	public Product $product;

	public string $locale;
	public string $title;
	public ?string $description = null;
}
```

### Declaration and Schema Contract

- Both are ordinary `Model` subclasses. The collection is public and non-null, annotated with its child type; the ORM initializes it. Do not combine it with `OneToMany` or manually replace it with a generic collection.
- `class` names the child; `mappedBy` names the child's public non-null `ManyToOne` **property**, not its database FK; `localeProperty` names a public non-null `string` property. All content fields are ordinary typed properties.
- Use an instantiable child. The collection and child parent/locale keys must be writable, non-static, non-virtual properties without PHP hooks. Child keys cannot be `NoDB` or transformed. The parent key needs exactly one `ManyToOne` referencing the parent's primary key without a factory; an explicit relation `class` must match its property type. Unsupported declarations throw `InvalidArgumentException` during metadata generation.
- Application migrations own both tables, an integer surrogate PK on the child, non-null FK and locale columns, `UNIQUE (product_id, locale)`, and an enforced FK to `products.id_product` with `ON DELETE CASCADE`. The attribute neither creates nor verifies database constraints. Follow [DB migrations](../lsr-db-migrations/SKILL.md); enable FK enforcement when testing SQLite.
- Locale keys have no ORM normalization, trimming, case folding, underscore/hyphen conversion or implicit current locale. Choose a canonical representation at the application boundary; SQL equality and the unique index must match exact in-memory keys. Check case-sensitive/binary collation and engine padding/whitespace semantics. Do not allow SQL to equate keys that the collection distinguishes.
- Store source/default-language content in the same translation table as every other locale. Supported languages, negotiation, fallback order and editing authorization are application policy.
- Regenerate model metadata after declarations change. Old generated configs without translations remain compatible, but do not discover a new relation automatically. Ordinary relations retain their existing behavior.

### Exact Writes, Whole-Row Fallback Reads

```php
$product = Product::get($id); // The parent must already be persisted.
$exact = $product->translations->find('fr-FR'); // Exact row or null.
$display = $product->translations->resolve(['fr-FR', 'en-GB']); // Whole row or null.

$editable = $exact ?? $product->translations->create('fr-FR');
$editable->title = 'Titre';
$editable->description = null;
if (!$editable->save()) {
	throw new RuntimeException('Could not save product translation.');
}
```

- `find(string $locale): ?T` returns only an exact persisted row, or `null`; an unsaved parent has no persisted translations.
- `resolve(array $locales): ?T` chooses the first existing whole row in order; an empty list/no match returns `null`. A present row's null/empty content is not replaced from another locale.
- A resolved row is the actual writable model with its actual locale. Never use fallback resolution as an editing target for a requested locale: that would overwrite the fallback language. Use exact `find()` and, when absent, `create()`.
- `create(string $locale): T` assigns parent and locale on an unsaved child. It does not persist or reserve it; retain the draft and fill required fields. Parent `save()` never saves translations, including edited loaded rows, and generic relation synchronization never detaches children or nulls their parent FK.
- Empty/whitespace-only locale arguments throw `InvalidArgumentException`; nonblank keys are preserved exactly, including surrounding whitespace, and locale lists must contain strings. `create()` throws `LogicException` for an unsaved parent or already persisted locale. Handle these separately from normal validation/write failure at the application boundary.
- Save the parent successfully before creating children; explicitly save/delete each child and check boolean results. Validation can throw `Lsr\ObjectValidation\Exceptions\ValidationException`; persistence follows the installed ORM/driver error contract. A concurrent duplicate can still fail at the unique constraint: lookup then create is not an atomic upsert.
- Parent deletion relies on the database cascade and invalidates owned child state; the database does not run PHP child delete hooks. This feature does not redesign existing `save()` transactions. Inspect rollback/error behavior before coordinating a multi-row write.

### Batch Loading, Output and Lifecycle

```php
$products = Product::query()
	->withTranslations(['fr-FR'])
	->withTranslations(['en-GB'])
	->get();

foreach ($products as $product) {
	$display = $product->translations->resolve(['fr-FR', 'en-GB']);
	// Project selected fields and $display->locale into the application's DTO.
}
```

- `withTranslations(array $locales, string $property = 'translations'): static` batches requested children for `get()`/`first()` parents and remembers missing rows. Repeated calls for a property merge locales. One child query runs per bounded batch/relation (currently 200 parent IDs and 100 locales), not necessarily one for the entire result. It does not filter parents or choose fallback order; `count()` is unchanged.
- The property need not be named `translations`: a declaration named `localizedContent` uses `->withTranslations(['en-GB'], property: 'localizedContent')`. An unknown/non-translation property throws `InvalidArgumentException`. Other locales remain available through on-demand lookup.
- `Model::jsonSerialize()` omits translation relations by default even after preload. Explicitly project the selected content and actual locale into DTOs; do not expose all rows accidentally or assume another serializer shares this behavior.
- Exact and batched translation reads bypass persistent DB query caches (`fetchAll(cache: false)`); collections cache hits/misses only in process memory. Child ORM insert/update/delete invalidates lookup state, including misses; moving a persisted child to another parent/locale invalidates both old and new lookups. Parent deletion invalidates owned child state.
- `ModelRepository::clearInstances()` clears translation lookup caches even in externally retained collections, but does not refresh the fields of retained child objects. Clear at request/job boundaries and refetch rather than retaining models across lifecycles.
- Raw/bulk SQL and external writers bypass ORM mutation invalidation. Explicitly clear in-process instance/translation state and refetch; no cross-process freshness is promised. Separately cached ordinary `Model::query()` results keep their existing application invalidation contract. Preloaded parent queries respect normal `get()`/`first()` caching; child reads always bypass DB caching.

## Long-Running Workers

`ModelRepository` keeps static instance state. Current LSR RoadRunner HTTP and jobs workers clear it before each request/task. Any custom long-running worker must provide the same request/job isolation or prove that it never uses the ORM.

Never store a loaded model in a singleton expecting it to remain fresh across requests or jobs.

## Verification

- Cover load, missing-row, insert/update/delete, validation failure, and relation behavior affected by the change.
- Verify serialization for dates, enums, exclusions, aliases, and relation collections when exposed externally.
- Run the migration update/fresh-install checks against disposable databases when schema changed.
- For owned translations, cover exact misses, whole-row fallback with null fields, explicit child saves, duplicate-locale constraints, moves between parents/locales, missing-result invalidation, batch loading, serialization exclusion, cascade deletion and request/job cache isolation.
- Run package/application static analysis and the smallest relevant test suite.

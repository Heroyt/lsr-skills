---
name: lsr-quality-rules
description: Use for this LSR app when auditing, planning, reviewing, or implementing code quality rules around PSR-4 autoloading, one-class-per-file structure, DTO-only service/CQRS boundaries, CQRS read/write separation, PHP enums, ORM model completeness, DB cache safety, typed DB facade reads, and test coverage.
---

# LSR Quality Rules

Use this skill together with the more specific local skills for touched areas:

- `lsr-cqrs` for commands, command handlers, query services, and command responses.
- `lsr-db` for DB facade reads/writes, cache tags, and DTO fetch helpers.
- `lsr-orm` for models, relations, save behavior, and schema alignment.
- `lsr-serializer-validation` for DTO mapping, serializer behavior, and `fetchDto()` / `fetchAllDto()`.
- `lsr-cache` when raw writes or custom reads require cache invalidation decisions.

## Review Workflow

When asked to audit or refactor for quality rules:

1. Map the affected PHP files with `rg --files -g '*.php' -g '!vendor/**'`.
2. Check PSR-4 compatibility: `App\` maps to `src/`, `Tests\` maps to `tests/`, and each PHP file should declare one class/interface/trait/enum matching its path.
3. Search for raw boundary leaks:
   - `use Dibi\Row`
   - `Row[]`, `?Row`, `: Row`
   - `array<string,mixed>` or large nested array shapes on public service/CQRS methods.
4. Search for DB access:
   - `DB::query`, `DB::select`, `fetch(`, `fetchAll(`, `fetchSingle(`
   - `DB::insert`, `DB::update`, `DB::delete`, `DB::replace`
5. Compare each finding against the rules below before changing code.
6. Add or update tests before broad refactors where possible.

## PSR-4 And File Shape

- Keep exactly one class/interface/trait/enum declaration per PHP file.
- Match namespace and class name to path:
  - `src/Services/Foo.php` -> `App\Services\Foo`
  - `tests/Services/FooTest.php` -> `Tests\Services\FooTest`
- Move private helper DTOs/classes into their own files instead of declaring them below the main class.
- Prefer small named DTOs over anonymous row/helper classes embedded in service files.

## Service And CQRS Boundaries

- Public service and CQRS method parameters/returns must use scalar IDs, scalar return values such as `bool`, `int`, or `string`, enums, request DTOs, command DTOs, query DTOs, ORM models, or collections of DTOs/models.
- Do not expose `Dibi\Row`, `Row[]`, or unstructured associative arrays from public service/CQRS methods.
- Internal temporary arrays are acceptable only inside a method or private mapper. Promote them to DTOs when they cross class boundaries or become persistent contracts.
- Request DTOs under `src/Http/Requests` are for HTTP mapping; do not reuse them as generic read-model DTOs unless that is explicitly intended.

## CQRS Separation

- Queries own reads from DB, session-like stores, and other stateful sources.
- Commands own writes that mutate DB/session/cache/external state.
- Command handlers may read inside a transaction only when the read is lock-coupled to the write, such as `FOR UPDATE`. Keep those lock projections typed with row DTOs, not `Dibi\Row`.
- Services should compose queries, command dispatch, models, and pure calculations. Avoid direct DB reads/writes in services unless the class is explicitly a query/persistence adapter.
- Put query services under `src/CQRS/Queries` and implement `Lsr\CQRS\QueryInterface`.
- Put command DTOs, handlers, and responses under `src/CQRS/Commands`, `src/CQRS/CommandHandlers`, and `src/CQRS/CommandResponses`.

## DB Reads

- For one-table entity reads, prefer ORM model queries:

```php
$round = Round::query()
    ->where('code = %s', $code)
    ->first();
```

- For projections, reporting, joins, and aggregate reads, use `Lsr\Db\DB` fluent queries with typed DTO fetching:

```php
$row = DB::select([Round::TABLE, 'r'], 'r.id_round AS id, r.status')
    ->where('r.id_round = %i', $roundId)
    ->cacheTags(Round::TABLE)
    ->fetchDto(RoundStatusRow::class);
```

- Alias SQL columns to camelCase DTO properties.
- Use `fetchDto()` and `fetchAllDto()` instead of `fetch()` and `fetchAll()` for application-level projections.
- Add `cacheTags(...)` for all tables the read depends on unless `cache: false` is deliberately required.
- Use `cache: false` for fresh operational reads only, such as auth/session checks or lock-sensitive flows.

## DB Writes And Cache Safety

- Prefer ORM model `save()` for app-owned model lifecycle writes.
- Raw `DB::insert/update/delete/query/replace` writes are acceptable for bulk operations, atomic SQL expressions, spatial expressions, install/migration code, and lock-sensitive updates.
- Every raw DB write outside install/migration code must either:
  - be replaced by a model `save()`/`delete()`, or
  - explicitly clear affected cache tags and document why the raw write remains.
- Use model table constants as cache tags, for example `Round::TABLE`, `PlayerTaskPairAttempt::TABLE`, and relation-specific tags where applicable.
- Treat `src/Core/Info.php` as a special case: it manages its own `info` cache tags.

## Enums

- Use PHP backed enums for closed sets such as statuses, modes, types, sources, reasons, and difficulty.
- ORM model properties and DTO properties should use enum types, not plain strings, when the value is one of these closed sets.
- Convert external strings to enums at the boundary with `tryFrom()`/`from()` and validation errors.
- Search/external API payloads may serialize enum values as strings, but internal service contracts should prefer enum-typed DTOs.

## ORM Models

- App-owned models extend `App\Models\BaseModel`.
- App-owned models declare `public const string TABLE` and `#[PrimaryKey(...)]`.
- Public DB-backed properties must align with `config/migrations/migrations.neon`.
- Model relations should be mapped with ORM attributes such as `ManyToOne`, `OneToMany`, `OneToOne`, or `ManyToMany`.
- Do not leave foreign-key-like fields as only scalar IDs when the relationship is part of the app model contract.
- Use `#[JsonExclude]` for DB/runtime fields that must not serialize, such as spatial `position`.
- Add serialization tests for enum fields, dates, excluded fields, and `#[ExtendsSerialization]` collection normalization.

## Testing Expectations

- Add or extend convention tests for:
  - one declaration per PHP file,
  - model `TABLE` and `PrimaryKey`,
  - relation attributes for FK-like model fields,
  - no `Dibi\Row` in public service/CQRS signatures.
- Add mapper tests for query row DTOs with bools, enums, dates, nullable fields, and aliases.
- Add business-rule tests for pure services and calculations.
- Add regression tests when replacing raw `Row`/array outputs with DTOs.
- Run the smallest relevant subset while iterating, then:

```sh
composer cbf
composer phpstan
composer cs
composer test
```

Run frontend checks too if backend DTO changes affect Inertia props or TypeScript contracts.

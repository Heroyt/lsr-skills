---
name: lsr-serializer-validation
description: Use for LSR serializer configuration, typed mapping, normalization, object-validation attributes, mapped request DTOs, DB DTO fetches, and serialization interface safety.
---

# LSR Serializer and Object Validation

## Read the Installed Pipeline

- `vendor/lsr/serializer/src/Mapper.php`
- `vendor/lsr/serializer/src/DI/SerializerExtensions.php`
- installed normalizers and application-added normalizers
- `vendor/lsr/object-validation/src/Validator.php` and `Attributes`
- `vendor/lsr/request/src/Validation/RequestValidationMapper.php`
- the application's serializer NEON config

`lsr/serializer` wraps Symfony Serializer. Exact extractor, normalizer, encoder, and context order is configuration, not a universal assumption.

## DI Configuration

The serializer extension currently supports base and extra extractors, normalizers, denormalizers, encoders, plus common/encoder/serializer/normalizer/denormalizer context.

Prefer adding application-specific behavior through `extra*` lists rather than replacing defaults accidentally. Keep serializer configuration in its own included NEON file. Check normalizer priority/order whenever two normalizers support the same type.

`Lsr\Serializer\Mapper::map($data, ClassName::class, $context)` delegates to the configured Symfony denormalizer and can throw normalizer/partial-denormalization exceptions.

## DTO Mapping

- Use public typed properties or constructor-promoted readonly properties supported by the installed serializer configuration.
- Match input keys to property names or define explicit aliases/name conversion.
- Use backed enums and `DateTimeInterface` types only after verifying installed normalizers.
- Keep request DTOs separate from projection/domain DTOs unless their interface is intentionally identical.
- Never silently ignore unknown or invalid external data unless the interface explicitly permits it.

## Object Validation

Common `Lsr\ObjectValidation\Attributes` include:

- `Required`
- `Email`
- `StringLength`
- `IntRange`
- `Numeric`
- `Regex`
- `Url`
- `Uri`
- `DateString`

Read attribute constructors before using positional arguments. `Validator::validateAll()` can aggregate failures through the package validation exceptions.

For mapped HTTP DTOs, `RequestValidationMapper`:

1. maps GET query data or non-GET parsed body;
2. disables strict type enforcement during denormalization;
3. runs attribute validation;
4. invokes a `validate()` method when present;
5. throws one validation exception or a `ValidationMultiException`.

Use `validate()` only for cross-field invariants that attributes cannot express. It must throw the framework validation exception expected by the mapper.

## DB DTO Fetching

`Lsr\Db\Dibi\Fluent` exposes typed mapping through:

```php
$query->fetchDto(ArticleRow::class);
$query->fetchAllDto(ArticleRow::class);
$query->fetchIteratorDto(ArticleRow::class);
$query->fetchAssocDto(ArticleRow::class, 'id');
```

Alias selected columns to DTO property names. Preserve cache tags and freshness choices exactly as for row fetches.

Do not expose `Dibi\Row` from a stable application module interface when a small typed projection expresses the contract.

## Serialization Safety

- Mark secrets and internal fields with the installed exclusion mechanism; do not depend only on controller filtering.
- Treat translations, user-authored text, and serialized HTML as untrusted at the rendering interface.
- Detect circular graphs deliberately; do not hide accidental object-graph expansion behind a permissive circular-reference handler.
- Keep wire field names stable or version the external interface.

## Verification

Cover mapping and normalization for required/nullable values, unknown values, enums, dates, nested arrays, aliases, exclusions, and validation aggregation. For public JSON/Inertia output, assert the actual serialized shape. Run the application's serializer tests and static analysis.

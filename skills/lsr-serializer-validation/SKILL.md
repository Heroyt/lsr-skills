---
name: lsr-serializer-validation
description: Use for LSR app serialization, mapping, DTO denormalization, object validation attributes, request DTO validation, and DB fetchDto/fetchAllDto behavior.
---

# Serializer + Validation Workflow

## Read First

- Serializer config: `config/di/extensions/serializer.neon`.
- Mapper: `vendor/lsr/serializer/src/Mapper.php`.
- Normalizers: `vendor/lsr/serializer/src/Normalizer`.
- Object validator: `vendor/lsr/object-validation/src/Validator.php`.
- Validation attributes: `vendor/lsr/object-validation/src/Attributes`.
- Request mapper: `vendor/lsr/request/src/Validation/RequestValidationMapper.php`.
- Request DTO examples: `src/Http/Requests`.
- DB DTO fetch helpers: `vendor/lsr/db/src/Dibi/FetchFunctions.php`.

## Mapper

- Use `Lsr\Serializer\Mapper` for denormalizing arrays/rows into typed objects.
- `Mapper::map($data, ClassName::class, $context)` delegates to Symfony Serializer denormalization.
- This project configures `Symfony\Component\PropertyInfo\Extractor\PhpStanExtractor` for better type extraction.
- DB fluent helpers use the serializer mapper for `fetchDto()` and `fetchAllDto()`.

## Validation Attributes

- Use `Lsr\ObjectValidation\Attributes` on public DTO/model properties.
- Available common attributes include `Required`, `Email`, `StringLength`, `IntRange`, `Numeric`, `Regex`, `Url`, `Uri`, `DateString`, and `NoValidate`.
- Use a DTO `validate()` method only for cross-field or business validation that attributes cannot express.
- Validation may throw `ValidationException` or `ValidationMultiException`.

## Request DTO Mapping

- Request DTOs are mapped HTTP DTOs and belong under `src/Http/Requests`.
- Keep request DTOs specific to request mapping. Do not reuse them as generic serializer/read DTOs unless explicitly intended.
- `#[Lsr\Core\Attributes\MapRequest]` on a controller parameter triggers request DTO mapping.
- GET requests map query params; other methods map parsed body.
- Request mapping disables strict type enforcement during denormalization, then runs object validation.
- Framework defaults should handle validation failures unless a feature explicitly needs custom behavior.

## DB DTO Fetching

- Serializer mapping can be used in services and read models outside request handling.
- Use `fetchDto(ClassName::class)` for one DTO and `fetchAllDto(ClassName::class)` for DTO arrays.
- DTO property names should match selected column aliases.
- Alias SQL columns to camelCase DTO properties when needed.
- Add cache tags to DTO queries just as with row queries when data depends on models.

## Serialization in Latte/API

- `App\Latte\LacExtension` exposes `json`, `xml`, and `csv` filters/functions through Symfony Serializer.
- Controller `respond()` chooses JSON/XML based on `Accept` headers and defaults to JSON for structured data.

## Validation

```sh
composer phpstan
composer cs
```

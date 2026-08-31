---
name: lsr-db-migrations
description: Use for LSR migration NEON files, modular includes, table definitions, versioned modifications, indexes, foreign keys, views, and application installer behavior.
---

# LSR Database Migrations

## Read Before Editing

1. Locate the root migration file from the application's installer; common names are `config/migrations.neon` or `config/migrations/migrations.neon`.
2. Follow every `includes:` entry recursively.
3. Read the application installer that consumes `Lsr\Core\Migrations\MigrationLoader`. The loader parses and merges data; the application installer decides how definitions and modifications execute.
4. Read the affected ORM models and current database schema.
5. Inspect the installed `vendor/lsr/core/src/Migrations/{MigrationLoader,Migration,Index,ForeignKey}.php`.

Never infer installer semantics from another LSR application.

## Split Migrations by Domain

The root migration file should be a small index, not the schema for the whole application:

```neon
includes:
	- vendor/lsr/core/migrations.neon
	- config/migrations/auth.neon
	- config/migrations/games.neon
	- config/migrations/tournaments.neon
```

Domain files may include smaller files:

```neon
# config/migrations/games.neon
includes:
	- config/migrations/games/evo5.neon
	- config/migrations/games/evo6.neon

tables:
	# shared game tables only
```

`MigrationLoader` passes include strings directly to `file_exists()` and recursively loads them. Relative migration paths therefore follow the process working directory, unlike Nette DI includes, which are relative to the including NEON file. Existing LSR applications normally run installers from the project root and use project-root-relative paths such as `config/migrations/games.neon`. Preserve the local convention and verify the installer from its normal working directory.

The loader rejects a file loaded twice as a cyclic include. Keep a tree-shaped include graph: one owning parent per migration file.

## Supported Data Shape

Each file may contain `includes`, `tables`, and `views`. A table entry supports:

```neon
tables:
	App\Models\Example:
		order: 10
		definition: '''
		(
			`id_example` int unsigned NOT NULL AUTO_INCREMENT,
			`name` varchar(100) NOT NULL,
			PRIMARY KEY (`id_example`)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
		'''
		modifications:
			0.2.0:
				- 'ADD `published` tinyint(1) NOT NULL DEFAULT 0'
		indexes:
			-
				name: example_name
				columns: [name]
				unique: true
		foreignKeys:
			-
				column: id_parent
				refTable: App\Models\ParentModel
				refColumn: id_parent
				onDelete: CASCADE
				onUpdate: CASCADE
```

Framework DTO fields are:

- table: required `definition`, optional numeric `order`, `modifications`, `indexes`, and `foreignKeys`;
- index: `name`, string or list `columns`, optional `unique`, optional `pk`;
- foreign key: `column`, `refTable`, `refColumn`, optional `onDelete`, optional `onUpdate`;
- view: map entry whose value is the SQL body expected by the application installer.

A table key may be a literal name or a model class only if the application installer resolves model keys. Confirm that behavior before using a class name.

## Change Rules

- Put a new table in the smallest owning domain file with its complete current definition.
- For an existing table, keep the definition aligned with a fresh install and add a new modification only according to the local installer's version rules.
- Never rewrite an already-released modification key.
- Do not use special keys such as `always` unless the local installer explicitly supports them.
- Keep model `TABLE`, `#[PrimaryKey]`, properties, indexes, and foreign keys aligned.
- Preserve dependency order expected by the installer. Read its sort direction before changing `order`.
- Define indexes and foreign keys in their dedicated sections when the installer reconciles those sections. Do not duplicate them in definitions/modifications unless required by unsupported database features.
- Use safe defaults/backfills when adding non-null columns to populated tables.

## Verification

1. Decode/load the complete include tree through the application's migration loader.
2. Run the normal non-destructive install/update command against a disposable database.
3. For fresh-install compatibility, run the application's fresh-install mode only against a disposable database.
4. Inspect the resulting columns, indexes, foreign keys, and views; a successful command does not prove schema equivalence.
5. Run model and migration tests plus the application's static analysis.

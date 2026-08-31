---
name: lsr-console
description: Use for LSR app CLI commands with lsr/console and Symfony Console, including AsCommand discovery, DI command loading, bin/console workflows, cache:clean, and command implementation patterns.
---

# LSR Console Workflow

## Read First

- Console config: `config/di/extensions/console.neon`.
- Commands: `src/Console/Commands`.
- Console entrypoint: `bin/console`.
- Console extension: `vendor/lsr/console/src/Di/ConsoleExtension.php`.
- Built-in cache clean command: `vendor/lsr/console/src/Commands/Cache/CacheCleanCommand.php`.
- Built-in container clean command: `vendor/lsr/console/src/Commands/ContainerCleanCommand.php`.

## Command Registration

- Put app commands under `src/Console/Commands`.
- Extend `Symfony\Component\Console\Command\Command`.
- Use `#[Symfony\Component\Console\Attribute\AsCommand(...)]`.
- Console commands should be auto-discovered through DI search. Register a command explicitly only for unusual custom wiring.
- Commands are loaded from DI; inject dependencies through the constructor.
- Call `parent::__construct()` in the constructor.
- Prefer typed input validation and clear `Command::SUCCESS` / `Command::FAILURE` returns.

## Built-In Commands

- Clear system cache:

```sh
php ./bin/console cache:clean
```

Use `cache:clean` for operational cleanup or troubleshooting. Automated tests should not rely on manual cache cleaning.

- Alias:

```sh
php ./bin/console cache:clear
```

- Clear cache by tag:

```sh
php ./bin/console cache:clean --tag=playlists
```

- Clear generated container:

```sh
php ./bin/console container:clean
```

## App Command Patterns

- Use `InputArgument` for required positional data.
- Use `InputOption` for optional flags and values.
- Validate input before changing state.
- Use Symfony output helpers such as `Table` for structured results.
- Catch domain exceptions and print concise `<error>...</error>` messages.
- Avoid printing sensitive values unless the command explicitly generated them for one-time display.

## Validation

```sh
composer phpstan
composer cs
php ./bin/console
```

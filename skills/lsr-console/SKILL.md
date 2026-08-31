---
name: lsr-console
description: Use for LSR console setup and Symfony Console commands, DI command discovery, AsCommand metadata, lazy loading, built-in maintenance commands, and CLI verification.
---

# LSR Console

## Read the Local Console Bootstrap

- Find the application-owned `bin/console` entrypoint and its DI bootstrap.
- Read `vendor/lsr/console/src/Di/ConsoleExtension.php` and `CommandLoader.php`.
- Read the NEON file that registers the extension and application command services.
- Run `php bin/console list` before assuming a package command is installed.

Register the current extension class:

```neon
extensions:
	console: Lsr\Console\Di\ConsoleExtension

console:
	name: 'Application name'
	version: %app.version%
	catchExceptions: false
```

Read the installed schema before adding options. Keep console wiring in a focused included NEON file.

## Command Registration

`ConsoleExtension` finds every DI service whose type extends `Symfony\Component\Console\Command\Command`. It does not scan a source directory itself.

Use the application's Nette search convention or explicit services to register command classes:

```neon
services:
	- App\Console\Commands\RebuildSearchIndexCommand
```

```php
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;

#[AsCommand(
	name: 'search:rebuild',
	description: 'Rebuild the search index.',
)]
final class RebuildSearchIndexCommand extends Command
{
	// Inject dependencies through the constructor.
}
```

The extension reads `AsCommand` metadata and creates lazy command services when name and description are available. Duplicate command names/aliases fail container compilation.

- Call `parent::__construct()` only when the parent constructor is not otherwise invoked by the class pattern in use.
- Use typed `InputArgument` and `InputOption` definitions.
- Return `Command::SUCCESS`, `Command::FAILURE`, or `Command::INVALID` deliberately.
- Keep commands orchestration-thin; put reusable behavior in injected application modules.
- Do not print credentials, access tokens, raw session contents, or personal data.
- Make long-running commands signal-aware where graceful shutdown matters.

## Package Commands

Current packages may register these commands when their extensions and command registration are enabled:

```text
container:debug
container:clean      (alias container:clear)
config:cache:clean   (alias config:cache:clear)
latte:cache:clean    (alias latte:cache:clear)
cache:clean          (alias cache:clear)
orm:cache:clean      (alias orm:cache:clear)
scheduler:run
```

Do not document or call a command just because its package exists; verify it appears in the compiled application.

## Failure Handling

- Validate all input before state changes.
- Catch expected domain exceptions at the command interface and render concise errors.
- Let unexpected failures reach Symfony Console's configured exception behavior and process exit code.
- For scheduled commands, non-zero exit status must remain observable to the scheduler/supervisor.
- For retryable/long work, consider dispatching a RoadRunner job instead of holding the CLI process.

## Verification

1. Force container compilation and run `php bin/console list`.
2. Run the command through the real entrypoint with valid and invalid input.
3. Assert exit code, output contract, and state change.
4. For destructive commands, use disposable state and cover confirmation/force behavior.
5. Run the application's static analysis and command tests.

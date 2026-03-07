# Installation

Extensions can be installed at two levels: global (available to all projects) or project-specific (only for the current project). Both locations support hot reload, so changes take effect immediately without restarting AiderDesk.

## Installing via CLI (Recommended)

The easiest way to install extensions is using the `@aiderdesk/extensions` CLI tool. It can install extensions interactively, by ID, or from a URL.

### Interactive Installation

Run the CLI without arguments to see all available extensions and select which ones to install:

```bash
# Install to project extensions (default)
npx @aiderdesk/extensions install

# Install to global extensions
npx @aiderdesk/extensions install --global

# Install to custom directory
npx @aiderdesk/extensions install --directory /path/to/extensions
```

### Install by Extension ID

Install a specific extension by its ID:

```bash
# Install sound-notification extension to project
npx @aiderdesk/extensions install sound-notification

# Install to global extensions
npx @aiderdesk/extensions install sound-notification --global
```

### Install from URL

Install an extension directly from a URL:

```bash
# Install from a direct file URL
npx @aiderdesk/extensions install https://raw.githubusercontent.com/hotovo/aider-desk/main/packages/extensions/extensions/sound-notification.ts

# Install from GitHub repository
npx @aiderdesk/extensions install https://github.com/hotovo/aider-desk --global
```

### List Available Extensions

View all available example extensions:

```bash
npx @aiderdesk/extensions list
```

### CLI Options

| Option | Description |
|--------|-------------|
| `-g, --global` | Install to global directory (`~/.aider-desk/extensions`) |
| `-d, --directory <path>` | Custom installation directory |
| No option | Install to project directory (`./.aider-desk/extensions`) |

## Manual Installation Locations

### Global Extensions

Global extensions are available to all AiderDesk projects on your system.

```bash
# Create the directory if it doesn't exist
mkdir -p ~/.aider-desk/extensions

# Copy your extension
cp my-extension.ts ~/.aider-desk/extensions/

# For folder-based extensions
cp -r my-complex-extension ~/.aider-desk/extensions/
```

**Path:** `~/.aider-desk/extensions/`

### Project Extensions

Project extensions are only loaded when working with that specific project.

```bash
# Create the directory in your project
mkdir -p .aider-desk/extensions

# Copy your extension
cp my-extension.ts .aider-desk/extensions/

# For folder-based extensions
cp -r my-complex-extension .aider-desk/extensions/
```

**Path:** `./.aider-desk/extensions/`

## Extension Priority

When both global and project extensions exist with the same name:

1. **Project extensions override global extensions** - The project-level version takes precedence
2. **Both are loaded** - If names differ, both extensions run
3. **Execution order** - Global extensions execute first, then project extensions

## Hot Reload

Extensions are automatically reloaded when files change. There's no need to restart AiderDesk.

### How It Works

1. AiderDesk watches both extension directories for changes
2. When a file is added, modified, or deleted, a reload is triggered
3. Changes are debounced by 1 second to prevent rapid reloads
4. The extension is unloaded and reloaded with the new code

### What Triggers a Reload

- Creating a new extension file (`.ts` or `.js`)
- Modifying an existing extension file
- Deleting an extension file
- Adding/modifying/deleting files in a folder extension

### Development Workflow

```bash
# 1. Create or edit your extension
vim ~/.aider-desk/extensions/my-extension.ts

# 2. Save the file - extension reloads automatically

# 3. Check AiderDesk logs for any errors
# Logs appear in the AiderDesk console
```

## Installing from Examples

The recommended way to install example extensions is using the CLI:

```bash
# Interactive selection
npx @aiderdesk/extensions install

# Install specific extension
npx @aiderdesk/extensions install sound-notification
npx @aiderdesk/extensions install sandbox --global
```

Alternatively, you can manually download examples from the AiderDesk repository:

```bash
# Single file example
curl -o ~/.aider-desk/extensions/sound-notification.ts \
  https://raw.githubusercontent.com/hotovo/aider-desk/main/packages/extensions/extensions/sound-notification.ts

# Folder-based example
git clone --depth 1 https://github.com/hotovo/aider-desk temp-aider
cp -r temp-aider/packages/extensions/extensions/sandbox ~/.aider-desk/extensions/
rm -rf temp-aider

# Install dependencies for folder extensions
cd ~/.aider-desk/extensions/sandbox
npm install
```

## TypeScript Setup

For TypeScript support in your extensions, you can either install the npm package or download the type definitions.

### Option 1: Install via npm (Recommended)

```bash
npm install @aiderdesk/extensions
```

Then import in your extension:

```typescript
import type { Extension, ExtensionContext } from '@aiderdesk/extensions';
```

### Option 2: Download Type Definitions

```bash
# Download type definitions to your extensions directory
curl -o ~/.aider-desk/extensions/extension-types.d.ts \
  https://raw.githubusercontent.com/hotovo/aider-desk/main/packages/extensions/extensions.d.ts

# For project extensions
curl -o .aider-desk/extensions/extension-types.d.ts \
  https://raw.githubusercontent.com/hotovo/aider-desk/main/packages/extensions/extensions.d.ts
```

Then import in your extension:

```typescript
import type { Extension, ExtensionContext } from './extension-types';
```

## Verifying Installation

To verify your extension is loaded:

1. Open AiderDesk
2. Check the console/logs for extension load messages
3. Look for your extension's tools, commands, or agents in the UI

Extensions log messages using `context.log()` which appears in AiderDesk's log output.

## Uninstalling

Simply remove the extension file or folder:

```bash
# Remove a single-file extension
rm ~/.aider-desk/extensions/my-extension.ts

# Remove a folder extension
rm -rf ~/.aider-desk/extensions/my-complex-extension
```

The extension will be automatically unloaded.

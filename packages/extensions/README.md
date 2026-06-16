# @aiderdesk/extensions

TypeScript type definitions, runtime utilities, and a CLI installer for [AiderDesk](https://aiderdesk.hotovo.com) extensions.

---

## Installing Extensions

The easiest way to browse and install extensions is using the CLI:

```bash
# Interactive selection — choose from all available extensions
npx @aiderdesk/extensions install

# Install a specific extension by ID
npx @aiderdesk/extensions install sound-notification

# Install to global extensions (available to all projects)
npx @aiderdesk/extensions install sound-notification --global

# Install from a URL (e.g., your own repository)
npx @aiderdesk/extensions install https://raw.githubusercontent.com/username/my-extension/main/my-extension.ts
```

By default, extensions are installed to the current project (`.aider-desk/extensions/`). Use `--global` to install them for all projects (`~/.aider-desk/extensions/`).

Browse the full list of available extensions in the [Extensions Gallery](https://aiderdesk.hotovo.com/docs/extensions/extensions-gallery).

### Hot Reload

Extensions are automatically reloaded when files change — no restart needed!

---

## Building Extensions

If you're developing your own extension, install this package as a dependency to get type definitions and runtime utilities:

```bash
npm install @aiderdesk/extensions
# or
yarn add @aiderdesk/extensions
# or
pnpm add @aiderdesk/extensions
```

Import both types and runtime values from a single entry point:

```typescript
import type { Extension, ExtensionContext, ToolDefinition } from '@aiderdesk/extensions';
import { ToolApprovalState } from '@aiderdesk/extensions';
import { z } from 'zod';

export default class MyExtension implements Extension {
  async onLoad(context: ExtensionContext) {
    context.log('Extension loaded!', 'info');

    // Runtime values are available too
    const approval = ToolApprovalState.Always;
  }
}
```

**Note**: The package provides both TypeScript type definitions and runtime JavaScript values (like enum values) from the same entry point. You can use `import type` for type-only imports, or regular imports for runtime values.

---

## Documentation

For comprehensive documentation on creating and using extensions, see the [Extensions documentation](https://aiderdesk.hotovo.com/docs/extensions/):

- [Extensions Overview](https://aiderdesk.hotovo.com/docs/extensions/) - What extensions can do
- [Creating Extensions](https://aiderdesk.hotovo.com/docs/extensions/creating-extensions) - How to build extensions
- [Installation Guide](https://aiderdesk.hotovo.com/docs/extensions/installation) - Install extensions globally or per-project
- [API Reference](https://aiderdesk.hotovo.com/docs/extensions/api-reference) - Complete API documentation
- [Events Reference](https://aiderdesk.hotovo.com/docs/extensions/events) - All available events
- [Extensions Gallery](https://aiderdesk.hotovo.com/docs/extensions/extensions-gallery) - Browse all available extensions

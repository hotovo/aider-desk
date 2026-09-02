# AGENTS.md
This file provides guidance to AiderDesk when working with code in this repository.

## Common Commands

### Development
- `npm install` - Install dependencies
- `npm run dev` - Run in development mode with hot reload
- `npm run dev:no-hmr` - Run in development mode without hot module replacement

### Type Checking
- `npm run typecheck` - Run all TypeScript type checks
- `npm run typecheck:node` - Type check main process files (tsconfig.node.json)
- `npm run typecheck:web` - Type check renderer process files (tsconfig.web.json)

### Linting and Formatting
- `eslint --fix` - Run ESLint with auto-fix and auto-format on specified file(s)

### Testing
- `npm run test` - Run all tests (main + renderer)
- `npm run test:node` - Run main, preload, and common process tests
- `npm run test:web` - Run renderer process tests (React components)
- `npm run test:watch` - Run tests in watch mode for development
- `npm run test:coverage` - Generate coverage reports
- `npm run test:ui` - Open interactive test UI

**Note for Agents**: When running 'npm run test' script via `power---bash`, always append `-- --no-color` to the command (e.g., `npm run test:node -- --no-color`) to ensure clean, parseable output without ANSI escape codes. Other scripts can be run without this.

### Building
- `npm run build` - Full build (includes type checking)
- `npm run build:win` - Build Windows executable
- `npm run build:mac` - Build macOS executable
- `npm run build:linux` - Build Linux executable
- `npm run build:unpack` - Build without packaging

### Manual Type Checking (for verification)
- `tsc --noEmit -p tsconfig.node.json` - Check main process files
- `tsc --noEmit -p tsconfig.web.json` - Check renderer process files

## Dependency Management

- All dependency versions in root `package.json`, `packages/app/package.json`, and `packages/extensions/package.json` are pinned to **exact versions** (no `^`/`~` ranges). npm strips `package-lock.json` from published tarballs, so any range would float at install time for consumers.
- `packages/app/scripts/generate-package.mjs` copies versions verbatim from root `package.json` into the published `@aiderdesk/aiderdesk` package — pinning root propagates to the published package on the next build.
- To bump a version, change the exact pin (or use the `update-ai-sdk-dependencies.yml` workflow, which writes exact pins) and run `npm install` to sync the lockfile. Never reintroduce `^`/`~` ranges.
- Exception: the ranged entries under `overrides` (`@tootallnate/once`, `jsondiffpatch`) are intentional — neither package exists in the lockfile, so there is no resolved version to pin.
- `packages/extensions/package.json` (also published, `@aiderdesk/extensions`) is pinned the same way, except its `peerDependencies` (`zod`) which stays a range — peers declare consumer compatibility and install nothing. Its resolved versions live in the root lockfile: prefer the nested `packages/extensions/node_modules/<name>` resolution when it differs from the hoisted one (e.g. `chalk`, `commander`, `execa`, `ora` have different hoisted majors at root).
- Remaining workspace packages (`packages/common`, `packages/mcp-server`, `packages/tree-sitter-utils`) are also published and still use ranges; they are not covered by this policy yet.

## High-Level Architecture

AiderDesk is an Electron-based desktop application that provides a GUI wrapper for the Aider AI coding assistant. The architecture follows Electron's multi-process model with clear separation of concerns:

### Core Directories

**src/main/** - Electron main process (Node.js environment)
- Entry point and window management
- Project management and Aider integration via Python connector
- IPC handlers for renderer communication
- Agent system with MCP (Model Context Protocol) support
- File system operations, logging, telemetry
- REST API server for external integrations

**src/renderer/** - Electron renderer process (Chromium/React environment)
- React-based UI components and pages
- Project views, chat interface, settings management
- Context file management and diff viewing
- Internationalization (i18n) with English/Chinese/Russian/Korean support

**src/preload/** - Electron preload scripts
- Secure bridge between main and renderer processes
- API definitions and IPC event listeners
- Type-safe communication layer

**packages/common/src/api.ts** - Common API definitions
- TypeScript interface for ApplicationAPI
- Enumerations and types shared between main and renderer
- Implementing classes are in **src/preload/index.ts** for main process and **src/renderer/api/browser-api.ts** for browser clients

**src/main/server/rest-api/** - REST API endpoints for server functionality
- Defined using Express.js and Zod for schema validation
- Handle requests from browser-api.ts and external clients

**packages/common/src/** - Shared code between processes (published as `@aiderdesk/common`)
- TypeScript type definitions
- Utility functions and constants
- Localization files (en.json, zh.json, ru.json, ko.json)

**packages/mcp-server/** - MCP server package (`@aiderdesk/mcp-server`)
- Standalone npm package for external MCP client integration
- Exposes AiderDesk functionality to MCP-compatible clients via REST API

**resources/connector/** - Python integration layer
- Python script (connector.py) that interfaces with Aider
- Handles AI model communication and code generation
- Manages project context and file operations

### Key Architectural Patterns

**Multi-Process Communication**: Uses Electron's IPC (Inter-Process Communication) for secure communication between main and renderer processes via the preload layer.

**Agent System**: Built on Vercel AI SDK with MCP support for extensible tool integration. Agents can use both built-in tools and external MCP servers.

**Project Management**: Each project runs as a separate Python process with its own Aider instance, allowing multiple concurrent projects.

**TypeScript Configuration**: Uses project references with separate tsconfig files for different environments (node, web) to ensure proper type checking and compilation.

**Build System**: Powered by electron-vite for development and building, with esbuild for the MCP server package.

### Technology Stack
- **Frontend**: React 19 with TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Electron, Node.js, Python (Aider integration)
- **AI Integration**: Vercel AI SDK, multiple LLM providers (OpenAI, Anthropic, Gemini, etc.)
- **Build Tools**: electron-vite, esbuild, TypeScript project references
- **Testing**: Vitest with React Testing Library, ESLint for linting, Prettier for formatting
- **Internationalization**: i18next with English, Chinese, Russian, and Korean support

## Testing Framework

AiderDesk uses **Vitest** with a multi-configuration approach. For all testing guidance, including patterns, mocking, and organization, **always activate the `Writing Tests` skill**.

### Key Commands
- `npm run test` - Run all tests
- `npm run test:node` - Main process tests
- `npm run test:web` - Renderer process tests
- `npm run test:coverage` - Generate reports
- `npm run test:ui` - Open Vitest UI

**Note**: `packages/extensions/extensions.d.ts` is auto-generated from `packages/common/src/extensions.ts`. Never edit it manually, no need to mention it or worry about it, just update the source in `packages/common/src/extensions.ts` instead.

Refer to the **Writing Tests** skill for:
- Detailed test patterns and examples
- Component and unit testing strategies
- Mocking best practices for Electron and ApplicationAPI
- Test directory structure and naming conventions
- Pre-flight test checklists


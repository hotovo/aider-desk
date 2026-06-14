# Contributing to AiderDesk

Thanks for your interest in contributing! We welcome contributions from engineers who share our vision of transparent, steerable AI.

## Development Setup

### Prerequisites

- **Node.js** 22.x
- **npm** (comes with Node.js)

### Install and Run

```bash
npm install
npm run dev
```

This will start the Electron app in development mode with hot reload.

## Project Architecture

AiderDesk is an Electron app with three main processes:

| Directory | Environment | Responsibility |
|---|---|---|
| `src/main/` | Node.js | Electron main process, IPC handlers, agent system, file system operations |
| `src/renderer/` | Chromium / React | UI components, chat interface, settings |
| `src/preload/` | Isolated | Secure bridge between main and renderer |
| `packages/common/src/` | Shared | TypeScript types, utilities, i18n locales |
| `src/mcp-server/` | Node.js | MCP server for external tool integration |
| `resources/connector/` | Python | Aider CLI integration |

**Tech stack:** React 19, TypeScript, Tailwind CSS, Framer Motion, Electron, Vitest, i18next.

## Coding Conventions

Follow the conventions defined in [.aider-desk/rules/CONVENTIONS.md](.aider-desk/rules/CONVENTIONS.md). Key highlights:

- Use `type Props` directly above the component definition, no `React.FC`
- Use arrow functions wherever possible
- Prefer TypeScript enums over string literal unions
- Use `clsx` for conditional CSS classes
- Use `react-icons` for icons
- Always use i18n for user-facing strings (update both `en.json` and `zh.json` in `packages/common/src/locales/`)
- No `any` type — find and use the proper existing type
- No `import React from 'react'`
- Extract event handlers into named functions; import React event types directly
- Mimic existing code style — look at neighboring files before writing new code

## Making Changes

### Linting and Formatting

```bash
npm run lint          # ESLint with auto-fix
npm run format        # Prettier
```

### Type Checking

```bash
npm run typecheck     # All processes
```

### Testing

#### Unit & Component Tests (Vitest)

```bash
npm run test          # All unit tests
npm run test:node     # Main process tests
npm run test:web      # Renderer (React) tests
npm run test:mcp      # MCP server tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage reports
```

#### E2E Tests (Playwright)

E2E tests run against the headless server mode on an isolated port (24336) with a separate data directory.

```bash
npm run build:server  # Required: build the server first
npm run test:e2e      # Run all E2E tests headlessly
npm run test:e2e:ui   # Open Playwright UI mode (interactive)
npm run test:e2e:headed # Run with visible browser
npm run test:e2e:debug  # Debug mode with step-through
```

E2E tests are located in `e2e/tests/`. The test server uses:
- **Port:** 24336 (isolated from default 24337)
- **Data directory:** `e2e/.test-data/` (cleaned before each test run)

## Submitting Changes

1. **Fork** the repository and create a branch from `main`.
2. Make your changes with clear, descriptive commits.
3. Ensure all checks pass locally — the pre-commit hook runs `lint-staged`, `typecheck`, and `test` automatically.
4. Open a **Pull Request** against `main`.

CI will run the same checks on your PR: lint, typecheck, and tests. All must pass before merge.

## Extensions

- **Fixing an existing extension:** Open a PR against this repository as usual.
- **New extensions:** Please create your own repository. Extensions can be installed by users via the [extension gallery](https://aiderdesk.hotovo.com/docs/extensions/extensions-gallery) or CLI (`npx @aiderdesk/extensions install`). See the [extension documentation](https://aiderdesk.hotovo.com/docs/extensions) for how to build and publish extensions.

## License

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).

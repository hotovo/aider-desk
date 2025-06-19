# PROJECT.md
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
- `npm run typecheck:mcp` - Type check MCP server files (tsconfig.mcp-server.json)

### Linting and Formatting
- `eslint --fix` - Run ESLint with auto-fix and auto-format on specified file(s)

### Building
- `npm run build` - Full build (includes type checking and MCP server build)
- `npm run build:mcp` - Build MCP server only
- `npm run build:win` - Build Windows executable
- `npm run build:mac` - Build macOS executable
- `npm run build:linux` - Build Linux executable
- `npm run build:unpack` - Build without packaging

### Manual Type Checking (for verification)
- `tsc --noEmit -p tsconfig.node.json` - Check main process files
- `tsc --noEmit -p tsconfig.web.json` - Check renderer process files
- `tsc --noEmit -p tsconfig.mcp-server.json` - Check MCP server files

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
- Internationalization (i18n) with English/Chinese support

**src/preload/** - Electron preload scripts
- Secure bridge between main and renderer processes
- API definitions and IPC event listeners
- Type-safe communication layer

**src/common/** - Shared code between processes
- TypeScript type definitions
- Utility functions and constants
- Localization files (en.json, zh.json)

**src/mcp-server/** - Model Context Protocol server
- Standalone MCP server for external tool integration
- Exposes AiderDesk functionality to MCP-compatible clients

**resources/connector/** - Python integration layer
- Python script (connector.py) that interfaces with Aider
- Handles AI model communication and code generation
- Manages project context and file operations

### Key Architectural Patterns

**Multi-Process Communication**: Uses Electron's IPC (Inter-Process Communication) for secure communication between main and renderer processes via the preload layer.

**Agent System**: Built on Vercel AI SDK with MCP support for extensible tool integration. Agents can use both built-in tools and external MCP servers.

**Project Management**: Each project runs as a separate Python process with its own Aider instance, allowing multiple concurrent projects.

**TypeScript Configuration**: Uses project references with separate tsconfig files for different environments (node, web, mcp-server) to ensure proper type checking and compilation.

**Build System**: Powered by electron-vite for development and building, with esbuild for the MCP server component.

### Technology Stack
- **Frontend**: React 18 with TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Electron, Node.js, Python (Aider integration)
- **AI Integration**: Vercel AI SDK, multiple LLM providers (OpenAI, Anthropic, Gemini, etc.)
- **Build Tools**: electron-vite, esbuild, TypeScript project references
- **Testing**: ESLint for linting, Prettier for formatting
- **Internationalization**: i18next with English and Chinese support

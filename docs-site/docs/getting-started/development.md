---
title: "Development Setup & Contributing"
sidebar_label: "Development"
---

# Development Setup & Contributing

## Running from Source

```bash
# Clone the repository
git clone https://github.com/hotovo/aider-desk.git
cd aider-desk

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build executables
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

## Common Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development mode with hot reload |
| `npm run typecheck` | Type check main + renderer processes |
| `npm run test` | Run all tests (main + renderer) |
| `npm run test:watch` | Tests in watch mode |
| `eslint --fix <file>` | Lint and format a file |

The project is an Electron app with a multi-process architecture — see [AGENTS.md](https://github.com/hotovo/aider-desk/blob/main/AGENTS.md) for a detailed map of the codebase before diving in.

## Contributing

We welcome contributions:

1. **Fork** the repository on GitHub
2. **Create a branch**: `git checkout -b my-feature-branch`
3. **Commit** with clear, descriptive messages
4. **Push** and open a Pull Request against the main branch

Guidelines:

- Keep PRs focused on a single feature or bugfix
- Update documentation when adding new features
- Follow the existing code style and conventions
- For major changes, open an issue first to discuss the approach

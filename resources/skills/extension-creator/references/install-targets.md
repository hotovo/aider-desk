# Installation Targets

AiderDesk extensions can be installed in three locations, each with different purposes and workflows.

## Target Options

### 1. Current Project (`.aider-desk/extensions/`)

**Use when:** The extension is specific to this project and should travel with the codebase.

**Location:** `{projectDir}/.aider-desk/extensions/`

**Characteristics:**
- Project-scoped: only available when working in this project
- Committed to version control alongside the project
- Shared with team members via git
- No need to update any registry or manifest files
- Simple drop-in: just create the file/folder in the directory

**Best for:** Project-specific tools, domain-specific rules, team conventions, repo-specific integrations.

---

### 2. Global (`~/.aider-desk/extensions/`)

**Use when:** The extension is a personal utility you want available across all projects.

**Location:** `~/.aider-desk/extensions/`

**Characteristics:**
- User-scoped: available in every project you work on
- Not committed to any repository (lives in home directory)
- Private to your environment
- No need to update any registry or manifest files
- Simple drop-in: just create the file/folder in the directory

**Best for:** Personal productivity tools, custom commands, cross-project utilities, personal preferences.

---

### 3. In-Repo (`packages/extensions/`) — **Only when working inside the AiderDesk project**

**Use when:** You are developing an extension that ships *with* AiderDesk itself, as part of the application.

**Location:** `packages/extensions/extensions/{name}/` or `packages/extensions/extensions/{name}.ts`

**Characteristics:**
- Ships with the AiderDesk application as a built-in extension
- Available to all users by default
- Requires updating `packages/extensions/extensions.json` (the extension registry)
- Requires updating documentation in `docs-site/docs/extensions/examples.md`
- Must follow monorepo conventions (no `@/` imports, proper tsconfig/package.json)
- Subject to the full AiderDesk development workflow (type checking, testing, etc.)

**Best for:** Core features, official integrations, extensions that should be available out-of-the-box.

## How to Choose

Ask the user at the start of every extension creation session:

> "Where should this extension be installed? **Current project** (project-scoped, shared with team), **Global** (personal, available everywhere), or **In-Repo** (ships with AiderDesk, only available when working in the aider-desk project)?"

**Decision tree:**

```
Is the current project the AiderDesk codebase itself?
├── YES → Offer all 3 options (Project, Global, In-Repo)
│         In-Repo means: packages/extensions/ + update extensions.json + update docs
│
└── NO  → Offer only 2 options (Project, Global)
          Project = .aider-desk/extensions/ in current project
          Global  = ~/.aider-desk/extensions/
```

## Key Differences Summary

| Aspect | Project | Global | In-Repo |
|--------|---------|--------|---------|
| Location | `.aider-desk/extensions/` | `~/.aider-desk/extensions/` | `packages/extensions/extensions/` |
| Scope | This project only | All projects | All users (ships with app) |
| Version controlled | Yes (with project) | No | Yes (with AiderDesk) |
| Update extensions.json | No | No | **Yes** |
| Update examples.md docs | No | No | **Yes** |
| npm install needed | No | No | **Yes** (if folder extension) |
| Available immediately | Yes | Yes | After build/restart |

## Shared Rules (All Targets)

Regardless of target, these rules always apply:

- Implement the `Extension` interface correctly
- Export `metadata` object with name, version, description, author, capabilities
- Export class as `default`
- Never use `@/` imports in extension files
- Store config files inside the extension directory
- Use proper TypeScript (ES2020+ modules for folder extensions)

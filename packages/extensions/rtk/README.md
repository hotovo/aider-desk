# RTK Auto-Rewrite Extension

This extension transparently rewrites shell commands to their RTK equivalents, reducing LLM token consumption by 60-90% on common development commands.

## What This Extension Does

- **Intercepts bash commands**: Listens to `power---bash` tool calls
- **Auto-rewrites commands**: Transforms commands like `git status` → `rtk git status`
- **Transparent operation**: The AI never sees the rewrite, just gets optimized output
- **Zero context overhead**: No instructions needed in CLAUDE.md

## What is RTK?

[RTK (Rust Token Killer)](https://github.com/rtk-ai/rtk) is a CLI proxy that filters and compresses command outputs before they reach your LLM context. It applies smart filtering, grouping, truncation, and deduplication to dramatically reduce token usage.

### Token Savings Example (30-min session)

| Operation | Standard | RTK | Savings |
|-----------|----------|-----|---------|
| `ls` / `tree` | 2,000 | 400 | -80% |
| `cat` / `read` | 40,000 | 12,000 | -70% |
| `git status` | 3,000 | 600 | -80% |
| `npm test` | 25,000 | 2,500 | -90% |

## Commands Rewritten

| Raw Command | Rewritten To |
|-------------|--------------|
| `git status/diff/log/add/commit/push/pull/...` | `rtk git ...` |
| `gh pr/issue/run` | `rtk gh ...` |
| `cargo test/build/clippy` | `rtk cargo ...` |
| `cat <file>` | `rtk read <file>` |
| `grep/rg <opts> <pattern> <path>` | `rtk grep <pattern> <path> <opts>` |
| `ls` / `tree` | `rtk ls` / `rtk tree` |
| `vitest` / `pnpm test` | `rtk vitest run` |
| `tsc` / `vue-tsc` | `rtk tsc` |
| `eslint` / `prettier` | `rtk lint` / `rtk prettier` |
| `pytest` / `ruff` | `rtk pytest` / `rtk ruff ...` |
| `go test/build/vet` | `rtk go ...` |
| `docker ps/images/logs` | `rtk docker ...` |
| `kubectl get/logs` | `rtk kubectl ...` |
| `curl` / `wget` | `rtk curl` / `rtk wget` |

Commands already using `rtk`, heredocs (`<<`), and unrecognized commands pass through unchanged.

## Prerequisites

### 1. Install RTK

**Homebrew (macOS/Linux):**
```bash
brew install rtk
```

**Quick Install (Linux/macOS):**
```bash
curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/master/install.sh | sh
```

This script:
- Downloads the latest RTK binary for your platform
- Installs to `~/.local/bin` (XDG standard, no sudo required)
- Supports custom install path via `RTK_INSTALL_DIR` environment variable

```bash
# Custom install location
RTK_INSTALL_DIR=/usr/local/bin curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/master/install.sh | sh
```

**Verify installation:**
```bash
rtk --version
rtk gain  # Must show token savings stats
```

> **Note**: RTK installs to `~/.local/bin` by default. Add it to your PATH if needed:
> ```bash
> echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc  # or ~/.zshrc
> ```

### 2. Ensure `jq` is installed

The rewrite script uses `jq` for JSON parsing:

```bash
# macOS
brew install jq

# Linux (Debian/Ubuntu)
sudo apt install jq

# Linux (Fedora)
sudo dnf install jq
```

## Installation

1. Copy the extension folder to your AiderDesk extensions directory:

```bash
cp -r . ~/.aider-desk/extensions/rtk
```

2. Make the rewrite script executable:

```bash
chmod +x ~/.aider-desk/extensions/rtk/rtk-rewrite.sh
```

3. Restart AiderDesk

## How It Works

```
AI Assistant calls:  power---bash { command: "git status" }
                              │
                       ┌──────▼──────────────────┐
                       │  RTK Extension          │
                       │  onToolCalled()         │
                       └──────┬──────────────────┘
                              │
                       ┌──────▼──────────────────┐
                       │  rtk-rewrite.sh         │
                       │  "git status"           │
                       │    → "rtk git status"   │
                       └──────┬──────────────────┘
                              │
                       ┌──────▼──────────────────┐
                       │  Modified event:        │
                       │  { command:             │
                       │    "rtk git status" }   │
                       └──────┬──────────────────┘
                              │
AI receives:    "3 modified, 1 untracked ✓"
                (not 50 lines of raw git output)
```

## Commands

The extension provides commands to control the rewriting behavior:

| Command | Description |
|---------|-------------|
| `/rtk on` | Enable command rewriting |
| `/rtk off` | Disable command rewriting |
| `/rtk status` | Show current status and dependency check |

### Example

```
> /rtk status
RTK status:
  Enabled: ✓ yes
  RTK binary: ✓ installed
  jq binary: ✓ installed
  Rewrite script: ✓ found

> /rtk off
✓ RTK command rewriting disabled

> /rtk on
✓ RTK command rewriting enabled
```

## Configuration

The extension uses the bundled `rtk-rewrite.sh` script. You can modify this script to:

- Add new command rewrites
- Change rewrite patterns
- Add exclusions

## Troubleshooting

### Commands not being rewritten

1. Verify RTK is installed and in PATH:
   ```bash
   which rtk
   rtk --version
   ```

2. Verify jq is installed:
   ```bash
   which jq
   ```

3. Check AiderDesk logs for extension errors

4. Test the rewrite script manually:
   ```bash
   echo '{"tool_input":{"command":"git status"}}' | ~/.aider-desk/extensions/rtk/rtk-rewrite.sh
   ```

### Wrong RTK installed

There's another project called "rtk" (Rust Type Kit). Verify you have the correct one:

```bash
rtk gain  # Should show token savings stats
```

If this fails, you have the wrong package. Reinstall from the correct source.

## Files

- `index.ts` - Extension source code
- `rtk-rewrite.sh` - Command rewrite logic
- `README.md` - This file

## Resources

- [RTK Website](https://www.rtk-ai.app)
- [RTK GitHub](https://github.com/rtk-ai/rtk)
- [RTK Documentation](https://github.com/rtk-ai/rtk#documentation)

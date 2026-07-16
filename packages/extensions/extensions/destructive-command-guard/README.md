# Destructive Command Guard

Blocks dangerous git and shell commands from being executed by agents using [dcg](https://github.com/Dicklesworthstone/destructive_command_guard).

## What This Extension Does

- **Intercepts bash commands**: Listens to `power---bash` tool calls
- **Evaluates via dcg**: Pipes the command to `dcg` using the Claude Code hook protocol
- **Blocks destructive operations**: Returns the command as blocked when dcg detects a dangerous pattern
- **Fail-open on errors**: If dcg is unavailable or errors, commands pass through unchanged
- **Transparent operation**: No prompt instructions needed — protection happens at the tool execution layer

## What is dcg?

[dcg (Destructive Command Guard)](https://github.com/Dicklesworthstone/destructive_command_guard) is a Rust CLI that blocks dangerous git and shell commands from AI agents. It protects against:

- **Accidental data loss**: `git checkout --`, `git reset --hard` on uncommitted changes
- **Remote history destruction**: `git push --force` that overwrites shared branch history
- **Stash loss**: Dropping or clearing stashes with important work-in-progress
- **Filesystem accidents**: Recursive deletion (`rm -rf`) outside designated temp directories
- **Database destruction**: `DROP TABLE`, destructive migrations
- **Docker/Kubernetes**: `docker system prune`, `kubectl delete` without dry-run

## How It Works

```
AI Assistant calls:  power---bash { command: "git reset --hard" }
                              │
                       ┌──────▼──────────────────┐
                       │  dcg Extension          │
                       │  onToolCalled()         │
                       └──────┬──────────────────┘
                              │
                       ┌──────▼──────────────────┐
                       │  echo JSON | dcg        │
                       │  → permissionDecision:  │
                       │    "deny" / "allow"     │
                       └──────┬──────────────────┘
                              │
              deny ──────────┴──── allow
                │                      │
  returns { output:          returns undefined
    "🛡️ BLOCKED by dcg:      (command runs normally)
    destructive command
    detected..." }
```

The extension sends the command to dcg in the Claude Code hook format:

```json
{
  "tool_name": "Bash",
  "tool_input": { "command": "git reset --hard" }
}
```

dcg responds with a JSON decision:

```json
{
  "hookSpecificOutput": {
    "permissionDecision": "deny",
    "permissionDecisionReason": "BLOCKED by dcg\n\nReason: ..."
  }
}
```

When the decision is `deny`, the extension replaces the tool output with a block message, preventing execution entirely.

## Prerequisites

### 1. Install dcg

**Install script (Linux/macOS):**
```bash
curl -fsSL https://raw.githubusercontent.com/Dicklesworthstone/destructive_command_guard/main/install.sh | sh -s -- --no-configure
```

**Cargo (all platforms):**
```bash
cargo install destructive-command-guard
```

**Verify installation:**
```bash
dcg --version
```

> **Note**: Ensure `dcg` is available on your `PATH`. The extension checks for the binary on startup and logs a warning if it's missing.

### 2. Platform support

- **Linux**: ✓
- **macOS**: ✓
- **Windows**: ✓

## Commands

| Command | Description |
|---------|-------------|
| `/dcg on` | Enable command guarding |
| `/dcg off` | Disable command guarding |
| `/dcg status` | Show current status and binary check |

### Example

```
> /dcg status
Destructive Command Guard status:
  Enabled: ✓ yes
  dcg binary: ✓ installed

> /dcg off
🛡️ Destructive Command Guard disabled

> /dcg on
🛡️ Destructive Command Guard enabled
```

## Configuration

The extension executes `dcg` with a 10-second timeout. If dcg errors or times out, the command is allowed to pass through (fail-open design) to avoid blocking the agent indefinitely.

For custom pattern packs, allowlists, and advanced dcg configuration, see the [dcg documentation](https://github.com/Dicklesworthstone/destructive_command_guard#configuration).

## Files

- `index.ts` — Extension source code

## Resources

- [dcg GitHub](https://github.com/Dicklesworthstone/destructive_command_guard)
- [dcg Configuration](https://github.com/Dicklesworthstone/destructive_command_guard#configuration)
- [dcg Custom Packs](https://github.com/Dicklesworthstone/destructive_command_guard/blob/main/docs/custom-packs.md)

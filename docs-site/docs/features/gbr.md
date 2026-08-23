---
title: "Build Remote Agent"
sidebar_label: "Build Remote Agent"
---

# Pair a phone with Build Remote Agent

AiderDesk can keep orchestrating on the desktop while a phone running
**Build Remote Agent** spectates (and can inject into) the same session
through the free MIT `gbr-agent`. Phone and PC never open ports to each
other.

Website: https://grokbuildremote.com/  
Agent: https://github.com/LinespottingOrg/GrokBuildRemote-Agents (MIT)  
Protocol: `gbr/1` · need agent **v0.6.0+**

Independent product by Linespotting AB. Not affiliated with xAI or SpaceX.

This does **not** replace AiderDesk's own REST API (`http://localhost:24337/api`)
or the built-in `@aiderdesk/mcp-server`. Those stay on the desktop.
The phone attaches only to `gbr-agent`.

## Install + pair

```bash
# macOS / Linux
curl -fsSL https://grokbuildremote.com/install.sh | bash
gbr-agent version          # must print v0.6.0 or newer
gbr-agent pair             # QR in browser + printed 8-char code
gbr-agent run              # leave running next to AiderDesk
```

```powershell
# Windows
irm https://grokbuildremote.com/install.ps1 | iex
gbr-agent version
gbr-agent pair
gbr-agent run
```

Phone: open Build Remote Agent → **Scan QR from computer** (or type the
8-char code). **Unpair** in Settings before changing PCs. Force-close is
not enough.

## Attach (only these)

After `gbr-agent run`:

| How | Where |
|-----|--------|
| Bot API | `http://127.0.0.1:8788` |
| MCP stdio | `gbr-mcp` (see snippet below) |

```bash
curl -sS http://127.0.0.1:8788/health
curl -sS http://127.0.0.1:8788/v1/sessions
```

Phone is spectator + veto. Orchestration stays in AiderDesk.

Do not commit mailbox keys. Phone **Settings → Bot API** is the only
place the relay key is copied.

## MCP snippet

Paste into **Settings → MCP Servers** (or `~/.aider-desk/mcp-servers.json` /
`<project>/.aider-desk/mcp-servers.json`). Requires `gbr-agent run`.
Never put mailbox keys here.

```json
{
  "mcpServers": {
    "gbr": {
      "command": "node",
      "args": [
        "GrokBuildRemote-Agents/mcp/gbr-mcp/bin/gbr-mcp.js"
      ]
    }
  }
}
```

Clone and install the MCP binary first:

```bash
git clone https://github.com/LinespottingOrg/GrokBuildRemote-Agents.git
cd GrokBuildRemote-Agents/mcp/gbr-mcp && npm install
node bin/gbr-mcp.js --diagnose
```

Point `args` at the absolute path of `bin/gbr-mcp.js` on your machine.

HTTP attach (same loopback Bot API) is also valid if you prefer URL
servers:

```json
{
  "mcpServers": {
    "gbr": {
      "url": "http://127.0.0.1:8788"
    }
  }
}
```

## Skill (optional)

AiderDesk loads skills from `~/.aider-desk/skills/` and
`.aider-desk/skills/`. Drop a `gbr/SKILL.md` there if you want the agent
to know the pair/run/attach loop. See [Skills](./skills.md).

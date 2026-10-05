# Skill Gallery Extension for AiderDesk

Browse, install, and uninstall AI agent skills from popular GitHub repositories directly in AiderDesk. Skills are Claude Skills-compatible directories containing a `SKILL.md` file, and become available to agents in Aider mode once installed.

![Skill Gallery](https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/skill-gallery/screenshot.png)

## How It Works

1. On load, the extension clones each configured source repository (shallow clone) into a local cache at `~/.aider-desk/cache/skill-gallery/`
2. It scans the repositories (or a subdirectory of them, when configured) for directories containing a `SKILL.md` file and reads the skill's name and description from the frontmatter
3. Skills are listed in the gallery, opened via the gallery icon in the header of the task view — with search, a source filter, and pagination for large catalogs
4. Installing a skill copies its directory into the skills folder of the selected target (the **Install to** dropdown in the gallery toolbar), where AiderDesk's skill system automatically discovers it — no restart needed
5. Uninstalling removes the corresponding directory from the target skills folder

## Default Sources

| Source | Repository | Scanned Subdirectory |
|--------|-----------|----------------------|
| Anthropic Official | [anthropics/skills](https://github.com/anthropics/skills) | `skills` |
| ECC | [affaan-m/ECC](https://github.com/affaan-m/ECC) | `.agents/skills` |
| Superpowers | [obra/superpowers](https://github.com/obra/superpowers) | `skills` |
| Awesome Claude Skills | [ComposioHQ/awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills) | (repo root) |
| Agentic Awesome Skills | [sickn33/agentic-awesome-skills](https://github.com/sickn33/agentic-awesome-skills) | `skills` |
| Matt Pocock: Engineering | [mattpocock/skills](https://github.com/mattpocock/skills) | `skills/engineering` |
| Matt Pocock: Productivity | [mattpocock/skills](https://github.com/mattpocock/skills) | `skills/productivity` |
| Addy Osmani: Agent Skills | [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) | `skills` |
| Reverse Skill | [zhaoxuya520/reverse-skill](https://github.com/zhaoxuya520/reverse-skill) | `skills` |
| Cursor Pstack | [cursor/plugins](https://github.com/cursor/plugins) | `pstack/skills` |

Default sources are always included and cannot be removed from the gallery.

## Adding Custom Sources

Open the gallery and use the **Sources** dialog to add your own repositories. Each source needs:

- **Name** — shown in the gallery as the source label
- **Repository URL** — a GitHub (or other git) repository URL
- **Subdirectory** (optional) — scan only this folder of the repository instead of the root. Useful when a repository contains skills alongside other code, or holds several skill collections (e.g. `skills`)

Custom sources are stored in the extension's `config.json` and can be removed at any time via the Sources dialog.

> **Requirements**: `git` must be available on your system, since sources are fetched via shallow clones.

## Install Targets

When installing or uninstalling, choose one of two targets:

- **Global** — all projects: `~/.aider-desk/skills/`
- **Project** — the currently selected project only: `<project>/.aider-desk/skills/`

Installed skill directories are named `<sourceId>--<skillDirName>` (for example `anthropics--pdf`), so skills from different sources never collide.

## Uninstalling

Skills can be uninstalled from the same gallery view. If a skill is installed in both targets, uninstall it separately for each target.

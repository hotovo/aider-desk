# BMAD Extension for AiderDesk

Lean backend that integrates a standard [BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD) installation into [AiderDesk](https://github.com/hotovo/aider-desk). The extension owns no workflow definitions of its own: everything it shows and starts comes from the installed method.

> **Version:** 2.0.0 · **Requires:** AiderDesk ≥ 0.77.0 (verified against 0.81.0) · **BMAD:** ≥ 6.10 (6.12.0 verified) · **License:** MIT

---

## How it works

1. Install the method once per project: `npx bmad-method install` in the project root (interactive, choose modules and tools as usual).
2. The extension reads the installation's own manifests:
   - `_bmad/_config/manifest.yaml` (version, installed modules, configured tools)
   - `_bmad/_config/skill-manifest.csv` (all installed skills)
   - `_bmad/<module>/module-help.csv` (the method's own menu: names, menu codes, phases, ordering)
3. The AiderDesk UI lists exactly this menu, grouped by module and phase. Starting an entry injects its original `SKILL.md` and the installed method drives execution.
4. Slash skills (`/bmad-help`, `/bmad-brainstorm`, ...) are provided natively by AiderDesk's project-skill support; the extension does not intercept chat.

### What the extension does

- **Discovery:** builds the catalog from the manifests above. No hardcoded workflow list.
- **Execution:** one generic start template loads the selected skill; install/update wraps `npx bmad-method install`.
- **Progress:** tracks each entry's artifacts by its own output metadata plus `sprint-status.yaml`. Matching tolerates naming variants (brainstorm vs brainstorming) and resolves nested config templates; entries without usable artifact metadata stay untracked and are listed as such in the UI. An artifact with a non-final frontmatter status (e.g. `draft`) counts as in progress only while it is the newest artifact in the project: the method never sets a product brief to final, so a stale draft would otherwise keep a phantom Continue button alive and shadow the real next step (verified: completed planning of agent-x now suggests Build instead of Create Brief).
- **bmad-help grounding:** after every install/update (and once on first access per session) the extension appends a deterministic state-detection block to the installed `bmad-help/SKILL.md`: per catalog row it states where to scan and which words identify artifacts, using exactly the same token semantics as this extension's progress tracking. It also names `_bmad-output/implementation-artifacts/sprint-status.yaml` (`development_status`) as the authority for implementation progress, so `/bmad-help` no longer recommends completed planning workflows like Create Epics and Stories just because an artifact is named `epics.md`. The block lives between HTML comment markers; replacing it is idempotent and never touches upstream content outside the markers. Untracked rows that share their skill with a tracked row (e.g. Sprint Status [SS] and Sprint Planning [SP]) inherit that row's artifact as their completion signal. When bmad-help is started from the UI, the extension additionally prepends a live project-state snapshot to the skill context (completed and in-progress rows with artifact paths, untracked rows with reasons, sprint board counts, recommended next steps), so the skill orients from the same deterministic scan as the UI instead of fuzzy filename matching at runtime.
- **Safety:** auto-approves reads inside `_bmad/`, `_bmad-output/` and the installed skills directories (segment-based matching, anchored to the project's skills dir), auto-approves writes inside `_bmad-output/` and `_bmad/render/`, enforces `uv run` for Python, blocks chained, redirected or multi-line bash commands from auto-approval. Policy isolated in lib/tool-approval.ts with unit tests.

### Additional modules

Modules such as Game Dev Studio (`gds`), Creative Intelligence Suite (`cis`) or Test Architect (`tea`) appear automatically once installed. Re-run the installer to add them; no extension change needed.

---

## Features

### Welcome Page (BMAD mode)

- **Pinned orchestrator:** BMAD Help sits directly under the header, always visible and one click away, and starts in a fresh task. It is no longer buried in the helpers section; a Help button in the task bar opens it from any chat
- **Method menu:** all entries from `module-help.csv` whose skill is installed, grouped by original phase (`plan`, `2-planning`, `ship`, `anytime` or whatever the installed modules define), with menu codes and search. Skills listed by several modules merge into one card with module badges; phases start collapsed except the current one, which is highlighted with a you-are-here badge; helper entries without artifact output (party mode, advanced elicitation) have their own section
- **All Skills tab:** every skill of the installer manifest, including internal ones without a menu row
- **Project compass:** one merged card with the overall progress bar over tracked lifecycle skills (anytime helpers excluded, they keep their own bar), per-phase bars with plan and 2-planning merged into one Planning phase, epic/sprint badge from `sprint-status.yaml` and the phase stepper with done/current/upcoming markers
- **Next steps:** up to 3 suggestions from the method's `followed-by` chain, required flags and sprint state. The first recommended step renders as a hero card with phase context and a large start button; remaining steps are compact rows; prerequisite hints and artifact links are included
- **Artifact links**, start confirmation and a 15s background refresh while the extension is installed; task state changes refresh both UI surfaces immediately
- **Update banner:** newer bmad-method patches in the same minor line; installs the resolved patch version
- **Safe reset:** moves `_bmad-output` to `_bmad-output-trash-<timestamp>` instead of deleting

### Task Actions

Slim bar in every task of a BMAD project: current workflow badge (switchable via dropdown over the catalog; a finished workflow in the task metadata shows a check mark instead of implying active work), artifact link, mini progress, Help button, follow-up chips and a toggleable project overview.

Note on visibility: the Welcome Page overlay only renders while a task has no messages yet. As soon as any message exists in the conversation (a normal prompt or an internal skill activation record), AiderDesk shows the chat instead - this is core AiderDesk behavior, not controlled by the extension. To follow progress while working inside a task, use the project-overview toggle in the Task Actions bar.

---

## Requirements

| Component | Version | Notes |
| --- | --- | --- |
| AiderDesk | ≥ 0.77.0 | extension API 0.81.0 |
| bmad-method | ≥ 6.10 | 6.12.0 verified; standard installation layout required |

## Installation

Install using the official installer CLI:

```bash
# For all projects (recommended)
npx @aiderdesk/extensions install bmad --global

# Or only for the current project
npx @aiderdesk/extensions install bmad
```

The installer copies the extension into `~/.aider-desk/extensions/bmad` (project-local: `.aider-desk/extensions/bmad`) and runs `npm install` automatically.

1. Start/restart AiderDesk (a running instance picks the new extension up via hot reload).
2. In a project, run `npx bmad-method install` (or use the Welcome Page button, which runs the same installer non-interactively).

The BMAD UI appears only when a standard installation exists in the opened project.

### Configuration (environment variables, set before starting AiderDesk)

| Variable | Default | Purpose |
| --- | --- | --- |
| `AIDERDESK_BMAD_PACKAGE` | `bmad-method@6.12.0` | package spec used by the built-in install/update |
| `AIDERDESK_BMAD_MODULES` | `bmm` | modules for non-interactive install |
| `AIDERDESK_BMAD_TOOLS` | `amp` | tool target for non-interactive install (`.agents/skills`) |

Installations made manually with other tools (for example antigravity) are detected via the manifest regardless of these defaults.

---

## Quick start

1. Open a project with a BMAD installation and switch to BMAD mode.
2. Follow the phase order on the Welcome Page: brief or PRFAQ → PRD → UX (optional) → architecture → epics and stories → sprint planning.
3. Start Build (`BD`) for the implementation loop; stories come from the sprint board created by sprint planning.
4. Slash skills work directly in chat: `/bmad-help` explains the current state.

## Known limitations

- On Windows consoles, Python helper scripts that print emoji can fail with UnicodeEncodeError (legacy console codepage vs utf-8). The extension sets `PYTHONIOENCODING=utf-8` for its own process at load time and injects the hint to prefix such runs: `$env:PYTHONIOENCODING='utf-8'; uv run _bmad/scripts/<script>.py`. If you see the error anyway, run AiderDesk with the variable set in the environment it was started from.
- Completion tracking covers entries with usable artifact metadata in `module-help.csv`; unknown placeholders degrade to the resolvable base path (for example `{slug}` falls back to the specs folder). Entries without any artifact location stay untracked and are listed under "Not counted in progress" in the UI.
- Workflow IDs changed in v2.0 (now canonical skill ids). Tasks created with v1.x workflow metadata lose their continuation link; restart the workflow from the UI.
- The extension targets the 6.10+ skill layout; older layouts must be migrated by the installer's update action.

## Development

- No build step: AiderDesk loads `index.ts` directly.
- Type check: `npx tsc --noEmit`
- Tests: `npx vitest run` (181 tests across 13 files)
- Key sources: `lib/install-registry.ts` (discovery), `lib/context-preparer.ts` + `context/workflow-start.json.hbs` (execution), `lib/bmad-manager.ts` (status/install/update), `lib/help-skill-hints.ts` (bmad-help state hints), `lib/help-state.ts` (bmad-help state snapshot)

## Credits

Built on the [BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD) by BMad Code Org and [AiderDesk](https://github.com/hotovo/aider-desk) by hotovo. Based on the original BMAD extension for AiderDesk by wladimiiir.

## Contributing

This extension lives in the [AiderDesk](https://github.com/hotovo/aider-desk) repository; contributions are welcome there.

## License

MIT

# ADR-0041: Mirror-Surface Sync for Shared Contract Changes

## Status

Proposed (2026-09-27)

## Context

AiderDesk shares contracts across several surfaces that mirror them: the published extension types, user-facing documentation, and agent-facing skills. When a contract changes — a parameter is renamed or redefined, a stored value's meaning changes, a field's semantics evolve — every mirror must be updated in the same change, or the published types, docs, and skill knowledge silently diverge from runtime behavior.

A concrete recent miss: adding per-agent memory scoping (`useAgentMemoryScope` on `AgentProfile`, scope value `agent-profile:{profileId}`) redefined the first parameter of `MemoryManager.storeMemory/retrieveMemories` and the meaning of the persisted `projectid` value. The core code, REST/tool/UI surfaces, and the runtime contract were updated, but the `MemoryContext` interface in `packages/common/src/extensions.ts` (the public extension API), `docs-site/docs/extensions/api-reference.md`, and `resources/skills/extension-creator/SKILL.md` still documented the old `projectId` semantics — they were found and fixed only after the fact. A follow-up sweep then found that `docs-site/docs/agent-mode/memory.md` and `resources/skills/extension-creator/references/extension-interface.md` were still stale; they had been missed by both the original change and the first patch. The costs of a stale mirror are not merely cosmetic: skills are executed by agents, so a stale skill example reproduces the outdated contract in every agent-authored extension, and the doc site teaches users the old API.

The incident revealed why existing guardrails failed to trigger:

- ADR-0011's guardrail ("update the REST, tool, and UI surfaces together") covers only the *operational* surfaces of the memory capability, not its documentation or the extension API.
- ADR-0029's guardrail ("Treat `packages/common/src/extensions.ts` as a public API: additive changes only; update docs and regenerate types") is a one-line obligation with no named surfaces — reviewers cannot mechanically verify it, and this review applied it and still missed both the contract source and the docs, because the ADR review workflow selects ADRs by changed files and `extensions.ts` was not in the diff.
- ADR-0033 handles only the generated `.d.ts` artifact, by construction.
- No ADR names `docs-site/` or `resources/skills/` as sync surfaces at all.

## Decision Drivers

- **Must** treat documentation, generated artifacts, and skills as part of the change surface of a shared contract
- **Must** make the mirror-surface inventory explicit and auditable — verification must be mechanical (grep), not from memory
- **Must** keep agent-facing knowledge (skills) in sync: stale skill patterns regenerate the omission in every future agent-authored extension
- **Should** keep the sweep cheap: style-only changes (local variable renames, comment/JSDoc reflow) to contract-adjacent code must not trigger a full sweep

## Considered Options

### Option A — Rely on review memory and thin "update docs" notes

- **Pros**: Zero upfront cost; no inventory to maintain.
- **Cons**: The obligation is invisible when the contract file is not in the diff; no reviewer can grep for a duty. The incident shows both human review and the ADR-based review workflow missed the contract and its mirrors with exactly this regime.

### Option B — Declared inventory of mirror surfaces swept per contract change

- **Pros**: The inventory lives in one auditable file next to the contracts; every surface is named with its path, so verification is mechanical (grep the contract's symbols across named files and confirm no stale shape survives); skills and docs get updated by the same change because reviewers can mechanically trace the full surface set.
- **Cons**: The inventory must be maintained — new surfaces must be added and retired ones removed; contributors touching contract-adjacent files must consult the inventory even for small changes.

## Decision

Implement an **explicit mirror-surface inventory** in this ADR: a change to a shared contract must sweep **all mirror surfaces of that contract, in the same change**. The inventory is authoritative; when a new mirror surface is created, it must be added to the inventory in the same change.

**Shared contracts and their mirror surfaces:**

1. `packages/common/src/extensions.ts` — the **public extension API** (`Extension`, `ExtensionContext`, `MemoryContext`, and related types):
   - `packages/extensions/extensions.d.ts` — generated artifact wrapped by the build ([ADR-0033](../packages-monorepo/0033-generated-extension-types.md)); never hand-edited, verified by a build
   - `docs-site/docs/extensions/api-reference.md` — user-facing API reference (must stay in lockstep with the contract source)
   - `docs-site/docs/extensions/creating-extensions.md` — tutorial and worked examples
   - `resources/skills/extension-creator/SKILL.md` — agent-facing patterns and examples
   - `resources/skills/extension-creator/references/extension-interface.md` — the skill's embedded interface reference
2. `packages/common/src/tools.ts` — the **tool namespace registry** ([ADR-0008](../agent-system/0008-tool-group-namespacing-contracts.md)):
   - `docs-site/docs/extensions/api-reference.md` — tools documented for extension contributions
   - `docs-site/docs/agent-mode/**` — agent-mode user docs referencing built-in tools
   - `resources/skills/extension-creator/**` — skill references to built-in tool names
3. `packages/common/src/api.ts` — the **ApplicationAPI/IPC contract** ([ADR-0002](../core-architecture/0002-preload-ipc-bridge-and-api-contract.md)):
   - `docs-site/docs/**` — wherever the API surface is documented for users
   - `packages/mcp-server/**` — the standalone MCP package mirrors API operations over REST ([ADR-0019](../api-surface/0019-standalone-mcp-server-package.md))
4. `packages/common/src/types/common.ts` — **persisted data shapes** shared across processes; mirrors are any entries in `docs-site/**` and `resources/skills/**` that document those fields (e.g. profile fields mirrored in agent settings docs and the extension-creator skill).

Memory's *operational* surfaces (REST, tools, UI) remain governed by [ADR-0011](../agent-system/0011-agent-memory-system.md); this ADR adds the documentation/skill mirrors and generalizes the pattern to all shared contracts. It complements, not supersedes, ADR-0029.

When the change is **style-only** (local renames, comment or JSDoc reflow with no semantic change), the sweep is not required. When a change retires a mirror surface (e.g. removes a doc page or skill file), remove it from the inventory in the same change.

## Rationale

The code surfaces of contracts already have owners: ADR-0033 generates `.d.ts` by construction and ADR-0011 binds REST/tool/UI. The documentation and skill mirrors are equally load-bearing — docs teach users the API, and skills are *runtime instructions for agent-authored extensions* — but they were owned by nobody, so they drift silently. The inventory converts an invisible, unsynced obligation into a mechanical, reviewable requirement: grep the contract's changed symbols across the named surfaces and confirm no stale shape survives. It also makes ADR-based reviews able to catch the failure mode, because the reviewer checking any one of the surface files now has a pointer to the canonical contract source and the full inventory.

## Consequences

### Positive

- Published types, user docs, and skill knowledge cannot drift from implemented behavior
- Review verification is mechanical: confirm the inventory was swept (or prove the change is style-only)
- Skill knowledge stays truthful, so agent-authored extensions respect the current contract

### Negative

- A contract change touches more files; some sweeps are pure-docs changes with no runtime impact
- The inventory must be maintained; missed maintenance recreates drift

### Risks & Mitigations

- Risk: a new mirror surface (doc page, skill) is created without being added to the inventory — Mitigation: the Do guardrail requires adding new doc/skill mirrors in the same change that creates them, and a missed inventory entry shows up as a stale mirror at the next contract change
- Risk: over-eager sweeping for style-only changes adds noise — Mitigation: the style-only exception is explicit above

## Guardrails for Agents

### Do

- Before finalizing a change to `packages/common/src/extensions.ts`, `packages/common/src/tools.ts`, `packages/common/src/api.ts`, or `packages/common/src/types/common.ts`, run a symbol sweep across every named surface — for example `grep -rn "<changed symbol>" docs-site resources/skills` — and update every stale mirror (identifiers, parameter names, stored-value semantics, examples)
- Update all mirrors in the same change; do not split into a follow-up
- When creating or retiring a doc page or skill file that mirrors a contract, add or remove it from this ADR's inventory in the same change
- Verify the sweep mechanically: grep the changed symbols and confirm zero stale identifiers or stale examples remain across the inventory

### Don't

- Don't hand-edit `packages/extensions/extensions.d.ts` — regenerate via the build ([ADR-0033](../packages-monorepo/0033-generated-extension-types.md))
- Don't treat docs-only fixes as cosmetics: a stale skill example is a runtime instruction that produces broken agent-authored extensions
- Don't assume a guardrail elsewhere (e.g. ADR-0011, ADR-0029) covers documentation mirrors; this inventory is the owner for docs/skills

## Related Decisions

- [ADR-0029: Lifecycle-Hook Extension System](0029-lifecycle-hook-extension-system.md) — generalizes its "update docs and regenerate types" guardrail into a named, checkable inventory; the extension contract ownership that anchors the inventory
- [ADR-0033: Generated Extension Type Declarations](../packages-monorepo/0033-generated-extension-types.md) — the generated `.d.ts` is a code surface, updated by build
- [ADR-0011: Local Vector Memory System](../agent-system/0011-agent-memory-system.md) — complementary: covers REST/tool/UI operational surfaces
- [ADR-0008: Tool Group Namespacing as Stable Contract](../agent-system/0008-tool-group-namespacing-contracts.md) — the tool namespace contract mirrored in docs/skills
- [ADR-0002: Preload IPC Bridge and Shared API Contract](../core-architecture/0002-preload-ipc-bridge-and-api-contract.md) — the ApplicationAPI contract and its mirror surfaces
- [ADR-0019: Standalone MCP Server Package](../api-surface/0019-standalone-mcp-server-package.md) — REST-mirroring package inventory item

## References

- Real-world incident this ADR responds to: per-agent memory scoping (`useAgentMemoryScope`, scope `agent-profile:{profileId}`) first shipped with stale `MemoryContext` docs in `packages/common/src/extensions.ts`, `docs-site/docs/extensions/api-reference.md`, and `resources/skills/extension-creator/SKILL.md`; the first patch missed `docs-site/docs/agent-mode/memory.md` and `resources/skills/extension-creator/references/extension-interface.md`, which were caught by a follow-up sweep.

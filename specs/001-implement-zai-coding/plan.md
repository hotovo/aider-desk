
# Implementation Plan: ZAI Coding Plan Provider

**Branch**: `001-implement-zai-coding` | **Date**: Fri Oct 03 2025 | **Spec**: /specs/001-implement-zai-coding/spec.md
**Input**: Feature specification from `/specs/001-implement-zai-coding/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from file system structure or context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, `GEMINI.md` for Gemini CLI, `QWEN.md` for Qwen Code or `AGENTS.md` for opencode).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Implement ZAI as a distinct coding plan provider in AiderDesk, using the `zai-plan` provider prefix with OpenAI-compatible AI SDK model integration. The provider will connect to https://api.z.ai/api/coding/paas/v4 for AI operations and https://api.z.ai/api/paas/v4/models for model discovery, providing users with native ZAI configuration without requiring generic OpenAI-compatible setup.

## Technical Context
**Language/Version**: TypeScript 5.5.2, React 19.1.1, Electron 37.4.0  
**Primary Dependencies**: @ai-sdk/openai-compatible, electron-vite, React 18, Tailwind CSS, Vercel AI SDK  
**Storage**: electron-store for configuration, better-sqlite3 for data persistence  
**Testing**: ESLint, TypeScript compiler, custom test framework  
**Target Platform**: Cross-platform desktop (Windows, macOS, Linux) via Electron  
**Project Type**: Web application (Electron with main/renderer process separation)  
**Performance Goals**: <200ms API operations, 60fps UI rendering, <100MB memory usage  
**Constraints**: Multi-process Electron architecture, TypeScript strict mode, IPC security  
**Scale/Scope**: Single provider integration, affects provider selection UI and model loading

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Code Quality Excellence: TypeScript strict mode, ESLint compliance, clear naming
- [x] Test-First Development: Tests written before implementation, proper coverage
- [x] User Experience Consistency: UI patterns, i18n compliance, accessibility
- [x] Performance Requirements: 60fps UI, <200ms operations, memory efficiency
- [x] Architecture Integrity: Process separation, IPC security, agent patterns

## Project Structure

### Documentation (this feature)
```
specs/[###-feature]/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Web application (Electron multi-process architecture)
src/
├── main/                    # Electron main process (Node.js)
│   ├── models/
│   │   ├── providers/       # Provider implementations
│   │   └── model-manager.ts
│   ├── agent/              # Agent system
│   └── server/             # REST API
├── renderer/               # Electron renderer process (React)
│   ├── src/
│   │   ├── components/
│   │   │   ├── ModelLibrary/
│   │   │   │   └── providers/  # Provider UI components
│   │   │   └── settings/
│   │   └── pages/
│   └── src/i18n/           # Internationalization
├── preload/                # Preload scripts (IPC bridge)
├── common/                 # Shared types and utilities
│   ├── agent.ts            # Provider type definitions
│   └── types.ts
└── mcp-server/             # MCP server component
```

**Structure Decision**: Electron web application with main/renderer process separation, following existing provider pattern in src/main/models/providers/ and UI components in src/renderer/src/components/ModelLibrary/providers/

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:
   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

5. **Update agent file incrementally** (O(1) operation):
   - Run `.specify/scripts/bash/update-agent-context.sh aiderdesk`
     **IMPORTANT**: Execute it exactly as specified above. Do not add or remove any arguments.
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (data model, quickstart)
- Provider type definition task [P]
- Provider implementation task [P]
- UI component creation tasks [P]
- Implementation tasks to make tests pass

**Ordering Strategy**:
- Dependency order: Type definitions → Provider implementation → UI components → Integration
- Mark [P] for parallel execution (independent files)

**Estimated Output**: 15-20 numbered, ordered tasks in tasks.md

**Key Tasks to Generate**:
1. Add 'zai-plan' to LlmProviderName type union
2. Create ZaiPlanProvider interface and type guard
3. Add to AVAILABLE_PROVIDERS array
4. Create provider implementation file
5. Create UI parameter components
6. Create provider icon component
7. Update model manager integration
8. Add to default provider parameters
9. Integration testing
10. End-to-end validation

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |


## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [ ] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented

---
*Based on Constitution v1.0.0 - See `/memory/constitution.md`*

# Tasks: ZAI Coding Plan Provider

**Input**: Design documents from `/specs/001-implement-zai-coding/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → If not found: ERROR "No implementation plan found"
   → Extract: tech stack, libraries, structure
2. Load optional design documents:
   → data-model.md: Extract entities → model tasks
   → contracts/: Each file → contract test task
   → research.md: Extract decisions → setup tasks
3. Generate tasks by category:
   → Setup: project init, dependencies, linting
   → Tests: contract tests, integration tests
   → Core: models, services, CLI commands
   → Integration: DB, middleware, logging
   → Polish: unit tests, performance, docs
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → All contracts have tests?
   → All entities have models?
   → All endpoints implemented?
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Electron web app**: `src/main/`, `src/renderer/`, `src/common/`, `src/preload/`

## Phase 3.1: Setup
- [X] T001 Add 'zai-plan' to LlmProviderName type union in src/common/agent.ts
- [X] T002 [P] Add ZaiPlanProvider interface and type guard in src/common/agent.ts
- [X] T003 [P] Add 'zai-plan' to AVAILABLE_PROVIDERS array in src/common/agent.ts
- [X] T004 [P] Add 'zai-plan' to LlmProvider union in src/common/agent.ts
- [X] T005 [P] Add ZAI provider to getDefaultProviderParams function in src/common/agent.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)
- [X] T010 [P] Create ZAI provider implementation in src/main/models/providers/zai-plan.ts
- [X] T011 [P] Create ZAI provider icon component in src/renderer/src/components/ModelLibrary/providers/ZaiPlanIcon.tsx
- [X] T012 [P] Create ZAI parameters component in src/renderer/src/components/ModelLibrary/providers/ZaiPlanParameters.tsx
- [X] T013 [P] Create ZAI model overrides component in src/renderer/src/components/ModelLibrary/providers/ZaiPlanModelOverrides.tsx
- [X] T014 [P] Create ZAI advanced settings component in src/renderer/src/components/ModelLibrary/providers/ZaiPlanAdvancedSettings.tsx
- [X] T015 Update model manager to support ZAI provider in src/main/models/model-manager.ts
- [X] T016 Add ZAI provider to provider registry in src/main/models/providers/index.ts
- [X] T017 Update provider selection UI to include ZAI in src/renderer/src/components/ModelLibrary/ProviderSelector.tsx

## Parallel Example
```
# Launch T001-T005 together (Setup phase):
Task: "Add 'zai-plan' to LlmProviderName type union in src/common/agent.ts"
Task: "Add ZaiPlanProvider interface and type guard in src/common/agent.ts"
Task: "Add 'zai-plan' to AVAILABLE_PROVIDERS array in src/common/agent.ts"
Task: "Add 'zai-plan' to LlmProvider union in src/common/agent.ts"
Task: "Add ZAI provider to getDefaultProviderParams function in src/common/agent.ts"

# Launch T006-T009 together (Test phase):
Task: "Integration test ZAI provider configuration in tests/integration/test_zai_provider_config.ts"
Task: "Integration test ZAI model loading in tests/integration/test_zai_model_loading.ts"
Task: "Integration test ZAI agent integration in tests/integration/test_zai_agent_integration.ts"
Task: "Integration test ZAI error handling in tests/integration/test_zai_error_handling.ts"

# Launch T010-T017 together (Core implementation - different files):
Task: "Create ZAI provider implementation in src/main/models/providers/zai-plan.ts"
Task: "Create ZAI provider icon component in src/renderer/src/components/ModelLibrary/providers/ZaiPlanIcon.tsx"
Task: "Create ZAI parameters component in src/renderer/src/components/ModelLibrary/providers/ZaiPlanParameters.tsx"
Task: "Create ZAI model overrides component in src/renderer/src/components/ModelLibrary/providers/ZaiPlanModelOverrides.tsx"
Task: "Create ZAI advanced settings component in src/renderer/src/components/ModelLibrary/providers/ZaiPlanAdvancedSettings.tsx"
Task: "Update model manager to support ZAI provider in src/main/models/model-manager.ts"
Task: "Add ZAI provider to provider registry in src/main/models/providers/index.ts"
Task: "Update provider selection UI to include ZAI in src/renderer/src/components/ModelLibrary/ProviderSelector.tsx"
```

## Notes
- [P] tasks = different files, no dependencies
- Verify tests fail before implementing
- Commit after each task
- Avoid: vague tasks, same file conflicts

## Task Generation Rules
*Applied during main() execution*

1. **From Data Model**:
   - ZaiPlanProvider entity → type definition tasks (T001-T005)
   - Provider interface → implementation tasks (T010)
   
2. **From Research**:
   - OpenAI-compatible pattern → provider implementation (T010)
   - UI component pattern → component creation tasks (T011-T014)
   - Model loading strategy → model manager integration (T015)
   
3. **From Quickstart**:
   - Setup scenarios → configuration tests (T006)
   - Model selection → model loading tests (T007)
   - Agent integration → agent integration tests (T008)
   - Error handling → error handling tests (T009)

4. **Ordering**:
   - Setup → Tests → Models → Services → Endpoints → Polish
   - Dependencies block parallel execution

## Validation Checklist
*GATE: Checked by main() before returning*

- [x] All entities have model tasks (ZaiPlanProvider → T001-T005)
- [x] All tests come before implementation (Constitution: Test-First Development)
- [x] Parallel tasks truly independent (different files)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] Performance requirements included (<200ms operations in T025)
- [x] Accessibility and i18n tasks included (T026, T027)
- [x] Code quality tasks included (ESLint, TypeScript in T029)
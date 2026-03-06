# Plannotator Flow Documentation

## Complete Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    PLANNING PHASE                           │
└─────────────────────────────────────────────────────────────┘
                            │
        User switches to plannotator mode (UI or command)
                            │
                            ▼
        ┌──────────────────────────────────────┐
        │  Agent explores codebase             │
        │  - Read files (file_read)            │
        │  - Search code (grep, glob)          │
        │  - Read-only bash commands           │
        │  - Write to PLAN.md only             │
        └──────────────────────────────────────┘
                            │
                            ▼
        ┌──────────────────────────────────────┐
        │  Agent creates plan in PLAN.md       │
        │  - Context section                   │
        │  - Approach section                  │
        │  - Files to modify section           │
        │  - Steps checklist                   │
        │  - Verification section              │
        └──────────────────────────────────────┘
                            │
                            ▼
        ┌──────────────────────────────────────┐
        │  Agent calls exit_plan_mode tool     │
        └──────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                    REVIEW PHASE                             │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌──────────────────────────────────────┐
        │  Extension starts review server      │
        │  - Random port (e.g., 3777)          │
        │  - HTTP server with API endpoints    │
        └──────────────────────────────────────┘
                            │
                            ▼
        ┌──────────────────────────────────────┐
        │  Extension opens browser             │
        │  - URL: http://localhost:3777        │
        │  - Shows plan review UI              │
        └──────────────────────────────────────┘
                            │
                            ▼
        ┌──────────────────────────────────────┐
        │  User reviews plan in browser        │
        │  - Reads plan content                │
        │  - Optionally adds notes             │
        │  - Approves OR requests changes      │
        └──────────────────────────────────────┘
                            │
                    ┌───────┴────────┐
                    │                │
            APPROVED ▼                ▼ REJECTED
                    │                │
┌───────────────────┴─────┐  ┌──────┴────────────────────────┐
│  EXECUTION PHASE        │  │  REVISION LOOP                │
└──────────────────────────┘  └───────────────────────────────┘
            │                              │
    ┌───────┴────────┐                     │
    │ Phase =        │                     ▼
    │ 'executing'    │         ┌──────────────────────────┐
    └───────┬────────┘         │ Agent receives feedback  │
            │                  └──────────────────────────┘
            ▼                              │
    ┌──────────────────────┐               ▼
    │ Full tool access     │   ┌──────────────────────────┐
    │ - Read files         │   │ Agent revises PLAN.md    │
    │ - Edit files         │   │ using file_edit tool     │
    │ - Write files        │   └──────────────────────────┘
    │ - Full bash commands │               │
    └──────────────────────┘               ▼
            │                  ┌──────────────────────────┐
            ▼                  │ Agent calls              │
    ┌──────────────────────┐   │ exit_plan_mode AGAIN     │
    │ Execute plan steps   │   └──────────────────────────┘
    │ with [DONE:n]        │               │
    │ markers              │               └──────┐
    └──────────────────────┘                      │
            │                                     │
            ▼                                     ▼
    ┌──────────────────────┐            (back to review phase)
    │ All steps completed  │
    │ Plan finished!       │
    └──────────────────────┘
```

## exit_plan_mode Tool Flow

### 1. Validation
```
Check: In planning phase?
  NO → Error: "Use /plannotator to enter plannotator mode first"
  YES ↓

Check: PLAN.md exists?
  NO → Error: "Write your plan first"
  YES ↓

Check: PLAN.md not empty?
  NO → Error: "Write your plan first"
  YES ↓
```

### 2. Parse Checklist
```
Parse standard markdown checkboxes:
  - [ ] First step
  - [ ] Second step
  - [x] Completed step
```

### 3. Start Review Server
```
Generate plan slug from heading + date
  ↓
Detect git project name
  ↓
Save plan to version history (~/.plannotator/history/)
  ↓
Start HTTP server (random port)
  - GET  /api/plan           → Return plan + version info
  - GET  /api/plan/version   → Get specific version
  - GET  /api/plan/versions  → List all versions
  - GET  /api/plan/history   → List all project plans
  - POST /api/approve        → User approved
  - POST /api/deny           → User rejected
  - GET  /*                  → Serve review UI
  ↓
Open browser to http://localhost:{port}
  ↓
Log: "Plan review opened in browser: http://localhost:{port}"
```

### 3. Wait for Decision
```
Tool execution BLOCKS waiting for:
  ↓
Browser UI sends decision via API
  ↓
APPROVED or REJECTED with optional feedback
```

### 4. Handle Decision

**If APPROVED:**
```
Set phase = 'executing'
  ↓
Close server
  ↓
Return to agent:
  "Plan approved! You now have full tool access.
   Execute the plan in PLAN.md.
   [If checklist items] After completing each step,
   include [DONE:n] in your response.
   [If feedback] Implementation Notes: {feedback}"
```

**If REJECTED:**
```
Keep phase = 'planning'
  ↓
Close server
  ↓
Return to agent:
  "Plan not approved.
   User feedback: {feedback}

   Revise the plan:
   1. Read PLAN.md to see the current plan.
   2. Use file_edit tool to make targeted changes.
   3. Call exit_plan_mode again when ready."
```

## Review UI

### Browser Interface

```
┌──────────────────────────────────────────────┐
│  📋 Plan Review                              │
│  File: PLAN.md                               │
├──────────────────────────────────────────────┤
│                                              │
│  [Plan content displayed in monospace font]  │
│                                              │
│  # Context                                   │
│  Why this change is being made...            │
│                                              │
│  # Approach                                  │
│  Recommended approach...                     │
│                                              │
│  # Steps                                     │
│  - [ ] 1. First step                         │
│  - [ ] 2. Second step                        │
│                                              │
├──────────────────────────────────────────────┤
│  [✓ Approve Plan]  [✗ Request Changes]       │
├──────────────────────────────────────────────┤
│  Add feedback (optional):                    │
│  [__________________________________]        │
│  [__________________________________]        │
│  [__________________________________]        │
│                                              │
│  [Submit]  [Cancel]                          │
└──────────────────────────────────────────────┘
```

### API Endpoints

#### GET /api/plan
Returns plan data for the UI
```json
{
  "plan": "# Context\n...",
  "planFile": "PLAN.md"
}
```

#### POST /api/approve
User approves the plan
```json
// Request
{
  "feedback": "Optional notes for implementation"
}

// Response
{
  "ok": true
}
```

#### POST /api/deny
User requests changes
```json
// Request
{
  "feedback": "Required: what needs to change"
}

// Response
{
  "ok": true
}
```

## State Transitions

```
Task State:
{
  phase: 'idle' | 'planning' | 'executing',
  planFile: string,
  checklistItems: ChecklistItem[]
}

Transitions:
  idle → planning     : When entering plannotator mode (onAgentStarted)
  planning → executing: When exit_plan_mode approved
  (executing stays)   : Until task closed or mode changed
```

## Key Points

1. **Tool execution blocks**: The `exit_plan_mode` tool doesn't return until the user makes a decision
2. **Browser opens automatically**: User doesn't need to manually navigate
3. **Feedback is preserved**: User notes/feedback are passed to the agent
4. **Revision loop**: If rejected, agent must revise and call exit_plan_mode again
5. **Server cleanup**: HTTP server is stopped after decision is made
6. **Task-scoped**: Each task has independent state and review server
## Key Points

1. **Tool execution blocks**: The `exit_plan_mode` tool doesn't return until the user makes a decision
2. **Browser opens automatically**: User doesn't need to manually navigate
3. **Feedback is preserved**: User notes/feedback are passed to the agent
4. **Revision loop**: If rejected, agent must revise and call exit_plan_mode again
5. **Server cleanup**: HTTP server is stopped after decision is made
6. **Task-scoped**: Each task has independent state and review server
7. **Version history**: Plans are automatically versioned in `~/.plannotator/history/`
8. **Standard markdown**: Uses standard checkbox format compatible with GitHub/GitLab

## Original Implementation

This extension reuses the core implementation from the original [backnotprop/plannotator](https://github.com/backnotprop/plannotator):

### Reused Components

1. **review-server.ts** - Full server implementation with:
   - Plan review server
   - Code review server (for future use)
   - Annotation server (for future use)
   - Version history management
   - Git context detection
   - Browser opening

2. **utils.ts** - Utility functions:
   - Checklist parsing (standard markdown checkboxes)
   - Progress tracking with [DONE:n] markers
   - Step extraction and completion marking

### Checklist Format

**Standard Markdown** (used by this extension):
```markdown
- [ ] First step
- [ ] Second step
- [x] Completed step
```

This is compatible with:
- GitHub markdown rendering
- GitLab markdown rendering
- Most markdown editors and viewers
- The original plannotator implementation

### Version History Structure

```
~/.plannotator/
  └── history/
      └── {project-name}/
          ├── add-user-auth-2024-01-15/
          │   ├── 001.md
          │   ├── 002.md
          │   └── 003.md
          └── fix-login-bug-2024-01-16/
              └── 001.md
```

**Naming**:
- Project name: Detected from git repository
- Plan slug: First heading + date
- Version files: Zero-padded numbers (001.md, 002.md, etc.)

### API Compatibility

The review server provides the same API as the original plannotator:

```
GET  /api/plan           # Get current plan + metadata
GET  /api/plan/version?v=N   # Get specific version
GET  /api/plan/versions  # List all versions
GET  /api/plan/history   # List all project plans
POST /api/approve        # Approve plan
POST /api/deny           # Reject plan
```

This allows future integration with other plannotator-compatible tools and UIs.

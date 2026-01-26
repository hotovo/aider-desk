---
title: "Handoff"
sidebar_label: "Handoff"
---

# `/handoff` Command

The `/handoff` command enables you to extract the relevant context from your current conversation and move it into a new, focused task. Unlike compaction (which summarizes the entire thread and replaces it), handoff lets you specify what you want to focus on next and intelligently extracts only what matters for that goal.

## What It Does

When you run `/handoff`, AiderDesk:

-   **Analyzes your conversation context**: Examines the current thread to understand what's been discussed and accomplished
-   **Extracts relevant information**: Identifies the key decisions, progress, and context that matter for your next task (rather than summarizing everything)
-   **Creates a new task**: Sets up a fresh, focused task with the extracted context
-   **Transfers context files**: Moves all context files from the current task to the new task
-   **Generates a draft prompt**: Creates a concise, actionable prompt based on your focus goal, ready for you to review and edit

## Why It's Better Than Compaction

Unlike `/compact`, which encourages long, meandering threads with stacked summaries, `/handoff` encourages focused threads:

-   **Extraction vs. Summarization**: Instead of summarizing the entire thread, you extract only what matters for your next task
-   **Fresh Context**: Each new task starts with a clean slate focused on a specific goal
-   **Preserved History**: Your original conversation remains intact in the parent task
-   **Better Agent Results**: Focused threads yield better results from AI agents

## When to Use It

Use `/handoff` to:

-   **Continue work with a new focus**: After completing one aspect, shift focus to the next
-   **Execute specific phases**: Break down a plan into phase-specific tasks
-   **Apply patterns elsewhere**: Take a solution and apply it to other parts of the codebase
-   **Shift direction**: Pivot to a different approach or implementation strategy
-   **Add related features**: Extend existing work to cover additional scenarios

## How to Use It

### Basic Usage

Run the command with your focus goal:

```bash
/handoff [your focus here]
```

### With Focus

Provide a focus parameter to guide the context extraction:

```bash
/handoff implement this for teams as well, not just individual users
```

```bash
/handoff execute phase one of the created plan
```

```bash
/handoff check the rest of the codebase and find other places that need this fix
```

```bash
/handoff add error handling for edge cases
```

## Workflow

1.  **Initiate Handoff**: Type `/handoff [focus]` in the prompt field
2.  **Context Analysis**: AiderDesk analyzes your conversation to understand what's been accomplished
3.  **Extraction**: The system extracts the relevant context, decisions, and progress that matter for your focus goal
4.  **Prompt Generation**: A focused prompt is generated based on your focus and the extracted context
    - In **Agent Mode**: Uses a specialized handoff agent profile optimized for this task
    - In **Other Modes** (Ask, Edit): Uses Aider's main model
5.  **Task Creation**: A new task is created and activated
6.  **Context Transfer**: All context files from the current task are transferred
7.  **Review and Edit**: The generated prompt appears as a draft in the new task's input field
    - **You can review and edit it before sending**
    - This ensures the new task starts exactly as you intend, with no unintended loss of context

## Handoff Prompt Template

The handoff feature uses the `handoff.hbs` prompt template to generate focused prompts. You can customize this template by creating your own version in your project or global prompts directory.

### Template Variables

The `handoff.hbs` template has access to the following variables:

| Variable | Type | Description |
|----------|------|-------------|
| `focus` | string \| undefined | The focus parameter provided by the user |
| `contextFiles` | Array\<ContextFile\> | List of context files transferred from the current task |

### Default Template Behavior

The default handoff template:

1.  Analyzes the conversation context and user's focus
2.  Generates a structured prompt with:
    -   Background information from the previous conversation
    -   Relevant files from the context
    -   A clear, actionable task description

### Customizing the Handoff Template

To customize the handoff template:

**Project-specific:**
```bash
mkdir -p .aider-desk/prompts
# Create your custom template at .aider-desk/prompts/handoff.hbs
```

**Global:**
```bash
mkdir -p ~/.aider-desk/prompts
# Create your custom template at ~/.aider-desk/prompts/handoff.hbs
```

See [Custom Prompts](../advanced/custom-prompts.md) for more details on template customization.

## Example Workflow

### Scenario: Building a User Authentication System

**Step 1:** Start working on authentication in the main task

```
User: I need to implement user authentication with email/password login and JWT tokens

[AI works on implementing basic authentication... extensive conversation...]
```

**Step 2:** Hand off to extend functionality

```bash
/handoff implement password reset functionality with email verification
```

AiderDesk creates a new task with a focused prompt that extracts:

```markdown
#### Background Information

We've implemented core authentication features including:
- User registration with email/password validation
- JWT token generation and validation
- Login/logout endpoints with session management
- Basic auth middleware for route protection

Key patterns established:
- Service layer for business logic
- DTOs for request/response validation
- Token-based authentication
- Secure password hashing with bcrypt

#### Relevant files

- src/auth/auth.controller.ts
- src/auth/auth.service.ts
- src/auth/jwt.strategy.ts
- src/auth/dto/login.dto.ts
- src/auth/dto/register.dto.ts

#### Task

Implement password reset functionality:

- Create password reset flow with email verification
- Add secure reset token generation and expiration
- Implement password update mechanism with validation
- Follow existing authentication patterns and security best practices
```

**Step 3:** Review and refine the prompt, then send

```
User: [Review the generated prompt, make any adjustments, then send]
```

### Scenario: Applying Patterns Across Codebase

**Step 1:** Fix an issue in one component

```
User: Fix the memory leak in the user data fetching component

[AI works on fixing the issue with proper cleanup...]
```

**Step 2:** Apply the fix pattern elsewhere

```bash
/handoff check the rest of the codebase and find other places that need this fix
```

AiderDesk extracts the fix pattern and creates a focused task for applying it across the codebase.

**Step 3:** Continue with systematic fixes in the new focused task.

## Best Practices

### When to Use Handoff

-   **Phase-Based Work**: After completing one phase, hand off to execute the next phase of a plan
-   **Pattern Application**: Take a solution and apply it to other parts of the codebase
-   **Feature Expansion**: After implementing core functionality, hand off to add related features or scenarios
-   **Quality Assurance**: Hand off to create focused testing or code review tasks
-   **Documentation**: Hand off completed work to create comprehensive documentation

### Focus Parameter Tips

-   **Be Specific and Goal-Oriented**: Clearly state what you want to accomplish in the next task
-   **Action-Oriented**: Use verbs like "implement", "execute", "check", "add", "fix", "apply"
-   **Context-Aware**: Reference what was just completed and how it relates to your next goal
-   **Manageable Scope**: Keep each focus small enough for a single, focused task

### Examples of Good Focus Parameters

-   "implement this for teams as well, not just individual users"
-   "execute phase one of the created plan"
-   "check the rest of the codebase and find other places that need this fix"
-   "add error handling for edge cases"
-   "apply this validation pattern to all API endpoints"
-   "write unit tests for the payment service"

### Examples of Poor Focus Parameters

-   "continue" (too vague - specify what to continue with)
-   "do the next thing" (not specific enough)
-   "finish the project" (too broad for a single task)
-   "fix everything" (not focused)

## Handoff vs. Compaction

| Aspect | `/handoff` | `/compact` |
|--------|-----------|------------|
| **Purpose** | Extract relevant context for a new, focused task | Summarize the entire current thread |
| **Context Handling** | Extracts only what matters for your next goal | Summarizes everything in the thread |
| **Result** | Creates a new, focused task with extracted context | Replaces current thread with a summary |
| **Thread History** | Preserved in the original task | Replaced with the summary |
| **Encouraged Pattern** | Focused, goal-specific tasks | Long, meandering threads |
| **When to Use** | Starting new work with a specific focus | Running out of context window and need to continue in same thread |

### Which One to Use?

**Use `/handoff` when:**
- You want to start a new, focused task based on previous work
- You want to preserve the original conversation history
- You're moving to a different phase or aspect of the project
- You want to apply patterns from one area to another
- You want clean, focused threads for better agent results

**Use `/compact` when:**
- You want to continue working in the same task but need more context space
- You're fine with the entire conversation being summarized
- You need to reduce token usage in the current thread
- The conversation has become too long but you want to stay in the same task

## Related Features

-   **Tasks**: Handoff creates new tasks with proper context. See [Task Management](./tasks.md)
-   **Subtasks**: For hierarchical task organization. See [Task Management - Subtasks](./tasks.md#subtasks)
-   **Custom Prompts**: Customize the handoff prompt template. See [Custom Prompts](../advanced/custom-prompts.md)
-   **Git Worktrees**: Worktree mode is maintained across handoff. See [Git Worktrees](./git-worktrees.md)
-   **Compact**: Compare handoff with compaction. See [Compact Conversation](./compact.md)

## Troubleshooting

### No Conversation to Handoff

**Error**: "No conversation to handoff. Please send at least one message before using /handoff."

**Solution**: Send at least one message in the current task before using `/handoff`.

### Handoff Failed

If the handoff prompt generation fails:

1.  Check your current mode (Agent vs. other modes)
2.  Ensure your LLM provider and model are properly configured
3.  Review logs for detailed error information
4.  Verify context files are accessible

### Context Files Not Transferred

If context files don't appear in the new task:

1.  Verify files were added to the original task
2.  Check file permissions
3.  Review task logs for any transfer errors

## Advanced Usage

### Chaining Handoffs

You can perform multiple handoffs to break down complex work:

```
Main Task: Build E-commerce Platform
  → /handoff Implement product catalog
    → /handoff Add search functionality
    → /handoff Implement filtering and sorting
  → /handoff Build shopping cart
    → /handoff Add item management
    → /handoff Implement checkout flow
```

### Handoff with Worktrees

If you're using worktree mode, handoff maintains the worktree context:

-   The new task inherits the parent's worktree path
-   All worktree changes are preserved
-   Worktree mode settings carry over to the new task

### Integration with Agent Mode

In Agent Mode, handoff uses a specialized `handoff` agent profile with:

-   Optimized settings for prompt generation
-   Reduced context window for efficiency
-   Focused behavior on creating actionable prompts

For more on agent profiles, see [Agent Profiles](../agent-mode/agent-profiles.md).

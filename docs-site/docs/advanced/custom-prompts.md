---
title: "Custom Prompts"
sidebar_label: "Custom Prompts"
---

# Custom Prompts

AiderDesk uses **prompt templates** to control how the AI agent behaves. These templates are written in [Handlebars](https://handlebarsjs.com/) format and can be customized at multiple levels to suit your specific needs.

## Available Prompt Templates

AiderDesk includes the following built-in prompt templates that you can override. You can view the default implementation of each template on GitHub to use as a starting point for your customizations:

| Template | Purpose | Default |
|----------|---------|---------|
| `system-prompt.hbs` | The main system prompt that defines the agent's personality, objectives, and behavior | [View on GitHub](https://github.com/hotovo/aider-desk/blob/main/resources/prompts/system-prompt.hbs) |
| `init-project.hbs` | Instructions for initializing a new project and creating the `AGENTS.md` file | [View on GitHub](https://github.com/hotovo/aider-desk/blob/main/resources/prompts/init-project.hbs) |
| `workflow.hbs` | Agent workflow guidance for task execution | [View on GitHub](https://github.com/hotovo/aider-desk/blob/main/resources/prompts/workflow.hbs) |
| `compact-conversation.hbs` | Instructions for summarizing conversation history | [View on GitHub](https://github.com/hotovo/aider-desk/blob/main/resources/prompts/compact-conversation.hbs) |
| `commit-message.hbs` | Template for generating Git commit messages | [View on GitHub](https://github.com/hotovo/aider-desk/blob/main/resources/prompts/commit-message.hbs) |
| `task-name.hbs` | Template for generating task names from user prompts | [View on GitHub](https://github.com/hotovo/aider-desk/blob/main/resources/prompts/task-name.hbs) |
| `update-task-state.hbs` | Instructions for determining the appropriate task state based on the agent's last response | [View on GitHub](https://github.com/hotovo/aider-desk/blob/main/resources/prompts/update-task-state.hbs) |
| `conflict-resolution-system.hbs` | System prompt for resolving Git merge conflicts | [View on GitHub](https://github.com/hotovo/aider-desk/blob/main/resources/prompts/conflict-resolution-system.hbs) |
| `conflict-resolution.hbs` | Instructions for handling conflict resolution tasks | [View on GitHub](https://github.com/hotovo/aider-desk/blob/main/resources/prompts/conflict-resolution.hbs) |
| `handoff.hbs` | Template for generating focused prompts when using the `/handoff` command | [View on GitHub](https://github.com/hotovo/aider-desk/blob/main/resources/prompts/handoff.hbs) |

## Template Override System

AiderDesk supports a three-level priority system for prompt customization. When a template is requested, the system searches for it in the following order (from highest to lowest priority):

### 1. Project-Specific Prompts (Highest Priority)

**Location:** `$PROJECT_DIR/.aider-desk/prompts/`

Templates placed in your project's `.aider-desk/prompts/` directory will override all other templates for that specific project only.

```
my-project/
├── .aider-desk/
│   └── prompts/
│       ├── system-prompt.hbs
│       ├── init-project.hbs
│       └── workflow.hbs
└── src/
```

Use this level when you want:
- Project-specific behavior customization
- Team-specific prompts for a codebase
- Different prompts for different projects

### 2. Global Prompts (Medium Priority)

**Location:** `~/.aider-desk/prompts/`

Templates placed in your home directory's `.aider-desk/prompts/` folder apply to all projects unless overridden by project-specific templates.

```
~/.aider-desk/prompts/
├── system-prompt.hbs
├── init-project.hbs
└── commit-message.hbs
```

Use this level when you want:
- Personalized prompt preferences across all projects
- Consistent behavior across your entire development workflow
- Global standards that apply to every project

### 3. Default Prompts (Lowest Priority)

**Location:** Bundled with AiderDesk

These are the built-in templates that ship with AiderDesk. They are used when no custom template is found in either the project-specific or global locations. You cannot modify these directly, but you can override them by creating templates at the project or global level.

## Creating Custom Prompts

### Step 1: Choose Your Override Level

Decide whether you want your custom prompts to apply to:
- **One project only** → Use `.aider-desk/prompts/` in your project
- **All projects** → Use `~/.aider-desk/prompts/`

### Step 2: Create the Prompts Directory

```bash
# For project-specific prompts
mkdir -p .aider-desk/prompts

# For global prompts
mkdir -p ~/.aider-desk/prompts
```

### Step 3: Copy and Modify a Template

You can start from the default templates and customize them. Create a file with the same name as the template you want to override.

**Tip:** Browse the default templates on [GitHub](https://github.com/hotovo/aider-desk/tree/main/resources/prompts) to see how they're structured and use them as a reference for your customizations.

Example: Customizing the system prompt for a specific project

```bash
# Copy the default template as a starting point (optional)
# You can also create a new file from scratch

# Create your custom system prompt
cat > .aider-desk/prompts/system-prompt.hbs << 'EOF'
# Custom System Prompt

You are a specialized coding assistant for the {{projectName}} project.

## Project Context
- Language: TypeScript
- Framework: React with Next.js
- Style: Functional components, no classes

## Your Role
Focus on creating maintainable, type-safe code. Always prefer composition over inheritance.

## Guidelines
- Use TypeScript strict mode
- Write tests for all new features
- Follow the existing code patterns
- Keep components under 200 lines

EOF
```

### Step 4: Verify the Template

When you create or modify a template file, AiderDesk will automatically:
1. Detect the change (via file watching)
2. Recompile the template
3. Apply it to new agent sessions

You can verify your changes by starting a new agent task and observing the behavior.

## Available Handlebars Helpers

AiderDesk provides several Handlebars helpers that you can use in your custom templates:

### Conditional Helpers

| Helper | Description |
|--------|-------------|
| `{{equals value1 value2}}` | Check if two values are equal |
| `{{not value}}` | Logical NOT operator |
| `{{assign varName value}}` | Assign a value to a variable in the template scope |
| `{{increment varName}}` | Increment a numeric variable |

### Formatting Helpers

| Helper | Description |
|--------|-------------|
| `{{indent text spaces}}` | Indent each line of text with specified number of spaces |
| `{{cdata text}}` | Wrap text in CDATA sections (for XML-style prompts) |

Example usage in a template:

```handlebars
{{#if toolPermissions.aiderTools}}
You have access to Aider tools.
{{/if}}

{{#if (equals toolPermissions.powerTools.anyEnabled true)}}
Power tools are enabled.
{{/if}}

{{cdata customInstructions}}
```

## Template Variables

Each prompt template has access to different variables depending on its purpose. Here are the key variables available to most templates:

### Common Variables

| Variable | Type | Description |
|----------|------|-------------|
| `projectDir` | string | Absolute path to the project directory |
| `taskDir` | string | Absolute path to the current task directory |
| `osName` | string | Operating system name |
| `currentDate` | string | Current date as a string |
| `customInstructions` | string | Custom instructions from agent profile or additional instructions |
| `rulesFiles` | string | Concatenated content of rule files |
| `toolPermissions` | object | Permissions configuration for various tools |

### System Prompt Variables

The `system-prompt.hbs` template has access to:

```typescript
{
  projectDir: string;
  taskDir: string;
  additionalInstructions?: string;
  osName: string;
  currentDate: string;
  rulesFiles: string;
  customInstructions: string;
  toolPermissions: {
    aiderTools: boolean;
    powerTools: { /* ... */ };
    todoTools: boolean;
    subagents: boolean;
    memory: { /* ... */ };
    skills: { /* ... */ };
    autoApprove: boolean;
  };
  workflow: string;  // Rendered workflow template
  toolConstants: { /* All tool constants */ };
}
```

### Init Project Variables

The `init-project.hbs` template has minimal variables as it's typically static:

```typescript
{
  // Additional context can be added in the future
}
```

### Conflict Resolution Variables

The `conflict-resolution.hbs` template receives:

```typescript
{
  filePath: string;
  basePath?: string;
  oursPath?: string;
  theirsPath?: string;
}
```

### Handoff Variables

The `handoff.hbs` template receives:

```typescript
{
  focus?: string;
  contextFiles?: ContextFile[];
}
```

- `focus`: Optional focus parameter provided by the user when running `/handoff`
- `contextFiles`: List of context files that will be transferred to the new task

## Live Reloading

AiderDesk automatically watches for changes to custom prompt templates:

- **File watching**: Any changes to `.hbs` files in the prompt directories are detected
- **Debounced compilation**: Changes are compiled after a 1-second delay to avoid issues with rapid edits
- **Automatic application**: Recompiled templates are used immediately for new agent sessions
- **Error handling**: Invalid templates are logged but won't crash the application

### Monitoring Logs

To monitor template loading and compilation:

```bash
# View logs for template-related events
tail -f ~/.aider-desk/logs/aider-desk.log | grep -i prompt
```

## Example: Custom System Prompt

Here's a complete example of creating a custom system prompt for a TypeScript project:

```bash
# Create the prompts directory
mkdir -p .aider-desk/prompts

# Create a custom system prompt
cat > .aider-desk/prompts/system-prompt.hbs << 'EOF'
# TypeScript Expert Assistant

You are an expert TypeScript developer working on the {{projectDir}} project.

## Your Personality
- Meticulous and detail-oriented
- Type-safety focused
- Performance conscious
- Test-driven development advocate

## Code Style Guidelines

### TypeScript Rules
- Always use `interface` for object shapes, `type` for unions
- Avoid `any` at all costs - use `unknown` when type is truly unknown
- Use `enum` for sets of related constants
- Enable `strict` mode in tsconfig

### React Rules (if applicable)
- Use functional components with hooks
- Define Props as: `type Props = { /* ... */ }`
- Extract event handlers to separate functions
- Import React types directly: `import { MouseEvent } from 'react';`

### General Best Practices
{{#if toolPermissions.memory.enabled}}
- Use memory tools to remember user preferences and patterns
{{/if}}
- Write tests for all new functionality
- Keep functions small and focused
- Add comments only when necessary (complex logic, edge cases)

## Project Context
{{#if rulesFiles}}
The following project rules are defined:

{{rulesFiles}}
{{/if}}

{{#if customInstructions}}
## Additional Instructions
{{customInstructions}}
{{/if}}
EOF
```

## Best Practices

### DO:
- Start by copying the default template as a reference
- Test your custom prompts on a sample task before committing to a project
- Use version control to track prompt changes
- Document any non-obvious template customizations in a README
- Keep templates focused on behavior, not specific implementation details
- Use Handlebars helpers for dynamic content to avoid repetition

### DON'T:
- Create overly complex templates that are hard to maintain
- Include sensitive information in templates (they may be in version control)
- Modify default bundled templates directly (always override)
- Mix concerns - keep system-prompt focused on agent behavior
- Hardcode project-specific values - use template variables when available

## Troubleshooting

### Template Not Being Applied

**Problem:** Your custom template isn't being used.

**Solutions:**
1. Check the file name matches exactly (e.g., `system-prompt.hbs`, not `systemPrompt.hbs`)
2. Verify the file is in the correct directory (`.aider-desk/prompts/` or `~/.aider-desk/prompts/`)
3. Check file permissions - templates must be readable
4. Review logs for compilation errors

### Template Compilation Errors

**Problem:** Template fails to compile.

**Solutions:**
1. Validate Handlebars syntax (balanced braces, proper closing tags)
2. Check helper usage - ensure helper names are correct
3. Verify template variables exist for that template type
4. Test templates with a simple example before complex customization

### Changes Not Taking Effect

**Problem:** Modified template isn't applied to current session.

**Solutions:**
1. Template changes only affect new agent sessions
2. Restart the current task to see changes
3. Verify file watcher is working (check logs)

## Related Features

- **Handoff**: Customize the handoff prompt template to control how conversation context is transferred to new tasks. See [Handoff](../features/handoff.md)
- **Project Rules**: Combine custom prompts with rule files for complete behavior control. See [Project-Specific Rules](../configuration/project-specific-rules.md)
- **Agent Profiles**: Create different agent profiles with different prompts. See [Agent Profiles](../agent-mode/agent-profiles.md)
- **Memory System**: Use memory to store and retrieve user preferences that can inform prompts. See [Memory](../features/memory.md)

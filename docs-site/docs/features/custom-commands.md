---
title: "Custom Commands"
sidebar_label: "Custom Commands"
---

# Custom Commands

AiderDesk allows you to define and use custom commands to automate repetitive tasks or extend AiderDesk's functionality. These commands are defined in Markdown files with YAML front matter and can be executed directly from the prompt field.

## Where to Create Custom Commands

Custom command files are Markdown files (`.md`) that AiderDesk monitors for changes. You can create them in two locations:

1.  **Global Commands:**
    *   Location: `~/.aider-desk/commands/` (your user home directory)
    *   Commands placed here are available across all your projects.

2.  **Project-Specific Commands:**
    *   Location: `.aider-desk/commands/` (within your current project's root directory)
    *   Commands placed here are only available for that specific project.
    *   **Note:** If a command with the same name exists in both global and project-specific directories, the project-specific command will take precedence.

If the `commands` directory does not exist in either location, AiderDesk will create it automatically when it starts up or when you first try to use custom commands.

## Custom Command File Format

Each custom command is a Markdown file with a YAML front matter block at the top. The front matter defines the command's metadata, and the content below it serves as the command's template.

Here's the structure:

```markdown
---
description: A brief description of what the command does.
arguments:
  - description: Description for the first argument.
    required: true # or false, defaults to true if omitted
  - description: Description for the second argument.
    required: false
---
This is the template for the command.
You can use `{{1}}`, `{{2}}`, etc., to refer to the arguments passed to the command.
You can also use `{{ARGUMENTS}}` to refer to all arguments joined by spaces.
For example, `!git diff {{1}}` will execute `git diff` with the first argument.
For example, `!echo {{ARGUMENTS}}` will echo all arguments.
Any line starting with `!` will be treated as a shell command.
```

### Front Matter Fields:

*   `description` (string, **required**): A short, clear description of the command's purpose. This description will appear in the autocompletion suggestions.
*   `arguments` (array of objects, optional): An array defining the expected arguments for the command. Each argument object can have:
    *   `description` (string, **required**): A description of what the argument represents.
    *   `required` (boolean, optional): Set to `true` if the argument is mandatory, `false` otherwise. Defaults to `true`.
*   `includeContext` (boolean, optional): Determines whether the current conversation context (chat history and context files) should be included when the command is run. Defaults to `true`. If set to `false`, the agent will receive an empty list of messages. This is useful for commands that should operate independently of the current task.
*   `skills` (string, optional): A comma-separated list of skill names to activate before the command prompt is executed. Skills are only activated in non-Aider modes (e.g., agent mode). For example: `skills: writing-tests, code-review`.

### Command Template:

The content of the Markdown file below the YAML front matter is the command's template. This template will be sent to the AiderDesk agent as a prompt.

*   **Argument Substitution:** 
    *   Use `{{1}}`, `{{2}}`, `{{3}}`, and so on, to insert the values of the arguments passed to the command. `{{1}}` corresponds to the first argument, `{{2}}` to the second, and so forth.
    *   Use `{{ARGUMENTS}}` to substitute all arguments joined by spaces. This is useful when you want to pass all arguments as a single string to a command.
*   **Shell Commands:** Any line in the template that starts with an exclamation mark (`!`) will be interpreted as a shell command. These commands are executed *before* the final prompt is sent to the LLM, and their `stdout` replaces the command line in the assembled prompt. For example, `!git diff` or `!ls -la {{1}}`.

## How to Use Custom Commands

Custom commands can be executed directly from the prompt field in AiderDesk.

2.  **Typing the Command:** Start typing `/` followed by the command's name (e.g., `/mycommand`).
3.  **Autocompletion:** As you type, AiderDesk's prompt field will provide autocompletion suggestions for your custom commands, along with their descriptions.
4.  **Passing Arguments:** If your command expects arguments, provide them after the command name, separated by spaces. For example:
    ```
    /mycommand arg1 "argument with spaces" arg3
    ```
    **Note:** Currently, arguments with spaces must be enclosed in double quotes.
5.  **Execution:** Press Enter to execute the command. AiderDesk will substitute the arguments into your command's template, execute any embedded shell commands, and then send the fully assembled prompt to the appropriate handler (Aider or Agent) based on the active mode.
    *   **Note on Mode Selection:** The effectiveness of a custom command depends on the active mode.
        *   Use **Code** mode for commands intended to modify files within the current context.
        *   Use **Ask** mode for general queries or information retrieval that do not involve file modifications.
        *   For commands designed to leverage advanced reasoning and tool use, ensure you are in **Agent** mode.
        *   Other modes like **Architect** or **Context** should be chosen based on their specific functionalities and the command's purpose.

## Examples

### Example 1: Generate a Commit Message

This command runs a `git diff` and asks the LLM to generate a conventional commit message. It uses `includeContext: false` so the command operates independently of the current conversation.

Create a file named `.aider-desk/commands/commit-message.md`:

```markdown
---
description: Generate a conventional commit message based on the result of git diff.
includeContext: false
---
Please generate a conventional commit message based on result of git diff. The commit message should adhere to the Conventional Commits specification.

The message should be a single line, starting with a type (e.g., `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`), followed by an optional scope, a colon and a space, and then a short, imperative description of the change.

!git diff HEAD

Provide the commit message in the following format:

`<type>: <description>`

Only answer with the commit message, nothing else.
```

To use it, type `/commit-message` in the prompt field and press Enter.

### Example 2: Squash Unpushed Commits

This command squashes all unpushed commits into a single one with an auto-generated conventional commit message. It uses `includeContext: false` to avoid polluting the prompt with conversation history, and `autoApprove: true` so the agent can execute git commands without asking for confirmation.

Create a file named `.aider-desk/commands/squash.md`:

```markdown
---
description: Squash all unpushed commits into a single commit with a generated conventional commit message.
includeContext: false
autoApprove: true
---
Please squash all unpushed commits into a single commit.

Assuming the remote is 'origin', the upstream is origin/{current branch}.

Get the diff of the unpushed commits:

`git diff origin/$(git rev-parse --abbrev-ref HEAD)..HEAD`

Based on this diff, generate a conventional commit message following the Conventional Commits specification (e.g., `type: description`).

Then, execute the following commands to perform the squash:

`git reset --soft origin/$(git rev-parse --abbrev-ref HEAD)`

`git commit -m "<generated commit message>"`
```

To use it, type `/squash` in the prompt field and press Enter.

### Example 3: Review Uncommitted Changes

This command reviews the current git diff for code quality issues, bugs, and improvement suggestions. It demonstrates using a subfolder (`review/`) to organize related commands.

Create a file named `.aider-desk/commands/review/uncommitted.md`:

```markdown
---
description: Review and summarize the output of a git diff for code quality, bugs, and improvements.
includeContext: false
---
Please review the following git diff and provide a summary of the changes, potential bugs, code quality issues, and suggestions for improvement. Focus on correctness, maintainability, and best practices.

!git diff HEAD

After reviewing, list any:
- Potential bugs or risky changes
- Code style or quality issues
- Suggestions for improvement
- Notable refactorings or design changes

If the diff is large, summarize the most important changes and issues. Do not use subagents for this task.
```

To use it, type `/review/uncommitted` in the prompt field and press Enter.

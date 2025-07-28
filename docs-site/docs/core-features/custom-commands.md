---
sidebar_position: 6
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
For example, `!git diff {{1}}` will execute `git diff` with the first argument.
Any line starting with `!` will be treated as a shell command.
```

### Front Matter Fields:

*   `description` (string, **required**): A short, clear description of the command's purpose. This description will appear in the autocompletion suggestions.
*   `arguments` (array of objects, optional): An array defining the expected arguments for the command. Each argument object can have:
    *   `description` (string, **required**): A description of what the argument represents.
    *   `required` (boolean, optional): Set to `true` if the argument is mandatory, `false` otherwise. Defaults to `true`.
*   `includeContext` (boolean, optional): Determines whether the current conversation context (chat history and context files) should be included when the command is run. Defaults to `true`. If set to `false`, the agent will receive an empty list of messages. This is useful for commands that should operate independently of the current chat session.

### Command Template:

The content of the Markdown file below the YAML front matter is the command's template. This template will be sent to the AiderDesk agent as a prompt.

*   **Argument Substitution:** Use `{{1}}`, `{{2}}`, `{{3}}`, and so on, to insert the values of the arguments passed to the command. `{{1}}` corresponds to the first argument, `{{2}}` to the second, and so forth.
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

### Example 1: Simple Git Status Command

Create a file named `~/.aider-desk/commands/git-status.md` (or `.aider-desk/commands/git-status.md`):

```markdown
---
description: Shows the current git status of the repository.
---
!git status
```

To use it, type `/git-status` in the prompt field and press Enter.

### Example 2: Generate a Commit Message

This command is similar to the built-in `commit-message` but demonstrates argument usage.

Create a file named `~/.aider-desk/commands/generate-commit.md`:

```markdown
---
description: Generates a conventional commit message for the given git diff.
arguments:
  - description: The git diff arguments (e.g., HEAD~1, a file path, or a commit range).
    required: false
---
Please generate a conventional commit message based on the following git diff. The commit message should adhere to the Conventional Commits specification.

The message should be a single line, starting with a type (e.g., `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`), followed by an optional scope, a colon and a space, and then a short, imperative description of the change.

!git diff {{1}}

Provide the commit message in the following format:

```
<type></type>[optional scope]: <description></description>
```

Only answer with the commit message, nothing else.
```

To use it, you could type:
*   `/generate-commit` (for the entire staged diff)
*   `/generate-commit HEAD~1` (for the diff from the previous commit)
*   `/generate-commit src/main/project.ts` (for changes in a specific file)

### Example 3: Command without Context

This command will list files in the root of the project, without including the current chat history or context files.

Create a file named `~/.aider-desk/commands/list-root.md`:

```markdown
---
description: Lists files in the project root directory, ignoring current context.
includeContext: false
---
!ls -la ./
```

To use it, type `/list-root` in the prompt field and press Enter. The agent will only receive the `!ls -la ./` instruction and no prior conversation.
---
sidebar_position: 3
title: "Custom Commands"
sidebar_label: "Custom Commands"
slug: "/core-features/custom-commands"
---

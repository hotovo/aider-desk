## Product Requirements Document (PRD): Custom Command Templates

### 1. Introduction

This document outlines the product requirements for the "Custom Command Templates" feature within AiderDesk. This feature will empower users to create reusable, multi-step instruction templates for the AI agent, streamlining complex or repetitive tasks. By defining custom commands in simple text files, users can create powerful, context-aware workflows that leverage AiderDesk's existing agent and tool-use capabilities.

### 2. Goals

*   **Enhance User Control:** Provide users with a robust mechanism to define and reuse complex instruction sequences for the AI agent, tailored to their specific projects and workflows.
*   **Improve Efficiency:** Enable users to create powerful shortcuts for frequently performed tasks (e.g., generating tests, refactoring components, running analysis), reducing repetitive manual prompting.
*   **Increase Flexibility:** Support dynamic arguments within command templates, allowing for highly adaptable and context-aware agent interactions.
*   **Seamless Integration:** Ensure custom commands integrate naturally with the existing agent architecture, including its tool-use capabilities and approval flows, rather than introducing a separate execution model.

### 3. Key Features

#### 3.1. Command Template Files

Users will define custom commands by creating markdown files within a dedicated project directory: `.aider-desk/commands/`.

*   Each file represents a single custom command template.
*   The filename (without extension) will serve as the command name (e.g., `gen-tests.md` defines the `/gen-tests` command).
*   The system will automatically discover and load these command files on project startup and watch the directory for any changes.

#### 3.2. YAML Frontmatter for Metadata

Each command file must begin with a YAML frontmatter block to define command metadata, which will be used for autocompletion and user guidance.

*   **`description`**: A concise, one-line description of the command's purpose.
*   **`arguments`** (optional): A simple list of strings, where each string is a description for a positional argument. This makes commands self-documenting.

```yaml
---
description: Generates unit tests for a given function in a file.
arguments:
  - Path to the source file.
  - Name of the function to test.
---
```

#### 3.3. Command Body and Execution Logic

The body of the file will contain a single, comprehensive prompt template that instructs the AI agent.

*   **Single Prompt Template**: The entire file body (after the frontmatter) is treated as a single prompt template for the agent.
*   **System-Level Instruction for Shell Commands**: The agent's system prompt will be augmented with a special instruction: "When you encounter a line in the user's prompt that begins with an exclamation mark (`!`), you must treat it as a shell command and execute it using the `power---bash` tool." This offloads the execution logic to the agent's existing tool-use capabilities and approval flow.

#### 3.4. Argument Handling

Command templates will support dynamic, 1-indexed positional arguments passed by the user.

*   **Variable Placeholders**: Placeholders `{{1}}`, `{{2}}`, etc., will be used in the prompt template. `{{1}}` corresponds to the first argument, `{{2}}` to the second, and so on.
*   **Substitution**: Before the prompt is sent to the agent, the system will replace these placeholders with the user-provided arguments.

#### 3.5. File Referencing

Users can reference project files within their command templates.

*   **Project-Relative File Reference (`@`)**: The `@` prefix can be used to denote files relative to the project root (e.g., `@src/main.py`). The prompt template should instruct the agent on how to handle these files (e.g., "Read the contents of the file `@{{1}}` before proceeding.").

### 4. User Stories

*   **As a Developer, I want to create a command to generate unit tests for a specified function, so I can speed up my TDD workflow.**
    *   *Command File (`.aider-desk/commands/gen-tests.md`):*
        ```yaml
        ---
        description: Generates unit tests for a given function in a file.
        arguments:
          - Path to the source file.
          - Name of the function to test.
        ---
        Please generate comprehensive unit tests for the `{{2}}` function located in the file `@{{1}}`. Ensure all edge cases are covered. Place the new tests in an appropriate test file, creating one if it doesn't exist.
        ```
    *   *User Invocation*: `/gen-tests src/utils.py calculate_sum`

*   **As a DevOps Engineer, I want a command to safely preview and apply a Kubernetes deployment.**
    *   *Command File (`.aider-desk/commands/deploy.md`):*
        ```yaml
        ---
        description: Previews and applies a Kubernetes deployment for a service.
        arguments:
          - Name of the service to deploy (e.g., user-auth).
        ---
        First, show me a preview of the deployment.
        !kubectl apply -f /etc/k8s/deployments/{{1}}.yaml --dry-run=client -o yaml

        After I approve the preview, apply the deployment for real.
        !kubectl apply -f /etc/k8s/deployments/{{1}}.yaml

        Finally, confirm the deployment status.
        !kubectl rollout status deployment/{{1}}
        ```
    *   *User Invocation*: `/deploy user-auth`

### 5. Technical Implementation Details

#### 5.1. Command Discovery and Management

*   **New Class: `CustomCommandManager`**
    *   **File:** `src/main/custom-command-manager.ts`
    *   **Responsibility:** This class will be responsible for discovering, parsing, storing, and watching custom command files.
    *   **Initialization:** It will be instantiated within the `Project` class. On construction, it will perform an initial scan of the `.aider-desk/commands/` directory.
    *   **File Watching:** It will use a file watcher (e.g., `chokidar`) to monitor the commands directory for additions, removals, and modifications, updating its internal state in real-time.
    *   **Data Structure:** It will maintain an in-memory `Map<string, CustomCommand>` where the key is the command name (e.g., "gen-tests") and the value is the parsed command object.

*   **Integration with `Project` Class**
    *   **File:** `src/main/project.ts`
    *   The `Project` class constructor will create an instance of `CustomCommandManager`.
    *   The `Project` class will expose a method like `getCustomCommands()` to make the loaded commands available to other parts of the system (like the IPC handler for autocompletion).

#### 5.2. Command Parsing

*   **Library:** The `yaml-front-matter` library will be used for parsing.
*   **Logic:**
    1.  Inside `CustomCommandManager`, a method like `parseCommandFile(filePath)` will read the file content.
    2.  It will use `loadFront(content)` from the library to extract the YAML frontmatter and the `__content` (the prompt body).
    3.  The parsed data will be stored in a structured object:
        ```typescript
        interface CustomCommand {
          name: string;
          description: string;
          arguments: string[];
          template: string;
        }
        ```

#### 5.3. Command Invocation and Execution

*   **UI Layer (`PromptField.tsx`)**
    *   **File:** `src/renderer/src/components/PromptField.tsx`
    *   The `handleSubmit` or a related function will detect if the input text is a custom command by checking against the list of loaded commands.
    *   If a custom command is detected, it will call a new IPC handler, e.g., `run-custom-command`.

*   **IPC Layer (`ipc-handlers.ts`)**
    *   **File:** `src/main/ipc-handlers.ts`
    *   A new handler `ipcMain.handle('run-custom-command', ...)` will be created.
    *   It will retrieve the corresponding `Project` instance and call `project.runCustomCommand(commandName, args)`.

*   **Core Logic (`Project.ts`)**
    *   **File:** `src/main/project.ts`
    *   A new public method `runCustomCommand(commandName: string, args: string[])` will be implemented.
    *   **Steps:**
        1.  Retrieve the `CustomCommand` object from its `CustomCommandManager` instance.
        2.  If the command doesn't exist, log an error to the user.
        3.  Validate the number of provided `args` against the `command.arguments.length`. If not enough arguments are provided, log an error.
        4.  Perform placeholder substitution on `command.template`. A simple loop replacing `{{i+1}}` with `args[i]` will suffice.
        5.  Call `this.runAgent(activeProfile, substitutedPrompt)`. The custom command's execution is thereby delegated entirely to the agent.

*   **System Prompt Modification**
    *   **File:** `src/main/agent/prompts.ts`
    *   The `getSystemPrompt` function will be modified to accept an optional flag or context indicating that a custom command is being run.
    *   When this flag is present, it will append the following instruction to the system prompt:
        > `You MUST treat any line in this prompt that begins with an exclamation mark (!) as a shell command to be executed using the 'power---bash' tool.`

### 6. UI/UX Considerations

*   **Autocompletion:**
    *   The list of available custom commands needs to be passed from the `main` process to the `renderer` process.
    *   In `src/renderer/src/components/PromptField.tsx`, the `completionSource` function will be updated to include custom commands when the user types `/`.
    *   The `description` from the frontmatter will be displayed as the detail label for the autocompletion item.
*   **Argument Hints:**
    *   As a user types a custom command, the UI should display hints for the required arguments based on the `arguments` list from the frontmatter (e.g., `/gen-tests <Path to source file> <Name of function>`).

### 7. Security and Error Handling

*   **Security:** By delegating `!` command execution to the `power---bash` tool, we leverage the existing `ApprovalManager` flow. This is a critical security feature, as it ensures no shell command can be executed without explicit user confirmation (unless auto-approve is enabled).
*   **Error Handling:**
    *   **Malformed Files:** The `CustomCommandManager` should gracefully handle files with invalid YAML frontmatter and log an error to the AiderDesk log file and optionally to the user's chat window.
    *   **Command Not Found:** If a user tries to run a non-existent command, `PromptField.tsx` should display an "Invalid command" error.
    *   **Argument Mismatch:** The `project.runCustomCommand` method will validate the argument count and report an error to the user in the chat if it's incorrect.

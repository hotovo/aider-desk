---
title: "Hooks"
sidebar_label: "Hooks"
---

# Hooks

Hooks allow you to extend AiderDesk's behavior by executing custom JavaScript code in response to various system events. You can use hooks to automate workflows, enforce rules, integrate with external tools, or modify the behavior of tasks and prompts.

## Where to Create Hooks

Hook files are JavaScript files (`.js`) that AiderDesk loads and executes. You can create them in two locations:

1.  **Global Hooks:**
    *   Location: `~/.aider-desk/hooks/` (your user home directory)
    *   Hooks placed here are active across all your projects.

2.  **Project-Specific Hooks:**
    *   Location: `.aider-desk/hooks/` (within your current project's root directory)
    *   Hooks placed here are only active for that specific project.

AiderDesk monitors these directories and reloads hooks automatically when files are added, modified, or removed.

## Hook File Format

A hook file should export an object where keys are event names and values are functions that handle those events.

```javascript
module.exports = {
  onTaskCreated: async (event, context) => {
    context.addInfoMessage(`Task "${event.task.name}" was created!`);
  },

  onPromptStarted: async (event, context) => {
    if (event.prompt.includes('secret')) {
      context.addWarningMessage('Prompt contains sensitive keywords.');
      // Returning false blocks the action (where applicable)
      return false;
    }
  }
};
```

### The `context` Object

Every hook function receives a `context` object as its second argument, providing access to AiderDesk utilities and state:

*   `context.addInfoMessage(message)`: Displays an info message in the task log.
*   `context.addWarningMessage(message)`: Displays a warning message.
*   `context.addErrorMessage(message)`: Displays an error message.
*   `context.addLoadingMessage(message, finished?)`: Displays a loading/status message. Set `finished` to `true` to mark it as complete.
*   `context.setTaskName(name)`: Updates the current task's name.
*   `context.addContextMessage(role, content)`: Adds a message ('user' or 'assistant') to the chat history.
*   `context.projectDir`: The absolute path to the current project.
*   `context.taskData`: The current task's metadata.
*   `context.task`: The current Task instance (advanced). Provides methods like `runPrompt(prompt, mode, includeInContext)` to programmatically trigger prompts.

## Hook Events Reference

Below is a list of available events you can listen to. Events marked with **(M)** allow you to modify the event data by returning an object with the updated properties.

| Event Name | Description | Event Data |
| :--- | :--- | :--- |
| `onTaskCreated` **(M)** | Triggered when a new task is created. | `{ task: TaskData }` |
| `onTaskInitialized` **(M)** | Triggered after a task is fully initialized. | `{ task: TaskData }` |
| `onTaskClosed` **(M)** | Triggered when a task is closed. | `{ task: TaskData }` |
| `onPromptSubmitted` **(M)** | Triggered when a prompt is submitted by the user. | `{ prompt: string, mode: Mode }` |
| `onPromptStarted` **(M)** | Triggered just before a prompt is processed. Return `false` to block. | `{ prompt: string, mode: Mode }` |
| `onPromptFinished` **(M)** | Triggered after a prompt has been fully processed. | `{ responses: ResponseCompletedData[] }` |
| `onAgentStarted` **(M)** | Triggered when the Agent starts processing a prompt. | `{ prompt: string, contextMessages: ContextMessage[], contextFiles: ContextFile[] }` |
| `onAgentFinished` **(M)** | Triggered when the Agent finishes its work. | `{ contextMessages: ContextMessage[], resultMessages: ContextMessage[], aborted: boolean }` |
| `onAgentStepFinished` **(M)** | Triggered after each individual step of an Agent. | `{ stepResult: unknown, finishReason: FinishReason, responseMessages: ContextMessage[] }` |
| `onToolCalled` **(M)** | Triggered when a tool (e.g., `read_file`) is called. | `{ toolName: string, args: object }` |
| `onToolFinished` **(M)** | Triggered after a tool execution completes. | `{ toolName: string, args: object, result: unknown }` |
| `onFileAdded` **(M)** | Triggered when a file is added to the chat context. | `{ file: ContextFile }` |
| `onFileDropped` **(M)** | Triggered when a file is removed from the chat context. | `{ filePath: string }` |
| `onCommandExecuted` **(M)** | Triggered when a slash command (e.g., `/help`) is executed. | `{ command: string }` |
| `onAiderPromptStarted` **(M)** | Triggered before sending a prompt to Aider. | `{ prompt: string, mode: Mode }` |
| `onAiderPromptFinished` **(M)** | Triggered after Aider finishes processing. | `{ responses: ResponseCompletedData[] }` |
| `onQuestionAsked` | Triggered when Aider/Agent asks a question. Return a string to auto-answer. | `{ question: QuestionData }` |
| `onQuestionAnswered` **(M)** | Triggered after a question is answered. | `{ question: QuestionData, answer: string }` |
| `onHandleApproval` | Triggered for actions requiring approval. Return `true` to auto-approve, `false` to deny. | `{ key: string, text: string, subject?: string }` |
| `onSubagentStarted` **(M)** | Triggered when a subagent is launched. | `{ subagentId: string, prompt: string }` |
| `onSubagentFinished` **(M)** | Triggered when a subagent completes. | `{ subagentId: string, resultMessages: ContextMessage[] }` |
| `onResponseMessageProcessed` | Triggered after a message is processed. Return modified message to transform it. | `{ message: ResponseMessage }` |

## Advanced Usage

### Modifying Event Data
For events marked with **(M)**, you can return an object to merge it into the event data. This updated data will be passed to subsequent hooks and used by the system.

```javascript
onPromptSubmitted: (event) => {
  // Automatically append a suffix to every prompt
  return { prompt: event.prompt + " --always-respond-in-markdown" };
}
```

### Blocking Actions
For events like `onPromptStarted` or `onHandleApproval`, returning `false` will cancel the action.


### Auto-answering Questions
You can use `onQuestionAsked` to automate responses to common questions:
```javascript
onQuestionAsked: (event) => {
  if (event.question.text.includes("Proceed with changes?")) {
    return "yes";
  }
}
```

### Modifying Tool Results
For `onToolFinished`, you can return a string directly to replace the tool's result. This is useful for post-processing or validation:

```javascript
onToolFinished: (event) => {
  if (event.toolName === 'power---file_edit' && event.result.startsWith('Successfully')) {
    // Return a modified result string
    return `${event.result}\n\nNote: File was automatically formatted.`;
  }
}
```

## Example Hooks

Here are some practical hook examples you can use as starting points:

### Lint Check on Tool Finished

Runs eslint --fix on files that were modified by file_edit or file_write tools. If linting fails after a successful file operation, the result is updated with the error.

<details>
<summary>lint-check-on-tool-finished.js</summary>

```javascript
const { spawn } = require('child_process');
const path = require('path');

/**
 * Lint Checker Hook for AiderDesk
 *
 * This hook runs eslint --fix on files that were modified by file_edit or file_write tools.
 * If linting fails after a successful file operation, the result is updated with the error.
 *
 * Usage: Copy this file to your project's `.aider-desk/hooks/` directory or to `~/.aider-desk/hooks/` for global use.
 */

const CHECKED_TOOL_NAMES = ['power---file_edit', 'power---file_write'];

/**
 * Runs eslint --fix on a specific file and returns the result
 */
const runEslint = (projectDir, filePath) => {
    return new Promise((resolve) => {
        let stdout = '';
        let stderr = '';

        const proc = spawn('npx', ['eslint', '--fix', filePath], {
            cwd: projectDir,
            shell: true,
            timeout: 60000 // 1 minute timeout
        });

        proc.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        proc.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        proc.on('close', (code) => {
            resolve({
                success: code === 0,
                output: stdout + stderr
            });
        });

        proc.on('error', (error) => {
            resolve({
                success: false,
                output: `Failed to run eslint: ${error.message}`
            });
        });
    });
};

/**
 * Checks if the result indicates a successful file operation
 */
const isSuccessfulResult = (result) => {
    if (typeof result !== 'string') {
        return false;
    }
    return result.startsWith('Successfully');
};

/**
 * Checks if the file should be linted (TypeScript or JavaScript files only)
 */
const shouldLintFile = (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx' || ext === '.mjs' || ext === '.cjs';
};

module.exports = {
    onToolFinished: async (event, context) => {
        const { toolName, args, result } = event;

        if (!CHECKED_TOOL_NAMES.includes(toolName)) {
            return;
        }

        if (!isSuccessfulResult(result)) {
            return;
        }

        const filePath = args?.filePath;
        if (!filePath || !shouldLintFile(filePath)) {
            return;
        }

        context.addLoadingMessage('Running eslint...');
        const eslintResult = await runEslint(context.projectDir, filePath);
        context.addLoadingMessage('Running eslint...', true);

        if (!eslintResult.success) {
            // Return a string to modify the tool's result
            return `Error: file has been updated but linting failed:

\`\`\`${eslintResult.output}\`\`\``;
        }
    }
};
```

</details>

### Lint Check on Agent Finished

Runs project-wide linting after the agent finishes and can automatically prompt the agent to fix any linting issues found.

<details>
<summary>lint-check-on-agent-finished.js</summary>

```javascript
const { spawn } = require('child_process');

/**
 * Lint Checker Hook for AiderDesk
 *
 * This hook runs linting after an agent finishes and can automatically
 * prompt the agent to fix any linting issues found.
 *
 * Usage: Copy this file to your project's `.aider-desk/hooks/` directory or to `~/.aider-desk/hooks/` for global use.
 */

/**
 * Runs npm lint command and returns the result
 */
const runLint = (projectDir) => {
    return new Promise((resolve) => {
        let stdout = '';
        let stderr = '';

        const proc = spawn('npm', ['run', 'lint'], {
            cwd: projectDir,
            shell: true,
            timeout: 120000 // 2 minutes timeout
        });

        proc.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        proc.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        proc.on('close', (code) => {
            resolve({
                success: code === 0,
                output: stdout + stderr
            });
        });

        proc.on('error', (error) => {
            resolve({
                success: false,
                output: `Failed to run lint: ${error.message}`
            });
        });
    });
};

module.exports = {
    onAgentFinished: async (event, context) => {
        // Skip if the agent was aborted
        if (event.aborted) {
            return;
        }

        context.addLoadingMessage('Running linting...');
        const result = await runLint(context.projectDir);
        context.addLoadingMessage('Running linting...', true);

        if (!result.success) {
            context.addWarningMessage(`Linting issues found`);

            // Automatically prompt the agent to fix the issues
            await context.task.runPrompt(`Fix the linting issues:

\`\`\`${result.output}\`\`\``, 'agent', false);
        }
    }
};
```

</details>

To use these examples, copy the code to a `.js` file in your project's `.aider-desk/hooks/` directory or to `~/.aider-desk/hooks/` for global use.

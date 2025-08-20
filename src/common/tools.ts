export const TOOL_GROUP_NAME_SEPARATOR = '---';

export const AIDER_TOOL_GROUP_NAME = 'aider';
export const AIDER_TOOL_GET_CONTEXT_FILES = 'get_context_files';
export const AIDER_TOOL_ADD_CONTEXT_FILES = 'add_context_files';
export const AIDER_TOOL_DROP_CONTEXT_FILES = 'drop_context_files';
export const AIDER_TOOL_RUN_PROMPT = 'run_prompt';

export const HELPERS_TOOL_GROUP_NAME = 'helpers';
export const HELPERS_TOOL_NO_SUCH_TOOL = 'no_such_tool';
export const HELPERS_TOOL_INVALID_TOOL_ARGUMENTS = 'invalid_tool_arguments';

export const POWER_TOOL_GROUP_NAME = 'power';
export const POWER_TOOL_FILE_EDIT = 'file_edit';
export const POWER_TOOL_FILE_READ = 'file_read';
export const POWER_TOOL_FILE_WRITE = 'file_write';
export const POWER_TOOL_GLOB = 'glob';
export const POWER_TOOL_GREP = 'grep';
export const POWER_TOOL_SEMANTIC_SEARCH = 'semantic_search';
export const POWER_TOOL_BASH = 'bash';

export const SUBAGENTS_TOOL_GROUP_NAME = 'subagents';
export const SUBAGENTS_TOOL_RUN_TASK = 'run_task';

export const AIDER_TOOL_DESCRIPTIONS = {
  [AIDER_TOOL_GET_CONTEXT_FILES]: 'Get all files currently in the context for Aider to read or edit',
  [AIDER_TOOL_ADD_CONTEXT_FILES]: `Adds file(s) to the Aider context for reading or editing.
Prerequisite: Before using, check the current context with 'get_context_files'. Do NOT add files already present in the context.
Use relative file path(s) for files intended for editing within the project. Use absolute file path(s) for read-only files (e.g., outside the project).`,
  [AIDER_TOOL_DROP_CONTEXT_FILES]: `Removes file(s) from the Aider context.
Note: Unless explicitly requested by the user to remove specific file(s), this tool should primarily be used to remove files that were previously added using 'add_context_files' (e.g., after a related 'run_prompt' task is completed).`,
  [AIDER_TOOL_RUN_PROMPT]: `Delegates a natural language coding task to the Aider assistant for execution within the current project context.
Use this tool for:
- Writing new code.
- Modifying or refactoring existing code.
- Explaining code segments.
- Debugging code.
- Implementing new features.
- This tools must be preferred (if not specified by user otherwise) over other tools creating or modifying files, as it is more efficient and effective.

Prerequisites
- All relevant existing project files for the task MUST be added to the Aider context using 'add_context_files' BEFORE calling this tool.

Input:
- A clear, complete, and standalone natural language prompt describing the coding task.

Restrictions:
- Prompts MUST be language-agnostic. Do NOT mention specific programming languages (e.g., Python, JavaScript), libraries, or syntax elements.
- Treat Aider as a capable programmer; provide sufficient detail but avoid excessive handholding.
`,
} as const;

export const POWER_TOOL_DESCRIPTIONS = {
  [POWER_TOOL_FILE_EDIT]: `Atomically finds and replaces a specific string or pattern within a specified file. This tool is useful for making targeted changes to file content. Before editing, make sure you read the file and you know the actual content. When editing multiple lines, include the entire line in the search term, not just the part you want to change. <example>
searchTerm: "
const myFunction = () => {
  let value = 10;
",
replaceText: "
const myFunction = () => {
  let newValue = 5;
  let value = 10;
"</example>`,
  [POWER_TOOL_FILE_READ]:
    "Reads and returns the content of a specified non-binary file. Useful for inspecting file contents when analyzing user's request or before modifying it.",
  [POWER_TOOL_FILE_WRITE]: 'Writes content to a specified file. Can create a new file, overwrite an existing file, or append to an existing file.',
  [POWER_TOOL_GLOB]: 'Finds files and directories matching a specified glob pattern within the project. Useful for discovering files based on patterns.',
  [POWER_TOOL_GREP]:
    'Searches for content matching a regular expression pattern within files specified by a glob pattern. Returns matching lines and their context.',
  [POWER_TOOL_SEMANTIC_SEARCH]:
    'Search code in the repository using Elasticsearch-like query syntax. Use this tool first for any code-related questions to find out relationships between files and what files need to be changed.',
  [POWER_TOOL_BASH]: 'Executes a shell command. For safety, commands may be sandboxed or require user approval (approval handled by Agent).',
  [SUBAGENTS_TOOL_RUN_TASK]: 'Description is generated dynamically based on enabled agent profiles with subagent functionality.',
} as const;

export const TODO_TOOL_GROUP_NAME = 'todo';
export const TODO_TOOL_SET_ITEMS = 'set_items';
export const TODO_TOOL_GET_ITEMS = 'get_items';
export const TODO_TOOL_UPDATE_ITEM_COMPLETION = 'update_item_completion';
export const TODO_TOOL_CLEAR_ITEMS = 'clear_items';

export const TODO_TOOL_DESCRIPTIONS = {
  [TODO_TOOL_SET_ITEMS]:
    'Initializes or overwrites the current list of todo items. This tool accepts an array of todo items, each with a name (string) and completed (boolean) property. It also accepts the initialUserPrompt as an argument, allowing the agent to store the original request context for future reference.',
  [TODO_TOOL_GET_ITEMS]: 'Retrieves the current list of todo items, including their names and completion statuses.',
  [TODO_TOOL_UPDATE_ITEM_COMPLETION]: 'Updates the completed status of a specific todo item by its name.',
  [TODO_TOOL_CLEAR_ITEMS]: 'Removes all existing todo items from the list.',
} as const;

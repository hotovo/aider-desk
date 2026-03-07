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
export const POWER_TOOL_FETCH = 'fetch';

export const SUBAGENTS_TOOL_GROUP_NAME = 'subagents';
export const SUBAGENTS_TOOL_RUN_TASK = 'run_task';

export const SKILLS_TOOL_GROUP_NAME = 'skills';
export const SKILLS_TOOL_ACTIVATE_SKILL = 'activate_skill';

export const EXTENSION_TOOL_GROUP_NAME = 'extensions';

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

export const MEMORY_TOOL_GROUP_NAME = 'memory';
export const MEMORY_TOOL_STORE = 'store_memory';
export const MEMORY_TOOL_RETRIEVE = 'retrieve_memory';
export const MEMORY_TOOL_DELETE = 'delete_memory';
export const MEMORY_TOOL_LIST = 'list_memories';
export const MEMORY_TOOL_UPDATE = 'update_memory';

export const MEMORY_TOOL_DESCRIPTIONS = {
  [MEMORY_TOOL_STORE]: 'Stores important information, patterns, or preferences into memory for future tasks',
  [MEMORY_TOOL_RETRIEVE]: `Searches and retrieves relevant memories using semantic vector search.

RETRIEVAL STRATEGY:
1. Identify what type of information you need (user preferences, code patterns, architectural decisions, or stable project reference)
2. Formulate a query with 3-7 descriptive words that includes key concepts and context
3. Use natural language - describe what you're looking for as if explaining to another developer

EFFECTIVE QUERY EXAMPLES:
- "LLM provider integration patterns"
- "Voice control implementation details"
- "Testing framework configuration"
- "Project architecture and component structure"
- "User interface theming system"

AVOID: Single words, generic terms, or overly brief queries that lack context`,
  [MEMORY_TOOL_DELETE]: 'Deletes a specific memory',
  [MEMORY_TOOL_LIST]: 'Lists all stored memories with optional filtering',
  [MEMORY_TOOL_UPDATE]: 'Updates an existing memory with new content',
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
    "Reads and returns the content of a specified non-binary file. Useful for inspecting file contents when analyzing user's request or before modifying it. Can return content as raw text or with line numbers in format 'lineNumber|content'. Supports line offset and limit for reading specific portions of files.",
  [POWER_TOOL_FILE_WRITE]: 'Writes content to a specified file. Can create a new file, overwrite an existing file, or append to an existing file.',
  [POWER_TOOL_GLOB]: 'Finds files and directories matching a specified glob pattern within the project. Useful for discovering files based on patterns.',
  [POWER_TOOL_GREP]:
    'Searches for content matching a regular expression pattern within files specified by a glob pattern. Returns matching lines and their context.',
  [POWER_TOOL_SEMANTIC_SEARCH]:
    'Search code in repository using semantic search. Use natural language queries with 2-5 descriptive words including key concepts and context. Can filter results with hints like ext:ts, dir:src, or lang:typescript. Use this tool first for any code-related questions to find relationships between files and identify files to change.',
  [POWER_TOOL_BASH]: 'Executes a shell command. For safety, commands may be sandboxed or require user approval (approval handled by Agent).',
  [POWER_TOOL_FETCH]:
    'Fetches and returns the content of a web page from a specified URL. Useful for retrieving web content, documentation, or external resources. Supports three formats: "markdown" (default, converts HTML to markdown), "html" (returns raw HTML), "raw" (fetches raw content via HTTP, ideal for API responses or raw files like GitHub raw files).',
  [SUBAGENTS_TOOL_RUN_TASK]: 'Description is generated dynamically based on enabled agent profiles with subagent functionality.',
} as const;

export const SKILLS_TOOL_DESCRIPTIONS = {
  [SKILLS_TOOL_ACTIVATE_SKILL]: 'Description is generated dynamically based on discovered skills.',
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

export const TASKS_TOOL_GROUP_NAME = 'tasks';
export const TASKS_TOOL_LIST_TASKS = 'list_tasks';
export const TASKS_TOOL_GET_TASK = 'get_task';
export const TASKS_TOOL_GET_TASK_MESSAGE = 'get_task_message';
export const TASKS_TOOL_CREATE_TASK = 'create_task';
export const TASKS_TOOL_DELETE_TASK = 'delete_task';
export const TASKS_TOOL_SEARCH_TASK = 'search_task';
export const TASKS_TOOL_SEARCH_PARENT_TASK = 'search_parent_task';

export const TASKS_TOOL_DESCRIPTIONS = {
  [TASKS_TOOL_LIST_TASKS]:
    'List all tasks in the current project. Returns basic information for each task including id, name, and creation/update timestamps. Use this to get an overview of all available tasks before performing specific task operations.',
  [TASKS_TOOL_GET_TASK]:
    "Get comprehensive details about a specific task by its ID. Returns task metadata, current state, list of context files with their read-only status, and the total count of context messages. Use this to understand a task's configuration and context before working with it or its messages.",
  [TASKS_TOOL_GET_TASK_MESSAGE]:
    "Retrieve a specific message from a task's conversation history by message index and task ID. The first message (index 0) is always the user's initial prompt, and subsequent messages alternate between user and assistant. Use this to examine the conversation flow, understand previous interactions, or extract specific information from the task history.",
  [TASKS_TOOL_CREATE_TASK]:
    'Create a new task in the current project with an initial prompt. Optionally specify an agent profile ID to use different capabilities, a model ID to override the default model, or a parentTaskId to create a subtask of another task. The parentTaskId parameter is only available for top-level tasks; if the current task is itself a subtask, you cannot create subtasks from it. The new task will start with the provided prompt as its first user message. Use this to begin new work streams, separate different aspects of a project, or break down complex tasks into manageable subtasks.',
  [TASKS_TOOL_DELETE_TASK]:
    'Permanently delete a task and all its associated data including messages, context files, and metadata. This action cannot be undone. Note that you cannot delete the currently active task. Use this to clean up completed or abandoned tasks, but be cautious as this removes all task history permanently.',
  [TASKS_TOOL_SEARCH_TASK]:
    'Search content within a specific task using semantic search. Use natural language queries with 2-5 descriptive words including key concepts and context. Searches through task conversation history and context files. Use this to find relevant information, discussions, or code snippets within a task.',
  [TASKS_TOOL_SEARCH_PARENT_TASK]:
    'Search content within parent task using semantic search. Use natural language queries with 2-5 descriptive words including key concepts and context. Automatically searches parent task conversation history and context files.',
} as const;

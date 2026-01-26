---
title: "Task Tools"
sidebar_label: "Task Tools"
---

# Task Tools

Task tools are a set of powerful tools that enable AI agents to interact with the AiderDesk task management system. These tools allow agents to create, read, search, and manage tasks programmatically, enabling sophisticated workflows like breaking down complex projects into subtasks, tracking progress across multiple tasks, and searching for information within task histories.

## What Are Task Tools For?

Task tools enable agents to:

- **Organize complex work**: Break down large projects into smaller, manageable tasks and subtasks
- **Track progress**: Monitor task states, completion status, and update tasks as work progresses
- **Context switching**: Switch between related tasks to understand different aspects of a project
- **Search task history**: Find relevant information, decisions, or code from previous work
- **Automate workflows**: Create task hierarchies that mirror project structure or feature organization

## Enabling Task Tools

Task tools are part of the agent's toolset. To use them:

1. Open AiderDesk Settings
2. Navigate to the **Agent** section
3. Ensure **"Use Task Tools"** is enabled in your agent profile
4. Configure individual tool approval settings as needed

Task tools are available to all agent profiles by default when enabled.

## Available Task Tools

### `tasks---list_tasks`

Lists all tasks in the current project, providing an overview of available work.

**Parameters:**
- `offset` (optional, number): Number of tasks to skip (for pagination)
- `limit` (optional, number): Maximum number of tasks to return
- `state` (optional, string): Filter tasks by state (e.g., TODO, IN_PROGRESS, DONE)

**Returns:** Array of task objects with id, name, creation/update timestamps, state, and subtaskIds (if applicable)

**Use Cases:**
- Getting an overview of all available tasks before working
- Finding tasks in a specific state (e.g., all TODO tasks)
- Checking for existing related work before starting new tasks
- Implementing task dashboard or summary features

**Example:**
> "List all tasks that are in TODO state so I can prioritize my work"

---

### `tasks---get_task`

Retrieves comprehensive details about a specific task by its ID.

**Parameters:**
- `taskId` (string, required): The ID of the task to get information for

**Returns:** Complete task object including:
- id, parentId, name
- Creation/update timestamps
- Current state and archived status
- Context files with read-only status
- Total count of context messages
- Agent profile, provider, model, and mode information
- SubtaskIds (if the task has subtasks)

**Use Cases:**
- Understanding a task's configuration and context before working with it
- Checking what files are currently in the task's context
- Examining task metadata to determine next steps
- Preparing to work with or modify a task

**Example:**
> "Get detailed information about task abc-123 to understand what it's about and what context it has"

---

### `tasks---get_task_message`

Retrieves a specific message from a task's conversation history.

**Parameters:**
- `taskId` (string, required): The ID of the task
- `messageIndex` (number, required): Index of the message to retrieve (0-based)

**Returns:** The message object with role (user/assistant) and content

**Important Notes:**
- Message 0 is always the user's initial prompt
- Messages alternate between user and assistant
- Use negative numbers to count from the end: -1 for last message, -2 for second to last

**Use Cases:**
- Examining the conversation flow to understand previous interactions
- Extracting specific information or decisions from task history
- Reviewing the original user prompt or recent responses
- Understanding context before performing operations

**Example:**
> "Get the last message (index -1) from task abc-123 to see the agent's final response"

---

### `tasks---create_task`

Creates a new task in the current project with an initial prompt.

**Parameters:**
- `prompt` (string, required): Initial prompt for the new task
- `name` (string, optional): Optional name for the task (auto-generated if not provided)
- `agentProfileId` (string, optional): Agent profile ID to use for the task
- `modelId` (string, optional): Override the default model
- `execute` (boolean, optional): Execute the task immediately after creation (default: false)
- `executeInBackground` (boolean, optional): Run task in background if execute is true
- `parentTaskId` (string, optional): Create as a subtask of the specified parent task

**Returns:** Task object with id, name, and result message

**Important Notes:**
- If the current task is itself a subtask, you cannot create further subtasks from it
- If parentTaskId is null or not provided, creates a top-level task
- When creating a subtask, the new task inherits the parent's worktreePath

**Use Cases:**
- Breaking down complex work into smaller, manageable subtasks
- Creating separate tasks for different aspects or features
- Starting new independent work streams
- Organizing related tasks hierarchically

**Example:**
> "Create a subtask of the current task to implement the user authentication feature with this prompt..."

---

### `tasks---delete_task`

Permanently deletes a task and all its associated data.

**Parameters:**
- `taskId` (string, required): The ID of the task to delete

**Returns:** Confirmation message

**Important Notes:**
- This action cannot be undone
- You cannot delete the currently active task
- Deleting a parent task will also delete all its subtasks
- Use with caution as this removes all task history permanently

**Use Cases:**
- Cleaning up completed or abandoned tasks
- Removing incorrect or duplicate tasks
- Archiving work that is no longer needed

**Example:**
> "Delete task abc-123 as it's no longer needed"

---

### `tasks---search_task`

Searches within a specific task using semantic search to find relevant information.

**Parameters:**
- `taskId` (string, required): The ID of the task to search within
- `query` (string, required): Search query using Elasticsearch syntax with 2-5 descriptive words
- `maxTokens` (number, optional): Maximum tokens to return (default: 10000)

**Returns:** Relevant search results from the task's conversation history and context files

**Search Strategy:**
- Use natural language queries describing what you're looking for
- Include key concepts and context in your query
- Use + for important terms to boost their relevance

**Effective Query Examples:**
- "LLM provider integration patterns"
- "authentication implementation details"
- "error handling in API calls"
- "user interface component structure"

**Use Cases:**
- Finding relevant information, discussions, or code snippets within a task
- Understanding previous decisions or implementation approaches
- Locating specific features or explanations from task history
- Gathering context from related work

**Example:**
> "Search within task abc-123 for information about database connection handling"

---

### `tasks---search_parent_task`

Searches within the parent task's content (available only for subtasks).

**Parameters:**
- `query` (string, required): Search query using Elasticsearch syntax
- `maxTokens` (number, optional): Maximum tokens to return (default: 10000)

**Returns:** Relevant search results from the parent task's conversation history and context files

**Important Notes:**
- This tool is only available for subtasks
- Automatically uses the current task's parentTaskId
- Enables subtasks to reference parent task context

**Use Cases:**
- Subtasks searching for information or decisions made in parent task
- Understanding the broader context or requirements from parent
- Finding implementation guidance from parent task
- Accessing architectural decisions made at higher level

**Example:**
> "Search in the parent task for database schema decisions that affect this subtask"

---

## Task Tool Workflows

### Creating Task Hierarchies

Agents can use task tools to create organized task structures:

1. **Use `list_tasks`** to understand current project state
2. **Use `create_task`** with `parentTaskId` to create subtasks
3. **Use `get_task`** to verify task structure and context
4. **Use `search_task`** to find relevant information in related tasks

**Example Workflow:**
> "Create a main task for implementing user authentication, then create subtasks for login, registration, and password reset"

### Context Switching and Information Retrieval

Agents can gather information across multiple tasks:

1. **Use `list_tasks`** to find relevant tasks
2. **Use `get_task`** to examine task context and metadata
3. **Use `search_task`** to find specific information within tasks
4. **Use `get_task_message`** to retrieve specific conversation details

**Example Workflow:**
> "Search for how authentication was implemented in other tasks to maintain consistency"

### Progressive Task Management

Agents can track and update work across multiple tasks:

1. **Use `list_tasks` with state filter** to find tasks needing attention
2. **Use `get_task`** to understand current task status
3. **Create new subtasks** for follow-up work
4. **Use `search_parent_task`** to maintain context with parent

**Example Workflow:**
> "List all TODO tasks, then create subtasks for breaking down complex ones"

## Best Practices

### Task Organization

**Use meaningful task names:**
- When creating tasks, provide clear, descriptive names
- Use the auto-generated name feature for consistency
- Include context about the task's purpose

**Create logical hierarchies:**
- Group related subtasks under a meaningful parent
- Keep hierarchies shallow (2-3 levels max) for maintainability
- Use subtasks to break down complex features, not unrelated work

### Effective Search Strategies

**Craft good search queries:**
- Use 3-5 descriptive words that capture key concepts
- Include domain-specific terminology
- Use + to emphasize important terms
- Be specific about what you're looking for

**Search at appropriate levels:**
- Search within tasks for specific implementations
- Search parent tasks for architectural decisions
- Use list_tasks to find broader context before diving deep

### Task Lifecycle Management

**Create tasks intentionally:**
- Start with a clear purpose for each task
- Use parentTaskId to establish relationships early
- Consider the task scope before creation

**Delete with caution:**
- Always verify you're not deleting active work
- Remember that deleting a parent removes all subtasks
- Consider archiving instead of deleting for historical context

### Tool Approval Configuration

**Configure based on your workflow:**
- Set `list_tasks` and `get_task` to "Always" for efficiency
- Keep `create_task` and `delete_task` on "Ask" for control
- Set search tools based on your trust level and need for oversight
- Use "Always for This Run" for batch operations

## Integration with Other Features

### Agent Profiles
Task tools work seamlessly with agent profiles:
- Different profiles can use different models or capabilities for tasks
- Task creation can specify agentProfileId for consistent behavior
- Tool approval settings are profile-specific

### Subtasks
Task tools enable sophisticated subtask workflows:
- Subtasks inherit worktree configuration from parent
- Parent task context can be searched via `search_parent_task`
- Hierarchical task structures mirror project organization

### Task State Management
Agents can track and update task states:
- Use `list_tasks` with state filter to find tasks in specific states
- Create tasks with appropriate initial states
- Monitor progress across multiple tasks

### Todo Management
Task tools complement the todo system:
- Use tasks to break down major work items
- Use todos for fine-grained tracking within a task
- Create subtasks for independent work streams

## Troubleshooting

### Common Issues

**Task tools not available:**
- Check that "Use Task Tools" is enabled in agent profile settings
- Verify your agent profile has task tools configured
- Restart AiderDesk if settings don't take effect

**Cannot create subtask:**
- Ensure the current task is not itself a subtask
- Verify parentTaskId is valid and exists
- Check that parent task is not archived

**Search returning no results:**
- Use broader or different search terms
- Check that the task has relevant content
- Try searching in parent task for higher-level context

**Task operations failing:**
- Verify task IDs are correct
- Check that you have permission to modify the task
- Ensure task is not currently locked or in use

### Performance Considerations

**Large task lists:**
- Use `offset` and `limit` for pagination
- Filter by state to reduce results
- Cache task lists when appropriate

**Search performance:**
- Set appropriate `maxTokens` to limit response size
- Use specific queries to reduce processing time
- Search parent task for context only when needed

## Advanced Usage

### Conditional Task Creation

Agents can create tasks based on conditions:

```javascript
// List all TODO tasks
const todoTasks = await list_tasks({ state: 'TODO' });

// For complex tasks, create subtasks
for (const task of todoTasks) {
  if (task.name.includes('complex')) {
    await create_task({
      prompt: 'Break this down further',
      parentTaskId: task.id
    });
  }
}
```

### Cross-Task Learning

Agents can search across related tasks:

```javascript
// Find similar implementations
const results = await search_task({
  taskId: currentTaskId,
  query: 'authentication implementation pattern'
});

// Apply learnings to current work
```

### Hierarchical Task Management

Create and manage complex task structures:

```javascript
// Create main feature task
const mainTask = await create_task({
  name: 'User Authentication',
  prompt: 'Implement user authentication system'
});

// Create subtasks for components
await create_task({
  parentTaskId: mainTask.id,
  name: 'Login Component',
  prompt: 'Implement login form'
});

await create_task({
  parentTaskId: mainTask.id,
  name: 'Registration Component',
  prompt: 'Implement registration form'
});
```

Task tools provide agents with powerful capabilities to organize, search, and manage work across the entire task system, enabling sophisticated workflows that mirror real-world project organization and development practices.

---
title: "Task Management"
sidebar_label: "Tasks"
---

# Task Management

AiderDesk's task management system provides a comprehensive way to organize, track, and manage your AI-assisted development work. Tasks serve as the foundation for structuring complex projects, enabling you to break down work into manageable units, maintain context across sessions, and track progress from initial ideas through to completion.

## What Are Tasks For?

Tasks are designed to help you manage the entire lifecycle of your AI-assisted development work. Think of tasks as containers for all the context, conversations, and decisions related to a specific piece of work.

### A Typical Task Workflow

Here's how you might use tasks in your daily development:

**1. Start a New Task**
You have a feature to implement or a bug to fix. You click "New Task" and describe what you need:
> "Add user authentication with login and registration pages"

**2. AI Breaks Down the Work**
The agent analyzes your request and uses its internal todo system to create a plan:
- Design authentication schema
- Implement login form
- Implement registration form
- Add API endpoints
- Add error handling

**3. Work Through the Task**
As you and the AI work through the task:
- All conversations are saved
- Files added to context are tracked
- Costs for both Aider and Agent usage are monitored
- Progress is tracked through task states

**4. Review and Iterate**
When the agent completes work:
- Review the generated code and implementations
- Make adjustments by continuing the conversation
- Mark the task as done or create follow-up tasks

**5. Reference Later**
Months later, you can:
- Search within the task to find how authentication was implemented
- Duplicate the task as a template for similar features
- Export the conversation as documentation

### Why Tasks Matter

Without tasks, each AI conversation is an isolated interaction. With tasks, you get:

**Persistent Context**: Your conversation history, file context, and decisions are preserved across sessions. You can close AiderDesk, come back tomorrow, and pick up exactly where you left off.

**Organized Work**: Multiple projects, features, and experiments can coexist without confusion. Each task has its own context and state.

**Cost Awareness**: Track exactly how much you're spending on different types of work. See which features were expensive and which were efficient.

**Progress Tracking**: Know at a glance what's done, what's in progress, and what needs attention. Use task states to manage your workflow.

**Searchable Knowledge**: All your past work is searchable. Find that authentication implementation from three months ago in seconds.

**Collaboration Ready**: Tasks can be exported, shared, and used as templates. Duplicate successful work patterns and share context with team members.

## Task Organization

Tasks are organized per project in the `.aider-desk/tasks/` directory. Each task has its own folder with:

```
.aider-desk/tasks/{taskId}/
├── settings.json    # Task metadata and configuration
├── context.json     # Messages and files context
└── todos.json       # Todo items for the task
```

### Task Sidebar

The **Task Sidebar** on the left side of the project view provides easy access to all your tasks:

- **Task List**: All tasks sorted by last update time
- **Status Indicators**: Shows processing state with spinners and question marks
- **Quick Actions**: Create, rename, delete, duplicate, and archive tasks
- **Collapsible Interface**: Can be collapsed to save screen space
- **Task States**: Visual indicators showing task progress
- **Task Search**: Filter tasks by name or state
- **Multiselect**: Perform bulk operations on multiple tasks

## Working Modes

Tasks support two working modes:

### Local Mode
Work directly in your main project directory. This is the default mode and is suitable for most development work.

### Worktree Mode
Create an isolated Git worktree for safe experimentation:

- **Complete Isolation**: Work doesn't affect your main branch
- **Safe Experimentation**: Try out ideas without risk
- **Easy Integration**: Merge changes back when ready
- **Revert Support**: Built-in revert functionality

## Subtasks

Subtasks enable you to break down complex work into a hierarchical structure, making large projects manageable and organized.

### How Subtasks Work

Subtasks are tasks that are linked to a parent task, forming a tree-like structure:

```
User Authentication (Parent Task)
├── Login Form (Subtask)
├── Registration Form (Subtask)
└── Password Reset (Subtask)
```

Each subtask can have its own:
- Conversation history
- Context files
- Todo items
- Cost tracking
- Working mode (local or worktree)

### Key Features

**Automatic Worktree Inheritance**: When a subtask is created, it automatically inherits the parent task's worktree path if the parent is using worktree mode. This ensures all related work happens in the same isolated environment.

**Hierarchical Organization**: Subtasks can be nested under parent tasks, creating a clear structure that mirrors your project or feature organization.

**Visual Indicators**: In the task sidebar:
- Subtasks are indented with 20px of spacing
- Vertical connector lines show parent-child relationships
- Chevron icons allow expanding/collapsing task trees
- Task state chips show each subtask's status

**Safety Protections**: When you try to delete a parent task that has subtasks, AiderDesk shows a confirmation dialog: "This task has X subtask(s). Delete anyway?" This prevents accidental deletion of related work.

**Independent Work**: Each subtask operates independently with its own context, messages, and state. However, subtasks can search the parent task's content to understand broader context.

### Creating Subtasks

You can create subtasks in two ways:

**1. Via the Task Sidebar:**
- Hover over a parent task
- Click the "Create subtask" button that appears
- The new subtask will be created under that parent

**2. Via Agent Mode:**
The AI agent can create subtasks automatically when working with [Task Tools](../agent-mode/task-tools.md). The agent can break down complex work and organize it into a task hierarchy.

### Use Cases for Subtasks

**Feature Breakdown**: Break a large feature into smaller, manageable pieces
```
E-commerce Platform
├── Product Catalog
├── Shopping Cart
├── Checkout Process
└── Order Management
```

**Multi-Aspect Work**: Separate different aspects of a complex task
```
API Performance Optimization
├── Database Query Optimization
├── Caching Layer Implementation
├── API Response Compression
└── Load Balancing Configuration
```

**Independent Components**: Organize by component or module
```
User Dashboard
├── Profile Management
├── Notification Settings
├── Privacy Controls
└── Account Deletion
```

### Best Practices

**Keep Hierarchies Shallow**: Aim for 2-3 levels of depth maximum. Deeper hierarchies can become difficult to navigate.

**Use Descriptive Names**: Ensure both parent and subtask names clearly describe their scope.

**Consider Task Scope**: Before creating a subtask, ask if the work is truly independent or if it's part of the same cohesive piece of work.

**Use Todo Items for Small Steps**: For very fine-grained steps, use the built-in todo system within a task rather than creating subtasks.

## Smart Task States

Task states provide visibility into the status of your work and help guide your workflow. When enabled, AiderDesk intelligently analyzes the agent's responses to automatically categorize tasks into meaningful states.

### Task State Types

**TODO**: The task hasn't been started yet. This is the default state for newly created tasks.

**IN PROGRESS**: The task is currently being worked on. This state is set automatically when you run a prompt.

**INTERRUPTED**: The task was stopped before completion, either by you or due to an error.

**MORE INFO NEEDED**: The agent needs clarification or additional information to proceed. This state is determined by the smart task state analysis.

**READY FOR IMPLEMENTATION**: The agent has a clear plan and is ready to begin coding or making changes. This indicates the agent understands what needs to be done.

**READY FOR REVIEW**: The agent has completed the work and it's ready for human review. This is the typical state when the agent finishes implementing a feature or fixing a bug.

**DONE**: The task has been marked as completed by you. This indicates you've reviewed the work and are satisfied with the result.

### Smart Task State Analysis

When "Smart Task State" is enabled in task settings, AiderDesk uses AI to analyze the agent's responses and automatically determine the appropriate state:

1. After each prompt completes, the system examines the agent's final response
2. It considers the content, reasoning, and tone of the response
3. It categorizes the task based on what the agent communicated
4. The task state is updated automatically

This saves you time and provides clear, actionable feedback about the task's status.

### Configuring Smart Task States

Smart task state can be enabled or disabled in the task settings:

1. Open AiderDesk Settings
2. Navigate to the **Tasks** section
3. Toggle **"Smart Task State"** to enable or disable

**When enabled**: Tasks automatically transition to appropriate states (More Info Needed, Ready for Implementation, or Ready for Review) based on the agent's response.

**When disabled**: Tasks will always transition to "Ready for Review" state after completion.

### Workflow Benefits

Smart task states help you understand what's happening with your work:

- **"More Info Needed"** tells you the agent is blocked and needs your input
- **"Ready for Implementation"** confirms the agent has a plan and is proceeding
- **"Ready for Review"** indicates it's time to check the agent's work

This reduces the need to read through every response to understand the task's status.

## Task Management Features

### Creating Tasks

**Automatic Creation**: Tasks are created automatically when you start a new conversation. The first prompt becomes the task's initial message.

**Manual Creation**: Use the "New Task" button in the Task Sidebar to create empty tasks or provide an initial prompt.

**Smart Naming**: Tasks are automatically named based on your first prompt, or you can name them manually. The smart naming feature generates concise, descriptive names.

### Task Operations

**Rename**: Change the task name at any time to better reflect its purpose.

**Duplicate**: Create a complete copy of a task including all state, messages, context, and todos. Useful for creating templates or trying alternative approaches.

**Delete**: Remove tasks with confirmation. Note that deleting a parent task will also delete all its subtasks.

**Archive**: Hide completed tasks from the main view while preserving them for future reference. Archived tasks can be unarchived at any time.

**Pin**: Pin important tasks to the top of the task list so they're always visible.

**Export**: Export tasks as Markdown files or PNG images for documentation, sharing, or archival.

### Task States

Tasks track various timestamps and states:
- **Created**: When the task was first created
- **Started**: When work on the task began
- **Updated**: Last time the task was modified
- **Completed**: When the task was marked as finished

### Cost Tracking

Each task independently tracks costs for both AI systems:

- **Aider Costs**: Token usage and costs for direct Aider interactions
- **Agent Costs**: Token usage and costs for Agent mode operations
- **Real-time Updates**: Costs are updated as you work
- **Persistent Storage**: Cost data is saved with the task

## Todo Management

Tasks include a built-in todo system for breaking down complex work.

### The Todo Window

A floating window appears when todos are present, providing:
- **Real-time View**: See all todos and their completion status
- **Manual Control**: Check/uncheck items to guide the work
- **Edit Capabilities**: Add, edit, or delete todo items
- **Agent Integration**: Agents can automatically manage todos

### Agent Todo Tools

When using Agent Mode, the AI can:
- **Set Items**: Create or overwrite the todo list with a plan
- **Get Items**: Read the current todo state
- **Update Completion**: Mark items as complete/incomplete
- **Clear Items**: Remove all todos when starting fresh

For more details, see [Todo Management in Agent Mode](../agent-mode/task-management.md).

## Agent Integration: Task Tools

When working in Agent Mode, the AI has access to powerful [Task Tools](../agent-mode/task-tools.md) that enable it to interact with the task system programmatically.

These tools allow agents to:
- **List and Search Tasks**: Find tasks matching specific criteria or search within task content
- **Read Task Information**: Get detailed information about task context, messages, and metadata
- **Create New Tasks**: Create independent tasks or subtasks as part of a larger plan
- **Manage Tasks**: Delete tasks when appropriate or update task state
- **Cross-Task Learning**: Search within related tasks to understand implementation patterns

This enables sophisticated workflows where agents can:
- Break down complex projects into hierarchical task structures
- Reference previous work and decisions
- Organize work to mirror your project structure
- Maintain context across multiple related tasks

For detailed documentation of task tools, see the [Task Tools guide](../agent-mode/task-tools.md).

## Advanced Features

### Task Duplication
Create complete copies of tasks including:
- All chat messages and context
- Todo items and their completion state
- Cost tracking data
- Worktree configuration

Use duplication to:
- Create templates for common tasks
- Try alternative implementations
- Share task configurations with team members
- Experiment without affecting the original

### Export Options
- **Markdown Export**: Save the entire conversation as a formatted markdown file
- **Image Export**: Capture the task view as a PNG image
- **Context Preservation**: Maintains formatting and structure in exports

### Integration with Other Features

- **Git Worktrees**: Seamlessly works with isolated development environments
- **Agent Mode**: Enhanced capabilities when using AI agents with [Task Tools](../agent-mode/task-tools.md)
- **IDE Connectors**: Automatic context file management via IDE plugins
- **Custom Commands**: Task-aware command execution
- **Hooks**: Automate actions at key task lifecycle events

## Best Practices

### Task Organization
- **Use Descriptive Names**: Choose clear, descriptive names that reflect the task's purpose
- **Keep Tasks Focused**: Each task should address a specific feature, bug fix, or piece of work
- **Regular Cleanup**: Archive or delete completed tasks to keep your workspace organized
- **Use Subtasks Wisely**: Break down large features, but avoid creating subtasks for every small step
- **Pin Important Tasks**: Keep key tasks visible by pinning them to the top

### Working with Worktrees
- **Experiment Freely**: Use worktree mode for risky experimental changes
- **Feature Isolation**: Create separate worktrees for different features to prevent conflicts
- **Safe Merging**: Use the built-in merge and revert functionality to integrate changes safely
- **Inheritance**: Remember that subtasks automatically inherit parent worktree configuration

### Cost Management
- **Monitor Costs**: Keep an eye on per-task costs to stay within budget
- **Compare Approaches**: Use cost data to compare different approaches and optimize prompts
- **Track by Type**: Separate Aider and Agent costs to understand where spending occurs

### State Management
- **Enable Smart States**: Use smart task state to automatically track work progress
- **Understand States**: Know what each state means and what actions are appropriate
- **Manual Override**: You can manually change task states if the automatic analysis isn't accurate
- **Use as Signal**: Task states provide clear signals about what needs your attention

## Summary

Tasks provide a powerful, flexible foundation for managing your AI-assisted development work. They transform isolated AI conversations into an organized, searchable, and persistent knowledge base that grows with your project.

With features like subtasks for hierarchical organization, smart task states for workflow clarity, cost tracking for budget management, and seamless agent integration through task tools, tasks enable you to manage complex development workflows with confidence.

Whether you're building a small feature or managing a large-scale project, the task system provides the structure and tools you need to work effectively with AI assistance.

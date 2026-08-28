---
title: "Browser API"
sidebar_label: "Browser API"
---

# Browser API Implementation

The Browser API provides a JavaScript/TypeScript interface for interacting with AiderDesk directly from web browsers, enabling browser-based integrations and applications.

## Overview

The Browser API combines the [REST API](./rest-api) with [SocketIO real-time events](./socketio-events) to provide a complete programmatic interface to AiderDesk. This allows developers to build web-based IDE plugins, dashboards, and integrations that work seamlessly with AiderDesk.

### Architecture

The Browser API consists of three main components:

1. **HTTP Client**: Axios-based REST API client for synchronous operations
2. **SocketIO Client**: Real-time event streaming for live updates
3. **ApplicationAPI Interface**: Unified TypeScript interface matching the main AiderDesk API

## Getting Started

### Installation

```bash
npm install axios socket.io-client uuid
```

### Basic Usage

```javascript
import { BrowserApi } from './browser-api';

// Create the API client — it connects to AiderDesk automatically,
// deriving the server URL from the current browser location (default port 24337)
const api = new BrowserApi();

// Start a project
await api.startProject('/path/to/your/project');

// Run a prompt in a task
await api.runPrompt('/path/to/your/project', 'task-id', 'Create a hello world function');

// Listen to real-time events
const unsubscribe = api.addResponseChunkListener('/path/to/your/project', 'task-id', (data) => {
  console.log('AI Response:', data.chunk);
});

// Cleanup
api.destroy();
unsubscribe();
```

## Supported Methods

### Project Management

#### `startProject(baseDir: string)`
Starts a new AiderDesk project.

```javascript
await api.startProject('/path/to/project');
```

#### `stopProject(baseDir: string)`
Stops a running project.

```javascript
await api.stopProject('/path/to/project');
```

#### `getOpenProjects(): Promise<ProjectData[]>`
Retrieves all open projects.

```javascript
const projects = await api.getOpenProjects();
console.log('Open projects:', projects.length);
```

### Prompt Execution

#### `runPrompt(baseDir: string, taskId: string, prompt: string, mode?: Mode)`
Executes an AI prompt in the specified task.

```javascript
// Simple prompt
await api.runPrompt('/path/to/project', 'task-id', 'Create a login component');

// With specific mode
await api.runPrompt('/path/to/project', 'task-id', 'Review this code', 'ask');
```

#### `redoUserPrompt(baseDir: string, taskId: string, messageId: string, mode: Mode, updatedPrompt?: string)`
Re-executes a previously sent user prompt with optional modifications.

```javascript
await api.redoUserPrompt('/path/to/project', 'task-id', 'message-id', 'code', 'Add error handling');
```

### Context Management

#### `addFile(baseDir: string, taskId: string, filePath: string, readOnly?: boolean)`
Adds a file to the task's context.

```javascript
await api.addFile('/path/to/project', 'task-id', 'src/main.ts');
await api.addFile('/path/to/project', 'task-id', 'config.json', true); // Read-only
```

#### `dropFile(baseDir: string, taskId: string, path: string)`
Removes a file from the task's context.

```javascript
await api.dropFile('/path/to/project', 'task-id', 'src/utils.ts');
```

#### `getAddableFiles(baseDir: string, taskId: string): Promise<string[]>`
Gets all files that can be added to the task's context.

```javascript
const files = await api.getAddableFiles('/path/to/project', 'task-id');
```

### Commands and Execution

#### `runCommand(baseDir: string, taskId: string, command: string)`
Executes a shell command in the project.

```javascript
await api.runCommand('/path/to/project', 'task-id', 'npm install');
```

#### `getCommands(baseDir: string): Promise<CommandsData>`
Retrieves available commands (custom commands and extension-provided commands).

```javascript
const { customCommands, extensionCommands } = await api.getCommands('/path/to/project');
```

#### `runCustomCommand(baseDir: string, taskId: string, commandName: string, args: string[], mode: Mode)`
Executes a custom command.

```javascript
await api.runCustomCommand('/path/to/project', 'task-id', 'format-code', ['src/'], 'code');
```

### Task Management

#### `createNewTask(baseDir: string, params?: CreateTaskParams): Promise<TaskData>`
Creates a new task. Params may include `parentId`, `name`, `autonomyMode`, and `activate`.

```javascript
const task = await api.createNewTask('/path/to/project', { name: 'Implement login' });
```

#### `updateTask(baseDir: string, id: string, updates: Partial<TaskData>): Promise<boolean>`
Updates a task's properties.

```javascript
const success = await api.updateTask('/path/to/project', 'task-id', { name: 'Renamed task' });
```

#### `deleteTask(baseDir: string, id: string): Promise<boolean>`
Deletes a task.

```javascript
const success = await api.deleteTask('/path/to/project', 'task-id');
```

#### `getTasks(baseDir: string): Promise<TaskData[]>`
Lists all tasks.

```javascript
const tasks = await api.getTasks('/path/to/project');
```

#### `loadTask(baseDir: string, taskId: string): Promise<TaskStateData>`
Loads a task's runtime state, including its conversation messages.

```javascript
const state = await api.loadTask('/path/to/project', 'task-id');
```

### Settings and Configuration

#### `loadSettings(): Promise<SettingsData>`
Loads application settings.

```javascript
const settings = await api.loadSettings();
```

#### `saveSettings(settings: SettingsData): Promise<SettingsData>`
Saves application settings.

```javascript
const updatedSettings = await api.saveSettings(newSettings);
```

#### `getProjectSettings(baseDir: string): Promise<ProjectSettings>`
Gets project-specific settings.

```javascript
const projectSettings = await api.getProjectSettings('/path/to/project');
```

### Real-Time Event Listeners

#### Response Events

All event listeners take `(baseDir: string, taskId: string, callback)` and return an unsubscribe function. Use an empty string for `taskId` to receive events from any task in the project.

```javascript
// Listen to response chunks
const unsubscribeChunk = api.addResponseChunkListener('/path/to/project', 'task-id', (data) => {
  console.log('Chunk:', data.chunk);
});

// Listen to response completion
const unsubscribeComplete = api.addResponseCompletedListener('/path/to/project', 'task-id', (data) => {
  console.log('Response completed:', data.messageId);
  console.log('Usage:', data.usageReport);
});
```

#### Context Events

```javascript
// Listen to context file updates
const unsubscribeContext = api.addContextFilesUpdatedListener('/path/to/project', 'task-id', (data) => {
  console.log('Context files updated:', data.files.length);
});
```

#### System Events

```javascript
// Listen to logs
const unsubscribeLog = api.addLogListener('/path/to/project', 'task-id', (data) => {
  console.log(`[${data.level}] ${data.message}`);
});

// Listen to tool execution
const unsubscribeTool = api.addToolListener('/path/to/project', 'task-id', (data) => {
  console.log('Tool executed:', data.toolName);
});
```

### Todo Management

#### `getTodos(baseDir: string, taskId: string): Promise<TodoItem[]>`
Retrieves a task's todo items.

```javascript
const todos = await api.getTodos('/path/to/project', 'task-id');
```

#### `addTodo(baseDir: string, taskId: string, name: string): Promise<TodoItem[]>`
Adds a new todo item.

```javascript
const todos = await api.addTodo('/path/to/project', 'task-id', 'Implement authentication');
```

#### `updateTodo(baseDir: string, taskId: string, name: string, updates: Partial<TodoItem>): Promise<TodoItem[]>`
Updates a todo item. Related methods include `deleteTodo` and `clearAllTodos`.

```javascript
const todos = await api.updateTodo('/path/to/project', 'task-id', 'Implement authentication', {
  completed: true
});
```

### Usage and Analytics

#### `queryUsageData(from: string, to: string): Promise<UsageDataRow[]>`
Queries usage data for a date range.

```javascript
const usageData = await api.queryUsageData('2025-01-01', '2025-01-31');
```

#### `getProviderModels(reload?: boolean): Promise<ProviderModelsData>`
Loads information about available AI models across provider profiles.

```javascript
const modelsData = await api.getProviderModels();
```

## Complete Integration Example

```javascript
import { BrowserApi } from './browser-api';

class AiderDeskIntegration {
  constructor() {
    this.api = new BrowserApi();
    this.currentProject = null;
  }

  async initialize(projectPath) {
    // Start the project
    await this.api.startProject(projectPath);
    this.currentProject = projectPath;

    // Setup real-time listeners
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Response streaming
    this.api.addResponseChunkListener(this.currentProject, '', (data) => {
      this.onResponseChunk(data);
    });

    // Response completion
    this.api.addResponseCompletedListener(this.currentProject, '', (data) => {
      this.onResponseComplete(data);
    });

    // Context updates
    this.api.addContextFilesUpdatedListener(this.currentProject, '', (data) => {
      this.onContextUpdate(data);
    });

    // Error handling
    this.api.addLogListener(this.currentProject, '', (data) => {
      if (data.level === 'error') {
        this.onError(data);
      }
    });
  }

  async createTask(prompt = '', mode = 'code') {
    const task = await this.api.createNewTask(this.currentProject, { prompt, mode });
    return task.id;
  }

  async runPrompt(taskId, prompt, mode = 'code') {
    try {
      await this.api.runPrompt(this.currentProject, taskId, prompt, mode);
    } catch (error) {
      console.error('Failed to run prompt:', error);
      throw error;
    }
  }

  async addFileToContext(taskId, filePath) {
    await this.api.addFile(this.currentProject, taskId, filePath);
  }

  async executeCommand(taskId, command) {
    await this.api.runCommand(this.currentProject, taskId, command);
  }

  // Event handlers
  onResponseChunk(data) {
    // Handle streaming response
    console.log('AI:', data.chunk);
  }

  onResponseComplete(data) {
    // Handle completion
    console.log('Response complete. Usage:', data.usage);
  }

  onContextUpdate(data) {
    // Handle context changes
    console.log('Context updated:', data.contextFiles.length, 'files');
  }

  onError(data) {
    // Handle errors
    console.error('Error:', data.message);
  }

  async cleanup() {
    if (this.currentProject) {
      await this.api.stopProject(this.currentProject);
    }
  }
}

// Usage
const integration = new AiderDeskIntegration();
await integration.initialize('/path/to/my/project');
const taskId = await integration.createTask();
await integration.runPrompt(taskId, 'Create a user authentication system');
```

## Limitations

The Browser API has some limitations compared to the native Electron API:

### Unsupported Features

- **File Dialogs**: `showOpenDialog()` and `getPathForFile()` are not supported (check `isOpenDialogSupported()`)
- **Logs Directory**: `openLogsDirectory()` is not supported (check `isOpenLogsDirectorySupported()`)
- **Cloudflare Tunnel**: starting/stopping the tunnel is not supported in the browser
- **Server Management**: `isManageServerSupported()` returns `false` — server start/stop must be done from the desktop app or CLI
- **Web Views**: `isWebViewSupported()` returns `false`

Terminal operations, prompts, tasks, context files, and most other functionality work in the browser via the underlying REST API and SocketIO connection.

### Workarounds

```javascript
// Check capability before using an unsupported feature
if (api.isOpenDialogSupported()) {
  const result = await api.showOpenDialog(options);
} else {
  // Fall back to a browser-native file picker or path input
  showBrowserFilePicker();
}
```


## Error Handling

The Browser API includes comprehensive error handling:

```javascript
try {
  await api.runPrompt(baseDir, prompt);
} catch (error) {
  if (error.response) {
    // HTTP error response
    console.error('HTTP Error:', error.response.status, error.response.data);
  } else if (error.request) {
    // Network error
    console.error('Network Error:', error.message);
  } else {
    // Other error
    console.error('Error:', error.message);
  }
}
```

## Advanced Usage

### Server URL

The `BrowserApi` constructor takes no arguments. The server base URL is derived automatically from the current browser location (`window.location`), so the page must be served from (or proxied to) the AiderDesk server host and port — by default port `24337`.

### Event Filtering and Management

```javascript
class EventManager {
  constructor(api) {
    this.api = api;
    this.listeners = new Map();
  }

  addFilteredListener(eventType, projectDir, callback) {
    const key = `${eventType}-${projectDir}`;
    if (this.listeners.has(key)) {
      return; // Already listening
    }

    const unsubscribe = this.api[`add${eventType}Listener`](projectDir, callback);
    this.listeners.set(key, unsubscribe);
  }

  removeAllListeners() {
    for (const unsubscribe of this.listeners.values()) {
      unsubscribe();
    }
    this.listeners.clear();
  }
}
```

### Integration with React

```javascript
import { useEffect, useState } from 'react';
import { BrowserApi } from './browser-api';

export function useAiderDesk(projectDir, taskId = '') {
  const [api, setApi] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [response, setResponse] = useState('');

  useEffect(() => {
    const browserApi = new BrowserApi();
    // The connection to the AiderDesk server is established automatically;
    // a disconnect callback can be registered for UI state handling.
    const handleDisconnect = () => setIsConnected(false);
    setApi(browserApi);
    setIsConnected(true);

    return () => {
      if (browserApi) {
        browserApi.destroy();
        handleDisconnect();
      }
    };
  }, [projectDir]);

  useEffect(() => {
    if (!api || !isConnected) return;

    const unsubscribe = api.addResponseChunkListener(projectDir, taskId, (data) => {
      setResponse(prev => prev + data.chunk);
    });

    return unsubscribe;
  }, [api, isConnected, projectDir, taskId]);

  const runPrompt = async (taskId, prompt, mode) => {
    if (!api) return;
    setResponse('');
    await api.runPrompt(projectDir, taskId, prompt, mode);
  };

  return { api, isConnected, response, runPrompt };
}
```

## Best Practices

1. **Connection Management**: Always initialize the API and handle connection states
2. **Event Cleanup**: Unsubscribe from events when components unmount
3. **Error Handling**: Implement comprehensive error handling for network issues
4. **Resource Management**: Clean up connections and listeners when done
5. **Feature Detection**: Check for supported features before using them
6. **Rate Limiting**: Implement appropriate delays between rapid API calls

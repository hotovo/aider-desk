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

// Initialize the API
const api = new BrowserApi();

// Connect to AiderDesk (default port 24337)
await api.initialize();

// Start a project
await api.startProject('/path/to/your/project');

// Run a prompt
await api.runPrompt('/path/to/your/project', 'Create a hello world function');

// Listen to real-time events
const unsubscribe = api.addResponseChunkListener('/path/to/your/project', (data) => {
  console.log('AI Response:', data.chunk);
});

// Cleanup
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

#### `runPrompt(baseDir: string, prompt: string, mode?: Mode)`
Executes an AI prompt in the specified project.

```javascript
// Simple prompt
await api.runPrompt('/path/to/project', 'Create a login component');

// With specific mode
await api.runPrompt('/path/to/project', 'Review this code', 'ask');
```

#### `redoLastUserPrompt(baseDir: string, mode: Mode, updatedPrompt?: string)`
Re-executes the last user prompt with optional modifications.

```javascript
await api.redoLastUserPrompt('/path/to/project', 'code', 'Add error handling');
```

### Context Management

#### `addFile(baseDir: string, filePath: string, readOnly?: boolean)`
Adds a file to the project's context.

```javascript
await api.addFile('/path/to/project', 'src/main.ts');
await api.addFile('/path/to/project', 'config.json', true); // Read-only
```

#### `dropFile(baseDir: string, path: string)`
Removes a file from the project's context.

```javascript
await api.dropFile('/path/to/project', 'src/utils.ts');
```

#### `getAddableFiles(baseDir: string): Promise<string[]>`
Gets all files that can be added to context.

```javascript
const files = await api.getAddableFiles('/path/to/project');
```

### Commands and Execution

#### `runCommand(baseDir: string, command: string)`
Executes a shell command in the project.

```javascript
await api.runCommand('/path/to/project', 'npm install');
```

#### `getCustomCommands(baseDir: string): Promise<CustomCommand[]>`
Retrieves available custom commands.

```javascript
const commands = await api.getCustomCommands('/path/to/project');
```

#### `runCustomCommand(baseDir: string, commandName: string, args: string[], mode: Mode)`
Executes a custom command.

```javascript
await api.runCustomCommand('/path/to/project', 'format-code', ['src/'], 'code');
```

### Session Management

#### `saveSession(baseDir: string, name: string): Promise<boolean>`
Saves the current session.

```javascript
const success = await api.saveSession('/path/to/project', 'feature-login');
```

#### `listSessions(baseDir: string): Promise<SessionData[]>`
Lists all saved sessions.

```javascript
const sessions = await api.listSessions('/path/to/project');
```

#### `loadSessionMessages(baseDir: string, name: string): Promise<void>`
Loads session messages.

```javascript
await api.loadSessionMessages('/path/to/project', 'feature-login');
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

```javascript
// Listen to response chunks
const unsubscribeChunk = api.addResponseChunkListener('/path/to/project', (data) => {
  console.log('Chunk:', data.chunk);
  console.log('Is last:', data.isLast);
});

// Listen to response completion
const unsubscribeComplete = api.addResponseCompletedListener('/path/to/project', (data) => {
  console.log('Response completed:', data.responseId);
  console.log('Usage:', data.usage);
});
```

#### Context Events

```javascript
// Listen to context file updates
const unsubscribeContext = api.addContextFilesUpdatedListener('/path/to/project', (data) => {
  console.log('Context files updated:', data.contextFiles.length);
});
```

#### System Events

```javascript
// Listen to logs
const unsubscribeLog = api.addLogListener('/path/to/project', (data) => {
  console.log(`[${data.level}] ${data.message}`);
});

// Listen to tool execution
const unsubscribeTool = api.addToolListener('/path/to/project', (data) => {
  console.log('Tool executed:', data.toolName);
});
```

### Todo Management

#### `getTodos(baseDir: string): Promise<TodoItem[]>`
Retrieves project todos.

```javascript
const todos = await api.getTodos('/path/to/project');
```

#### `addTodo(baseDir: string, name: string): Promise<TodoItem[]>`
Adds a new todo item.

```javascript
const todos = await api.addTodo('/path/to/project', 'Implement authentication');
```

#### `updateTodo(baseDir: string, name: string, updates: Partial<TodoItem>): Promise<TodoItem[]>`
Updates a todo item.

```javascript
const todos = await api.updateTodo('/path/to/project', 'Implement authentication', {
  completed: true
});
```

### Usage and Analytics

#### `queryUsageData(from: string, to: string): Promise<UsageDataRow[]>`
Queries usage data for a date range.

```javascript
const usageData = await api.queryUsageData('2025-01-01', '2025-01-31');
```

#### `loadModelsInfo(): Promise<Record<string, ModelInfo>>`
Loads information about available AI models.

```javascript
const modelsInfo = await api.loadModelsInfo();
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
    await this.api.initialize();

    // Start the project
    await this.api.startProject(projectPath);
    this.currentProject = projectPath;

    // Setup real-time listeners
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Response streaming
    this.api.addResponseChunkListener(this.currentProject, (data) => {
      this.onResponseChunk(data);
    });

    // Response completion
    this.api.addResponseCompletedListener(this.currentProject, (data) => {
      this.onResponseComplete(data);
    });

    // Context updates
    this.api.addContextFilesUpdatedListener(this.currentProject, (data) => {
      this.onContextUpdate(data);
    });

    // Error handling
    this.api.addLogListener(this.currentProject, (data) => {
      if (data.level === 'error') {
        this.onError(data);
      }
    });
  }

  async runPrompt(prompt, mode = 'code') {
    try {
      await this.api.runPrompt(this.currentProject, prompt, mode);
    } catch (error) {
      console.error('Failed to run prompt:', error);
      throw error;
    }
  }

  async addFileToContext(filePath) {
    await this.api.addFile(this.currentProject, filePath);
  }

  async executeCommand(command) {
    await this.api.runCommand(this.currentProject, command);
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
await integration.runPrompt('Create a user authentication system');
```

## Limitations

The Browser API has some limitations compared to the native Electron API:

### Unsupported Features

- **File Dialogs**: `showOpenDialog()` and `getPathForFile()` are not supported
- **Terminal Operations**: All terminal-related methods throw `UnsupportedError`
- **Logs Directory**: `openLogsDirectory()` is not supported
- **System Operations**: Some system-level operations may not be available

### Workarounds

```javascript
// Check if features are supported
if (api.isTerminalSupported()) {
  // Use terminal features
} else {
  // Fallback to command execution
  await api.runCommand(baseDir, command);
}

// Handle unsupported operations
try {
  await api.showOpenDialog(options);
} catch (error) {
  if (error instanceof UnsupportedError) {
    // Show browser-based file picker or alternative UI
    showBrowserFilePicker();
  }
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

### Custom HTTP Client Configuration

```javascript
import axios from 'axios';

const customApi = new BrowserApi({
  baseURL: 'http://localhost:3000/api',
  timeout: 30000,
  headers: {
    'Authorization': 'Bearer token'
  }
});
```

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

export function useAiderDesk(projectDir) {
  const [api, setApi] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [response, setResponse] = useState('');

  useEffect(() => {
    const browserApi = new BrowserApi();
    browserApi.initialize().then(() => {
      setApi(browserApi);
      setIsConnected(true);
    });

    return () => {
      if (browserApi) {
        browserApi.disconnect();
      }
    };
  }, [projectDir]);

  useEffect(() => {
    if (!api || !isConnected) return;

    const unsubscribe = api.addResponseChunkListener(projectDir, (data) => {
      setResponse(prev => prev + data.chunk);
    });

    return unsubscribe;
  }, [api, isConnected, projectDir]);

  const runPrompt = async (prompt, mode) => {
    if (!api) return;
    setResponse('');
    await api.runPrompt(projectDir, prompt, mode);
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

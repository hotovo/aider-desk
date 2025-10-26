---
title: "SocketIO Real-Time Events"
sidebar_label: "SocketIO Events"
---

# SocketIO Real-Time Events

AiderDesk uses SocketIO to provide real-time event streaming, allowing external applications to receive live updates about project activities, AI responses, and system events.

## Overview

The SocketIO server runs on the same port as the REST API (default: `24337`, configurable via `AIDER_DESK_PORT`). Clients can connect and subscribe to specific event types to receive real-time updates.

### Connection Setup

```javascript
import io from 'socket.io-client';

// Connect to AiderDesk
const socket = io('http://localhost:24337', {
  autoConnect: true,
  forceNew: true,
});

// Subscribe to events
socket.on('connect', () => {
  socket.emit('message', {
    action: 'subscribe-events',
    eventTypes: ['response-chunk', 'response-completed', 'log', 'context-files-updated']
  });
});
```

### Event Filtering

Events can be filtered by project directory and task ID when applicable. The system compares base directories and task IDs to ensure events are only sent to relevant subscribers.

**Project-level filtering**: Events are filtered by `baseDir` to match the project directory.
**Task-level filtering**: Task-specific events are also filtered by `taskId` for granular control.

## Event Types

### Response Events

#### `response-chunk`
Emitted during AI response streaming for real-time updates.

**Data Structure:**
```json
{
  "messageId": "unique-message-id",
  "baseDir": "/path/to/project",
  "taskId": "task-uuid",
  "chunk": "AI response text chunk",
  "reflectedMessage": "optional reflected message",
  "promptContext": {
    "id": "context-uuid",
    "group": {
      "id": "group-uuid",
      "name": "optional group name",
      "color": "optional group color",
      "finished": false
    }
  }
}
```

#### `response-completed`
Emitted when an AI response is fully completed.

**Data Structure:**
```json
{
  "type": "response-completed",
  "messageId": "unique-message-id",
  "baseDir": "/path/to/project",
  "taskId": "task-uuid",
  "content": "Complete AI response",
  "reflectedMessage": "optional reflected message",
  "editedFiles": ["file1.ts", "file2.ts"],
  "commitHash": "abc123",
  "commitMessage": "Changes committed",
  "diff": "diff content",
  "usageReport": {
    "model": "gpt-4",
    "sentTokens": 100,
    "receivedTokens": 50,
    "messageCost": 0.0023,
    "cacheWriteTokens": 10,
    "cacheReadTokens": 5,
    "aiderTotalCost": 0.002,
    "agentTotalCost": 0.0003
  },
  "sequenceNumber": 1,
  "promptContext": {
    "id": "context-uuid",
    "group": {
      "id": "group-uuid",
      "name": "optional group name",
      "color": "optional group color",
      "finished": false
    }
  }
}
```

### Context Events

#### `context-files-updated`
Emitted when the project's context files are modified.

**Data Structure:**
```json
{
  "baseDir": "/path/to/project",
  "taskId": "task-uuid",
  "files": [
    {
      "path": "src/main.ts",
      "readOnly": false
    },
    {
      "path": "src/utils.ts",
      "readOnly": true
    }
  ]
}
```

#### `custom-commands-updated`
Emitted when custom commands are updated.

**Data Structure:**
```json
{
  "baseDir": "/path/to/project",
  "taskId": "task-uuid",
  "commands": [
    {
      "name": "format-code",
      "description": "Format code using prettier",
      "arguments": [
        {
          "description": "File to format",
          "required": false
        }
      ],
      "template": "prettier --write {{file}}",
      "includeContext": false,
      "autoApprove": false
    }
  ]
}
```

### AI and Model Events

#### `ask-question`
Emitted when the AI needs to ask the user a question.

**Data Structure:**
```json
{
  "baseDir": "/path/to/project",
  "taskId": "task-uuid",
  "text": "What framework would you like to use?",
  "subject": "Framework Selection",
  "isGroupQuestion": false,
  "answers": [
    {
      "text": "React",
      "shortkey": "r"
    },
    {
      "text": "Vue",
      "shortkey": "v"
    }
  ],
  "defaultAnswer": "React",
  "internal": false,
  "key": "framework-choice"
}
```

#### `update-aider-models`
Emitted when AI model information is updated.

**Data Structure:**
```json
{
  "baseDir": "/path/to/project",
  "taskId": "task-uuid",
  "mainModel": "gpt-4",
  "weakModel": "gpt-3.5-turbo",
  "architectModel": "gpt-4-turbo",
  "reasoningEffort": "medium",
  "thinkingTokens": "1000",
  "editFormat": "diff",
  "info": {
    "max_input_tokens": 128000,
    "max_output_tokens": 4096,
    "input_cost_per_token": 0.000003,
    "output_cost_per_token": 0.000015,
    "supports_function_calling": true,
    "supports_tool_choice": true,
    "litellm_provider": "openai"
  },
  "error": "Optional error message"
}
```

### Tool and Command Events

#### `tool`
Emitted during tool execution.

**Data Structure:**
```json
{
  "type": "tool",
  "baseDir": "/path/to/project",
  "taskId": "task-uuid",
  "id": "tool-execution-id",
  "serverName": "server-name",
  "toolName": "run_terminal_cmd",
  "args": ["npm", "install"],
  "response": "Installing dependencies...",
  "usageReport": {
    "model": "gpt-4",
    "sentTokens": 50,
    "receivedTokens": 25,
    "messageCost": 0.001,
    "cacheWriteTokens": 5,
    "cacheReadTokens": 2,
    "aiderTotalCost": 0.0008,
    "agentTotalCost": 0.0002
  },
  "promptContext": {
    "id": "context-uuid",
    "group": {
      "id": "group-uuid",
      "name": "optional group name",
      "color": "optional group color",
      "finished": false
    }
  }
}
```

#### `command-output`
Emitted when a command is executed.

**Data Structure:**
```json
{
  "baseDir": "/path/to/project",
  "taskId": "task-uuid",
  "command": "npm install",
  "output": "Installing dependencies...\nDone."
}
```

#### `terminal-data`
Emitted when terminal data is received.

**Data Structure:**
```json
{
  "terminalId": "term-123",
  "baseDir": "/path/to/project",
  "taskId": "task-uuid",
  "data": "npm install"
}
```

#### `terminal-exit`
Emitted when a terminal process exits.

**Data Structure:**
```json
{
  "terminalId": "term-123",
  "baseDir": "/path/to/project",
  "taskId": "task-uuid",
  "exitCode": 0,
  "signal": 15
}
```

### System Events

#### `log`
Emitted for logging information.

**Data Structure:**
```json
{
  "baseDir": "/path/to/project",
  "taskId": "task-uuid",
  "level": "info",
  "message": "Project initialized successfully",
  "finished": true,
  "promptContext": {
    "id": "context-uuid",
    "group": {
      "id": "group-uuid",
      "name": "optional group name",
      "color": "optional group color",
      "finished": false
    }
  }
}
```

#### `update-autocompletion`
Emitted when autocompletion data is updated.

**Data Structure:**
```json
{
  "baseDir": "/path/to/project",
  "taskId": "task-uuid",
  "words": [
    "/api/",
    "/src/",
    "/tests/"
  ],
  "allFiles": [
    "src/main.ts",
    "src/utils.ts"
  ],
  "models": [
    "gpt-4",
    "gpt-3.5-turbo"
  ]
}
```

#### `versions-info-updated`
Emitted when version information is updated.

**Data Structure:**
```json
{
  "aiderDeskCurrentVersion": "1.0.0",
  "aiderCurrentVersion": "0.45.0",
  "aiderDeskAvailableVersion": "1.1.0",
  "aiderAvailableVersion": "0.46.0",
  "aiderDeskDownloadProgress": 0.75,
  "aiderDeskNewVersionReady": false,
  "releaseNotes": "New features and bug fixes..."
}
```

### Session and Message Events

#### `user-message`
Emitted when a user sends a message.

**Data Structure:**
```json
{
  "type": "user",
  "id": "message-uuid",
  "baseDir": "/path/to/project",
  "taskId": "task-uuid",
  "content": "Implement user authentication",
  "promptContext": {
    "id": "context-uuid",
    "group": {
      "id": "group-uuid",
      "name": "optional group name",
      "color": "optional group color",
      "finished": false
    }
  }
}
```

#### `input-history-updated`
Emitted when input history is updated.

**Data Structure:**
```json
{
  "baseDir": "/path/to/project",
  "taskId": "task-uuid",
  "inputHistory": [
    "Create login component",
    "Add user validation",
    "Implement authentication"
  ]
}
```

### Project Management Events

#### `clear-task`
Emitted when a task is cleared.

**Data Structure:**
```json
{
  "baseDir": "/path/to/project",
  "taskId": "task-uuid",
  "clearMessages": true,
  "clearSession": false
}
```

#### `project-started`
Emitted when a project is started.

**Data Structure:**
```json
{
  "baseDir": "/path/to/project"
}
```

### Task Lifecycle Events

#### `task-created`
Emitted when a new task is created.

**Data Structure:**
```json
{
  "id": "task-uuid",
  "baseDir": "/path/to/project",
  "name": "Task Name",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "startedAt": "2024-01-01T00:00:00.000Z",
  "completedAt": "2024-01-01T00:00:00.000Z",
  "aiderTotalCost": 0.0,
  "agentTotalCost": 0.0
}
```

#### `task-initialized`
Emitted when a task is initialized with context.

**Data Structure:**
```json
{
  "id": "task-uuid",
  "baseDir": "/path/to/project",
  "name": "Task Name",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "startedAt": "2024-01-01T00:00:00.000Z",
  "completedAt": "2024-01-01T00:00:00.000Z",
  "aiderTotalCost": 0.0,
  "agentTotalCost": 0.0
}
```

#### `task-updated`
Emitted when task metadata is updated.

**Data Structure:**
```json
{
  "id": "task-uuid",
  "baseDir": "/path/to/project",
  "name": "Updated Task Name",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T01:00:00.000Z",
  "startedAt": "2024-01-01T00:00:00.000Z",
  "completedAt": "2024-01-01T00:00:00.000Z",
  "aiderTotalCost": 0.0,
  "agentTotalCost": 0.0
}
```

#### `task-started`
Emitted when a task is started.

**Data Structure:**
```json
{
  "id": "task-uuid",
  "baseDir": "/path/to/project",
  "name": "Task Name",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "startedAt": "2024-01-01T00:00:00.000Z",
  "completedAt": "2024-01-01T00:00:00.000Z",
  "aiderTotalCost": 0.0,
  "agentTotalCost": 0.0
}
```

#### `task-completed`
Emitted when a task is completed.

**Data Structure:**
```json
{
  "id": "task-uuid",
  "baseDir": "/path/to/project",
  "name": "Task Name",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "startedAt": "2024-01-01T00:00:00.000Z",
  "completedAt": "2024-01-01T01:00:00.000Z",
  "aiderTotalCost": 0.025,
  "agentTotalCost": 0.005
}
```

#### `task-cancelled`
Emitted when a task is cancelled.

**Data Structure:**
```json
{
  "id": "task-uuid",
  "baseDir": "/path/to/project",
  "name": "Task Name",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "startedAt": "2024-01-01T00:00:00.000Z",
  "completedAt": "2024-01-01T00:30:00.000Z",
  "aiderTotalCost": 0.015,
  "agentTotalCost": 0.003
}
```

#### `task-deleted`
Emitted when a task is deleted.

**Data Structure:**
```json
{
  "id": "task-uuid",
  "baseDir": "/path/to/project",
  "name": "Task Name",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "startedAt": "2024-01-01T00:00:00.000Z",
  "completedAt": "2024-01-01T00:00:00.000Z",
  "aiderTotalCost": 0.0,
  "agentTotalCost": 0.0
}
```

### Settings and Provider Events

#### `settings-updated`
Emitted when application settings are updated.

**Data Structure:**
```json
{
  "onboardingFinished": true,
  "language": "en",
  "startupMode": "last",
  "zoomLevel": 1.0,
  "notificationsEnabled": true,
  "theme": "dark",
  "font": "Inter",
  "fontSize": 14,
  "renderMarkdown": true,
  "virtualizedRendering": true,
  "aiderDeskAutoUpdate": true,
  "aider": {
    "options": "--auto-commits",
    "environmentVariables": "",
    "addRuleFiles": true,
    "autoCommits": true,
    "cachingEnabled": true,
    "watchFiles": true,
    "confirmBeforeEdit": false
  },
  "preferredModels": ["gpt-4", "claude-3-sonnet"],
  "agentProfiles": [],
  "mcpServers": {},
  "llmProviders": {},
  "telemetryEnabled": true,
  "telemetryInformed": true,
  "promptBehavior": {
    "suggestionMode": "automatically",
    "suggestionDelay": 500,
    "requireCommandConfirmation": {
      "add": false,
      "readOnly": false,
      "model": true,
      "modeSwitching": true
    },
    "useVimBindings": false
  },
  "server": {
    "enabled": false,
    "basicAuth": {
      "enabled": false,
      "username": "",
      "password": ""
    }
  }
}
```

#### `providers-updated`
Emitted when provider profiles are updated.

**Data Structure:**
```json
{
  "providers": [
    {
      "id": "openai-default",
      "name": "OpenAI",
      "provider": "openai",
      "headers": {}
    },
    {
      "id": "anthropic-default",
      "name": "Anthropic",
      "provider": "anthropic",
      "headers": {}
    }
  ]
}
```

#### `provider-models-updated`
Emitted when provider models are updated.

**Data Structure:**
```json
{
  "models": [
    {
      "id": "gpt-4",
      "providerId": "openai-default",
      "maxInputTokens": 128000,
      "maxOutputTokens": 4096,
      "inputCostPerToken": 0.000003,
      "outputCostPerToken": 0.000015,
      "cacheWriteInputTokenCost": 0.00000375,
      "cacheReadInputTokenCost": 0.000000375,
      "supportsTools": true,
      "isCustom": false,
      "isHidden": false,
      "hasModelOverrides": false,
      "providerOverrides": {}
    }
  ],
  "loading": false,
  "errors": {}
}
```

### Token and Usage Events

#### `update-tokens-info`
Emitted when token usage information is updated.

**Data Structure:**
```json
{
  "baseDir": "/path/to/project",
  "taskId": "task-uuid",
  "chatHistory": {
    "tokens": 500,
    "tokensEstimated": false,
    "cost": 0.01
  },
  "files": {
    "src/main.ts": {
      "tokens": 200,
      "tokensEstimated": false,
      "cost": 0.004
    }
  },
  "repoMap": {
    "tokens": 150,
    "tokensEstimated": false,
    "cost": 0.003
  },
  "systemMessages": {
    "tokens": 100,
    "tokensEstimated": false,
    "cost": 0.002
  },
  "agent": {
    "tokens": 300,
    "tokensEstimated": false,
    "cost": 0.006
  }
}
```

## Usage Examples

### Complete Client Implementation

```javascript
import io from 'socket.io-client';

class AiderDeskClient {
  constructor(port = 24337) {
    this.socket = io(`http://localhost:${port}`);
    this.setupEventHandlers();
  }

  connect() {
    this.socket.on('connect', () => {
      console.log('Connected to AiderDesk');
      this.subscribeToEvents([
        'response-chunk',
        'response-completed',
        'log',
        'context-files-updated',
        'task-completed',
        'settings-updated'
      ]);
    });
  }

  subscribeToEvents(eventTypes) {
    this.socket.emit('message', {
      action: 'subscribe-events',
      eventTypes: eventTypes
    });
  }

  setupEventHandlers() {
    // Handle response streaming
    this.socket.on('response-chunk', (data) => {
      console.log(`AI Response chunk for task ${data.taskId}:`, data.chunk);
      process.stdout.write(data.chunk);
    });

    // Handle completion
    this.socket.on('response-completed', (data) => {
      console.log(`Response completed for task ${data.taskId} in ${data.baseDir}`);
      if (data.usageReport) {
        console.log(`Tokens: ${data.usageReport.sentTokens + data.usageReport.receivedTokens}, Cost: ${data.usageReport.messageCost}`);
      }
    });

    // Handle context updates
    this.socket.on('context-files-updated', (data) => {
      console.log(`Context updated for task ${data.taskId} in ${data.baseDir}`);
      console.log(`Files in context: ${data.files.length}`);
    });

    // Handle task lifecycle
    this.socket.on('task-completed', (data) => {
      console.log(`Task ${data.name} completed in ${data.baseDir}`);
      console.log(`Total cost: ${data.aiderTotalCost + data.agentTotalCost}`);
    });

    // Handle settings updates
    this.socket.on('settings-updated', (data) => {
      console.log('Settings updated:', data);
    });

    // Handle logs
    this.socket.on('log', (data) => {
      console.log(`[${data.level.toUpperCase()}] ${data.baseDir} [${data.taskId}]: ${data.message}`);
    });
  }

  disconnect() {
    this.socket.disconnect();
  }
}

// Usage
const client = new AiderDeskClient();
client.connect();
```

### React Hook for Real-Time Updates

```javascript
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

export function useAiderDeskEvents(projectDir, taskId = null, eventTypes = []) {
  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const socket = io('http://localhost:24337');

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('message', {
        action: 'subscribe-events',
        eventTypes: eventTypes
      });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Listen to all subscribed events
    eventTypes.forEach(eventType => {
      socket.on(eventType, (data) => {
        // Filter by project directory
        if (data.baseDir !== projectDir) {
          return;
        }
        
        // Filter by task ID if specified
        if (taskId && data.taskId && data.taskId !== taskId) {
          return;
        }
        
        setEvents(prev => [...prev, { type: eventType, data, timestamp: Date.now() }]);
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [projectDir, taskId, eventTypes]);

  return { isConnected, events };
}

// Usage example
function TaskComponent({ projectDir, taskId }) {
  const { isConnected, events } = useAiderDeskEvents(
    projectDir, 
    taskId, 
    ['response-chunk', 'response-completed', 'task-completed']
  );

  return (
    <div>
      <div>Connected: {isConnected ? 'Yes' : 'No'}</div>
      <div>Events: {events.length}</div>
    </div>
  );
}
```

### Task-Specific Event Filtering

```javascript
// Listen to events for a specific task
socket.on('connect', () => {
  socket.emit('message', {
    action: 'subscribe-events',
    eventTypes: ['response-chunk', 'response-completed', 'tool', 'log']
  });
});

// Filter events by task ID
socket.on('response-chunk', (data) => {
  if (data.taskId === 'my-specific-task-id') {
    console.log('Response for my task:', data.chunk);
  }
});

socket.on('tool', (data) => {
  if (data.taskId === 'my-specific-task-id') {
    console.log(`Tool ${data.toolName} executed:`, data.response);
  }
});
```

## Error Handling

Handle connection errors and disconnections gracefully:

```javascript
socket.on('connect_error', (error) => {
  console.error('SocketIO connection error:', error);
  // Implement retry logic or show error message to user
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  if (reason === 'io server disconnect') {
    // Server disconnected, manual reconnection needed
    socket.connect();
  } else if (reason === 'ping timeout' || reason === 'transport close') {
    // Network issues, socket will try to reconnect automatically
    console.log('Network issue detected, attempting to reconnect...');
  }
});

// Handle connection timeout
socket.on('connect_timeout', () => {
  console.error('Connection timeout');
});
```

## Best Practices

1. **Event Filtering**: Always filter events by `baseDir` and `taskId` to only process relevant updates
2. **Connection Management**: Implement proper connection lifecycle management with reconnection logic
3. **Error Handling**: Handle network errors and connection drops gracefully with user feedback
4. **Resource Cleanup**: Always disconnect when the component/application unmounts
5. **Selective Subscriptions**: Only subscribe to the events you need to minimize network traffic
6. **Task-Level Filtering**: Use `taskId` filtering for granular event handling in multi-task scenarios
7. **Type Safety**: Use TypeScript interfaces for event data structures when possible
8. **Event Ordering**: Handle `sequenceNumber` in response events for proper message ordering
9. **Usage Tracking**: Monitor `usageReport` data for cost tracking and optimization
10. **Context Awareness**: Use `promptContext` to understand the context of events

## Event Subscription Patterns

### Project-Level Events
```javascript
// Subscribe to project-wide events
socket.emit('message', {
  action: 'subscribe-events',
  eventTypes: ['project-started', 'settings-updated', 'providers-updated']
});
```

### Task-Level Events
```javascript
// Subscribe to task-specific events
socket.emit('message', {
  action: 'subscribe-events',
  eventTypes: ['response-chunk', 'response-completed', 'tool', 'task-completed']
});

// Filter by taskId in event handlers
socket.on('response-chunk', (data) => {
  if (data.taskId === currentTaskId) {
    handleResponseChunk(data);
  }
});
```

### System-Level Events
```javascript
// Subscribe to system-wide events
socket.emit('message', {
  action: 'subscribe-events',
  eventTypes: ['versions-info-updated', 'log']
});
```

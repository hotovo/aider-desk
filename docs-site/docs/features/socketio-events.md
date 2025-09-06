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

Events can be filtered by project directory when applicable. The system compares base directories to ensure events are only sent to relevant subscribers.

## Event Types

### Response Events

#### `response-chunk`
Emitted during AI response streaming for real-time updates.

**Data Structure:**
```json
{
  "messageId": "unique-message-id",
  "baseDir": "/path/to/project",
  "chunk": "AI response text chunk",
  "reflectedMessage": "optional reflected message",
  "promptContext": "optional prompt context"
}
```

#### `response-completed`
Emitted when an AI response is fully completed.

**Data Structure:**
```json
{
  "messageId": "unique-message-id",
  "baseDir": "/path/to/project",
  "content": "Complete AI response",
  "reflectedMessage": "optional reflected message",
  "editedFiles": ["file1.ts", "file2.ts"],
  "commitHash": "abc123",
  "commitMessage": "Changes committed",
  "diff": "diff content",
  "usageReport": {
    "tokens": 150,
    "cost": 0.0023
  },
  "sequenceNumber": 1,
  "promptContext": "optional prompt context"
}
```

### Context Events

#### `file-added`
Emitted when a file is added to the project context.

**Data Structure:**
```json
{
  "baseDir": "/path/to/project",
  "file": {
    "path": "src/new-file.ts",
    "readOnly": false
  }
}
```

#### `context-files-updated`
Emitted when the project's context files are modified.

**Data Structure:**
```json
{
  "baseDir": "/path/to/project",
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
  "commands": [
    {
      "name": "format-code",
      "description": "Format code using prettier",
      "arguments": [
        {
          "name": "file",
          "description": "File to format"
        }
      ],
      "template": "prettier --write {{file}}",
      "includeContext": false
    }
  ]
}
```

#### `custom-command-error`
Emitted when a custom command execution fails.

**Data Structure:**
```json
{
  "baseDir": "/path/to/project",
  "error": "Command execution failed: Invalid arguments"
}
```

### AI and Model Events

#### `ask-question`
Emitted when the AI needs to ask the user a question.

**Data Structure:**
```json
{
  "baseDir": "/path/to/project",
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
  "mainModel": "gpt-4",
  "weakModel": "gpt-3.5-turbo",
  "architectModel": "gpt-4-turbo",
  "reasoningEffort": "medium",
  "thinkingTokens": 1000,
  "editFormat": "diff",
  "info": "Model info",
  "error": "Optional error message"
}
```

### Tool and Command Events

#### `tool`
Emitted during tool execution.

**Data Structure:**
```json
{
  "baseDir": "/path/to/project",
  "id": "tool-execution-id",
  "serverName": "server-name",
  "toolName": "run_terminal_cmd",
  "args": ["npm", "install"],
  "response": "Installing dependencies...",
  "usageReport": {
    "tokens": 50,
    "cost": 0.001
  },
  "promptContext": "optional prompt context"
}
```

#### `command-output`
Emitted when a command is executed.

**Data Structure:**
```json
{
  "baseDir": "/path/to/project",
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
  "exitCode": 0,
  "signal": "SIGTERM"
}
```

### System Events

#### `log`
Emitted for logging information.

**Data Structure:**
```json
{
  "baseDir": "/path/to/project",
  "level": "info",
  "message": "Project initialized successfully",
  "finished": true,
  "promptContext": "optional prompt context"
}
```

#### `update-autocompletion`
Emitted when autocompletion data is updated.

**Data Structure:**
```json
{
  "baseDir": "/path/to/project",
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
  "electron": "29.1.0",
  "node": "20.10.0",
  "chrome": "120.0.0",
  "v8": "12.0.0"
}
```

### Session and Message Events

#### `user-message`
Emitted when a user sends a message.

**Data Structure:**
```json
{
  "baseDir": "/path/to/project",
  "content": "Implement user authentication",
  "mode": "ask",
  "promptContext": "optional prompt context"
}
```

#### `input-history-updated`
Emitted when input history is updated.

**Data Structure:**
```json
{
  "baseDir": "/path/to/project",
  "messages": [
    "Create login component",
    "Add user validation",
    "Implement authentication"
  ]
}
```

### Project Management Events

#### `clear-project`
Emitted when a project is cleared.

**Data Structure:**
```json
{
  "baseDir": "/path/to/project",
  "clearMessages": true,
  "clearFiles": false
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

### Token and Usage Events

#### `update-tokens-info`
Emitted when token usage information is updated.

**Data Structure:**
```json
{
  "baseDir": "/path/to/project",
  "chatHistory": {
    "tokens": 500,
    "tokensEstimated": 550,
    "cost": 0.01
  },
  "files": {
    "src/main.ts": {
      "tokens": 200,
      "cost": 0.004
    }
  },
  "repoMap": {
    "tokens": 150,
    "cost": 0.003
  },
  "systemMessages": {
    "tokens": 100,
    "cost": 0.002
  },
  "agent": {
    "tokens": 300,
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
        'context-files-updated'
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
      if (data.isFirst) {
        console.log('AI Response started:', data.baseDir);
      }
      process.stdout.write(data.chunk);
      if (data.isLast) {
        console.log('\nResponse completed');
      }
    });

    // Handle completion
    this.socket.on('response-completed', (data) => {
      console.log(`Response completed for ${data.baseDir}`);
      console.log(`Tokens used: ${data.usage.tokens}, Cost: $${data.usage.cost}`);
    });

    // Handle context updates
    this.socket.on('context-files-updated', (data) => {
      console.log(`Context updated for ${data.baseDir}`);
      console.log(`Files in context: ${data.contextFiles.length}`);
    });

    // Handle logs
    this.socket.on('log', (data) => {
      console.log(`[${data.level.toUpperCase()}] ${data.baseDir}: ${data.message}`);
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

export function useAiderDeskEvents(projectDir, eventTypes = []) {
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
        if (data.baseDir === projectDir) {
          setEvents(prev => [...prev, { type: eventType, data, timestamp: Date.now() }]);
        }
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [projectDir, eventTypes]);

  return { isConnected, events };
}
```

## Error Handling

Handle connection errors and disconnections gracefully:

```javascript
socket.on('connect_error', (error) => {
  console.error('SocketIO connection error:', error);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  if (reason === 'io server disconnect') {
    // Server disconnected, manual reconnection needed
    socket.connect();
  }
});
```

## Best Practices

1. **Event Filtering**: Always filter events by `baseDir` to only process relevant updates
2. **Connection Management**: Implement proper connection lifecycle management
3. **Error Handling**: Handle network errors and connection drops gracefully
4. **Resource Cleanup**: Always disconnect when the component/application unmounts
5. **Selective Subscriptions**: Only subscribe to the events you need to minimize network traffic
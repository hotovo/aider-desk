---
title: "REST API"
sidebar_label: "REST API"
---

# REST API

AiderDesk exposes a comprehensive REST API that allows external tools, such as IDE plugins, web applications, and automation scripts, to interact with the application programmatically. The API runs on the same port as the main application, which defaults to `24337` but can be configured with the `AIDER_DESK_PORT` environment variable.

## Overview

The REST API is organized into logical modules covering different aspects of AiderDesk functionality:

- **Context Management**: File and context operations
- **Prompt Execution**: AI interaction and response handling
- **Project Management**: Project lifecycle and configuration
- **Settings Management**: Application and project settings
- **Session Management**: Conversation persistence
- **Todo Management**: Task tracking
- **Usage Analytics**: Token usage and cost tracking
- **System Integration**: Environment variables and system info
- **Custom Commands**: User-defined command execution
- **MCP Integration**: Model Context Protocol server management

## Authentication & Configuration

All API endpoints accept JSON payloads and return JSON responses. The API uses consistent error handling with appropriate HTTP status codes.

### Base URL
```
http://localhost:24337/api
```

### Common Request Patterns
Most endpoints require a `projectDir` parameter specifying the absolute path to the project directory.

### Error Handling
```json
{
  "error": "Error type",
  "message": "Human-readable error message",
  "details": "Additional error information"
}
```

## Endpoints by Category

### Context Management

#### Add Context File
Adds a file to the project's context for AI processing.

- **Endpoint**: `POST /api/add-context-file`
- **Request Body**:
  ```json
  {
    "projectDir": "/path/to/your/project",
    "path": "src/main.ts",
    "readOnly": false
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "message": "File added to context"
  }
  ```

#### Drop Context File
Removes a file from the project's context.

- **Endpoint**: `POST /api/drop-context-file`
- **Request Body**:
  ```json
  {
    "projectDir": "/path/to/your/project",
    "path": "src/utils.ts"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "message": "File dropped from context"
  }
  ```

#### Get Context Files
Retrieves the list of all files currently in the project's context.

- **Endpoint**: `POST /api/get-context-files`
- **Request Body**:
  ```json
  {
    "projectDir": "/path/to/your/project"
  }
  ```
- **Response**: `200 OK` (returns context files array)

#### Get Addable Files
Retrieves a list of all files in the project that can be added to the context.

- **Endpoint**: `POST /api/get-addable-files`
- **Request Body**:
  ```json
  {
    "projectDir": "/path/to/your/project",
    "searchRegex": ".*\\.ts$"
  }
  ```
- **Response**: `200 OK` (returns file paths array)

### Prompt Execution

#### Run Prompt
Executes an AI prompt in the specified project.

- **Endpoint**: `POST /api/run-prompt`
- **Request Body**:
  ```json
  {
    "projectDir": "/path/to/your/project",
    "prompt": "Create a user authentication system",
    "mode": "code"
  }
  ```
- **Response**: `200 OK` (returns prompt execution result)

#### Redo Last User Prompt
Re-executes the last user prompt with optional modifications.

- **Endpoint**: `POST /api/project/redo-prompt`
- **Request Body**:
  ```json
  {
    "projectDir": "/path/to/your/project",
    "mode": "code",
    "updatedPrompt": "Add error handling to the authentication system"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "message": "Redo last user prompt initiated"
  }
  ```

#### Answer Question
Provides an answer to a question asked by the AI.

- **Endpoint**: `POST /api/project/answer-question`
- **Request Body**:
  ```json
  {
    "projectDir": "/path/to/your/project",
    "answer": "React"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "message": "Answer submitted"
  }
  ```

### Project Management

#### Get Projects
Retrieves all open projects.

- **Endpoint**: `GET /api/projects`
- **Response**: `200 OK` (returns projects array)

#### Start Project
Starts a new AiderDesk project.

- **Endpoint**: `POST /api/project/start`
- **Request Body**:
  ```json
  {
    "projectDir": "/path/to/your/project"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "message": "Project started"
  }
  ```

#### Stop Project
Stops a running project.

- **Endpoint**: `POST /api/project/stop`
- **Request Body**:
  ```json
  {
    "projectDir": "/path/to/your/project"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "message": "Project stopped"
  }
  ```

#### Restart Project
Restarts a project with optional mode.

- **Endpoint**: `POST /api/project/restart`
- **Request Body**:
  ```json
  {
    "projectDir": "/path/to/your/project",
    "startupMode": "architect"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "message": "Project restarted"
  }
  ```

#### Get Project Settings
Retrieves settings for a specific project.

- **Endpoint**: `GET /api/project/settings?projectDir=/path/to/project`
- **Response**: `200 OK` (returns project settings object)

#### Patch Project Settings
Updates project settings.

- **Endpoint**: `PATCH /api/project/settings`
- **Request Body**:
  ```json
  {
    "projectDir": "/path/to/project",
    "mainModel": "gpt-4-turbo",
    "editFormat": "diff-fenced"
  }
  ```
- **Response**: `200 OK` (returns updated settings)

### Commands and Execution

#### Run Command
Executes a shell command in the project.

- **Endpoint**: `POST /api/project/run-command`
- **Request Body**:
  ```json
  {
    "projectDir": "/path/to/project",
    "command": "npm install"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "message": "Command executed"
  }
  ```

#### Paste Image
Pastes an image from clipboard into the project.

- **Endpoint**: `POST /api/project/paste-image`
- **Request Body**:
  ```json
  {
    "projectDir": "/path/to/project"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "message": "Image pasted"
  }
  ```

### Session Management

#### Save Session
Saves the current conversation session.

- **Endpoint**: `POST /api/project/session/save`
- **Request Body**:
  ```json
  {
    "projectDir": "/path/to/project",
    "name": "feature-login"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "message": "Session saved"
  }
  ```

#### List Sessions
Lists all saved sessions for a project.

- **Endpoint**: `GET /api/project/sessions?projectDir=/path/to/project`
- **Response**: `200 OK` (returns sessions array)

#### Load Session Messages
Loads messages from a saved session.

- **Endpoint**: `POST /api/project/session/load-messages`
- **Request Body**:
  ```json
  {
    "projectDir": "/path/to/project",
    "name": "feature-login"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "message": "Session messages loaded"
  }
  ```

### Settings Management

#### Get Settings
Retrieves application settings.

- **Endpoint**: `GET /api/settings`
- **Response**: `200 OK` (returns settings object)

#### Save Settings
Updates application settings.

- **Endpoint**: `POST /api/settings`
- **Request Body**:
  ```json
  {
    "language": "en",
    "theme": "dark",
    "font": "JetBrainsMono",
    "aiderDeskAutoUpdate": true,
    "aider": {
      "options": "--verbose --model gpt-4",
      "cachingEnabled": true,
      ...
    },
    "models": {
      "aiderPreferred": ["gpt-4", "claude-3-sonnet"],
      ...
    },
    "telemetryEnabled": false,
    "promptBehavior": {
      "suggestionMode": "automatically",
      ...
    },
    "server": {
      "enabled": true,
      ...
    },
    ...
  }
  ```
  For the complete `SettingsData` structure, see [src/common/types.ts](https://github.com/hotovo/aider-desk/blob/main/src/common/types.ts#L346).
- **Response**: `200 OK` (returns updated settings)

#### Get Models Info
Retrieves information about available AI models.

- **Endpoint**: `GET /api/models`
- **Response**: `200 OK` (returns models info object)

### Usage Analytics

#### Query Usage Data
Retrieves usage data for a specific date range.

- **Endpoint**: `GET /api/usage?from=2025-01-01&to=2025-01-31`
- **Response**: `200 OK` (returns usage data array)

### System Integration

#### Get Effective Environment Variable
Retrieves the effective value of an environment variable.

- **Endpoint**: `GET /api/system/env-var?key=OPENAI_API_KEY&baseDir=/path/to/project`
- **Response**: `200 OK` (returns environment variable object)

### MCP Integration

#### Load MCP Server Tools
Loads tools from an MCP server.

- **Endpoint**: `POST /api/mcp/tools`
- **Request Body**:
  ```json
  {
    "serverName": "filesystem",
    "config": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    }
  }
  ```
- **Response**: `200 OK` (returns tools array)

#### Reload MCP Servers
Reloads all MCP servers with new configuration.

- **Endpoint**: `POST /api/mcp/reload`
- **Request Body**:
  ```json
  {
    "mcpServers": {
      "filesystem": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
      }
    },
    "force": true
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "message": "MCP servers reloaded"
  }
  ```

### Additional Endpoints

The API includes many more endpoints for:

- **Input History**: Load and manage input history
- **File Operations**: Path validation, file suggestions, edit application
- **Conversation Management**: Remove messages, compact conversations
- **Web Scraping**: Scrape and add web content to context
- **Todo Management**: Create, update, and manage todo items
- **Custom Commands**: Execute user-defined commands
- **Version Management**: Check for updates and get version info
- **Terminal Operations**: Create, write to, and manage terminals

## Usage Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');
const AIDER_API_BASE = 'http://localhost:24337/api';
// Start a project
async function startProject(projectDir) {
  const response = await axios.post(`${AIDER_API_BASE}/project/start`, {
    projectDir: projectDir
  });
  return response.data;
}
// Run a prompt
async function runPrompt(projectDir, prompt) {
  const response = await axios.post(`${AIDER_API_BASE}/run-prompt`, {
    projectDir: projectDir,
    prompt: prompt,
    mode: 'code'
  });
  return response.data;
}
// Usage
const projectDir = '/path/to/my/project';
await startProject(projectDir);
const result = await runPrompt(projectDir, 'Create a hello world function');
```

### cURL Examples

```bash
# Start a project
curl -X POST http://localhost:24337/api/project/start \
  -H "Content-Type: application/json" \
  -d '{"projectDir": "/path/to/project"}'
# Run a prompt
curl -X POST http://localhost:24337/api/run-prompt \
  -H "Content-Type: application/json" \
  -d '{
    "projectDir": "/path/to/project",
    "prompt": "Create a hello world function",
    "mode": "code"
  }'
```

## Error Handling

The API uses standard HTTP status codes:
- **200**: Success
- **400**: Bad Request (invalid parameters)
- **403**: Forbidden (project not started)
- **404**: Not Found (project or resource doesn't exist)
- **429**: Too Many Requests (rate limiting)
- **500**: Internal Server Error

## Best Practices

1. **Project Management**: Always start projects before running prompts
2. **Error Handling**: Implement proper error handling for all API calls
3. **Resource Cleanup**: Use appropriate endpoints to clean up resources
4. **Rate Limiting**: Respect rate limits and implement exponential backoff
5. **Authentication**: Keep API keys secure when using environment variables
6. **Validation**: Validate paths and parameters before sending requests

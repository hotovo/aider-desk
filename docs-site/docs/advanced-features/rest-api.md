---
sidebar_position: 4
title: "REST API"
sidebar_label: "REST API"
---

# REST API

AiderDesk exposes a REST API that allows external tools, such as IDE plugins, to interact with the application programmatically. The API runs on the same port as the main application, which defaults to `24337` but can be configured with the `AIDER_DESK_PORT` environment variable.

### Add Context File
Adds a file to the project's context.

- **Endpoint**: `/api/add-context-file`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "projectDir": "path/to/your/project",
    "path": "path/to/the/file",
    "readOnly": false
  }
- **Response**: A JSON array of the current context files.

### Drop Context File
Removes a file from the project's context.

- **Endpoint**: `/api/drop-context-file`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "projectDir": "path/to/your/project",
    "path": "path/to/the/file"
  }
  ```
- **Response**: A JSON array of the current context files.

### Get Context Files
Retrieves the list of all files currently in the project's context.

- **Endpoint**: `/api/get-context-files`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "projectDir": "path/to/your/project"
  }
  ```
- **Response**: A JSON array of the current context files.

### Get Addable Files
Retrieves a list of all files in the project that can be added to the context.

- **Endpoint**: `/api/get-addable-files`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "projectDir": "path/to/your/project",
    "searchRegex": "optional/regex/filter"
  }
  ```
- **Response**: A JSON array of file paths.

### Run Prompt
Executes a prompt in the specified project.

- **Endpoint**: `/api/run-prompt`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "projectDir": "path/to/your/project",
    "prompt": "Your prompt here",
    "editFormat": "code" // Optional: "code", "ask", "architect", "context"
  }
  ```
- **Response**: A JSON array of response objects, each containing details about the AI's output, edited files, and usage reports.

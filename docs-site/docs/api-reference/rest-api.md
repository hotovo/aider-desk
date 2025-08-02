# REST API Reference

AiderDesk provides a REST API that allows external tools and services to interact with the application. The API runs on the same port as the main application, which defaults to `24337` but can be configured using the `AIDER_DESK_PORT` environment variable.

## Endpoints

### `/api/add-context-file`

-   **Method:** `POST`
-   **Description:** Adds a file to the context of a specified project.
-   **Request Body:**
    ```json
    {
      "projectDir": "path/to/your/project",
      "path": "path/to/the/file",
      "readOnly": false
    }
    ```
-   **Response:** An array of the context files in the project.
    ```json
    [
      {
        "path": "path/to/the/file",
        "readOnly": false
      }
    ]
    ```

### `/api/drop-context-file`

-   **Method:** `POST`
-   **Description:** Removes a file from the context of a specified project.
-   **Request Body:**
    ```json
    {
      "projectDir": "path/to/your/project",
      "path": "path/to/the/file"
    }
    ```
-   **Response:** An array of the context files in the project.
    ```json
    []
    ```

### `/api/get-context-files`

-   **Method:** `POST`
-   **Description:** Retrieves the list of files currently in the context of a project.
-   **Request Body:**
    ```json
    {
      "projectDir": "path/to/your/project"
    }
    ```
-   **Response:** An array of the context files in the project.
    ```json
    [
      {
        "path": "path/to/the/file",
        "readOnly": false
      }
    ]
    ```

### `/api/get-addable-files`

-   **Method:** `POST`
-   **Description:** Retrieves a list of all the files in a project that can be added to the context.
-   **Request Body:**
    ```json
    {
      "projectDir": "path/to/your/project",
      "searchRegex": "optional/regex/filter"
    }
    ```
-   **Response:** An array of file paths.
    ```json
    [
      {
        "path": "path/to/the/file"
      }
    ]
    ```

### `/api/run-prompt`

-   **Method:** `POST`
-   **Description:** Executes a prompt in a specified project within AiderDesk.
-   **Request Body:**
    ```json
    {
      "projectDir": "path/to/your/project",
      "prompt": "Your prompt here",
      "editFormat": "code" // Optional: "code", "ask", or "architect"
    }
    ```
-   **Response:** A JSON object containing the AI's response and other information.
    ```json
    {
      "messageId": "unique-message-id",
      "baseDir": "path/to/your/project",
      "content": "The AI generated response",
      "reflectedMessage": "Optional reflected message",
      "editedFiles": ["file1.txt", "file2.py"],
      "commitHash": "a1b2c3d4e5f6",
      "commitMessage": "Optional commit message",
      "diff": "Optional diff content",
      "usageReport": {
        "sentTokens": 100,
        "receivedTokens": 200,
        "messageCost": 0.5,
        "totalCost": 1.0,
        "mcpToolsCost": 0.2
      }
    }
    ```

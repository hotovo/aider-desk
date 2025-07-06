# AiderDesk REST API

AiderDesk includes a REST API that allows external applications and services to interact with its functionalities programmatically. This API can be used to automate workflows, integrate AiderDesk with other tools, or build custom interfaces.

**Note:** The availability and specifics of the REST API can change between AiderDesk versions. Always refer to the API documentation bundled with your specific AiderDesk version or hosted by the AiderDesk team for the most accurate and up-to-date information.

## Enabling and Accessing the API

1.  **Enable the API:**
    *   The REST API might need to be explicitly enabled in AiderDesk's settings. Look for a section related to "API," "Server," or "Integrations."
    *   You may also need to configure the port on which the API server will listen.

2.  **API Base URL:**
    *   Once enabled, the API will be accessible at a base URL, typically `http://localhost:<port>/api/v1` or similar. Replace `<port>` with the configured port number.

3.  **Authentication:**
    *   API requests usually require authentication to ensure that only authorized clients can access AiderDesk's features.
    *   Common authentication methods include:
        *   **API Key:** A secret key that must be included in the request headers (e.g., `X-API-Key: your_api_key`). You would typically generate this key from AiderDesk's settings.
        *   **Token-based Authentication:** Similar to API keys, but might involve short-lived tokens.
    *   Refer to AiderDesk's specific API documentation for details on how to authenticate your requests.

## Common API Endpoints and Functionalities

Below are examples of common functionalities that a REST API for an application like AiderDesk might expose. The exact endpoints, request/response formats, and parameters will vary.

### Project Management

-   **List Projects:**
    -   `GET /api/v1/projects`
    -   Returns a list of projects currently known to AiderDesk.
-   **Open Project:**
    -   `POST /api/v1/projects/open`
    -   Request Body: `{ "path": "/path/to/your/project" }`
    -   Opens a project in AiderDesk.
-   **Close Project:**
    -   `POST /api/v1/projects/{projectId}/close`
    -   Closes an active project session.
-   **Get Project Status:**
    -   `GET /api/v1/projects/{projectId}/status`
    -   Returns information about a project, such as active files, current mode, etc.

### Chat and Prompt Interaction

-   **Send Prompt:**
    -   `POST /api/v1/projects/{projectId}/prompt`
    -   Request Body: `{ "prompt": "Your query to the AI", "mode": "code|agent|ask" }`
    -   Sends a prompt to the AI in the context of the specified project and chat mode.
    -   The response might be asynchronous, providing a task ID to poll for results, or synchronous, returning the AI's response directly if it's quick.
-   **Get Chat History:**
    -   `GET /api/v1/projects/{projectId}/history`
    -   Retrieves the chat history for a project.
-   **Select Chat Mode:**
    -   `POST /api/v1/projects/{projectId}/mode`
    -   Request Body: `{ "mode": "code|agent|ask" }`
    -   Changes the active chat mode for a project.

### File Management (within Aider context)

-   **Add File to Context:**
    -   `POST /api/v1/projects/{projectId}/context/add`
    -   Request Body: `{ "filePath": "path/to/file.py" }`
    -   Adds a file to the AI's context (similar to `/add` in `aider`).
-   **Remove File from Context:**
    -   `POST /api/v1/projects/{projectId}/context/remove`
    -   Request Body: `{ "filePath": "path/to/file.py" }`
    -   Removes a file from the AI's context.
-   **List Context Files:**
    -   `GET /api/v1/projects/{projectId}/context`
    -   Returns a list of files currently in the AI's context.

### Agent Mode Control (if applicable)

-   **Start Agent Run:**
    -   `POST /api/v1/projects/{projectId}/agent/run`
    -   Request Body: `{ "goal": "Implement feature X", "agentProfile": "default" }`
    -   Initiates an agent run with a specific goal.
-   **Get Agent Status:**
    -   `GET /api/v1/projects/{projectId}/agent/status/{runId}`
    -   Checks the status of an ongoing agent run.
-   **Approve/Reject Agent Step:**
    -   `POST /api/v1/projects/{projectId}/agent/step/{stepId}/respond`
    -   Request Body: `{ "response": "approve|reject|feedback", "message": "Optional feedback" }`
    -   Allows programmatic approval or rejection of agent actions that require user intervention.

## Request and Response Formats

-   **JSON:** Most REST APIs use JSON for request and response payloads.
-   **HTTP Status Codes:** Standard HTTP status codes are used to indicate the outcome of API requests (e.g., `200 OK`, `201 Created`, `400 Bad Request`, `401 Unauthorized`, `404 Not Found`, `500 Internal Server Error`).

## Example Workflow: Automating a Code Change

1.  **Open Project:** Call `POST /api/v1/projects/open` with the project path.
2.  **Set Mode to Code:** Call `POST /api/v1/projects/{projectId}/mode` with `{"mode": "code"}`.
3.  **Add File to Context:** Call `POST /api/v1/projects/{projectId}/context/add` with the path to the file you want to modify.
4.  **Send Prompt for Change:** Call `POST /api/v1/projects/{projectId}/prompt` with instructions to modify the code.
5.  **Receive and Apply Diff:** The response might contain a diff. Your application would then need to confirm/apply this change (this step might involve further API calls if AiderDesk requires explicit approval for applying diffs via API).

## Best Practices for Using the API

-   **Error Handling:** Implement robust error handling in your client application to manage API errors gracefully.
-   **Rate Limiting:** Be aware of any rate limits imposed by the API to prevent abuse and ensure fair usage.
-   **Asynchronous Operations:** For long-running tasks (like complex agent runs or prompts), the API might use asynchronous patterns. Your client will need to poll for results or use webhooks if supported.
-   **Security:** Keep your API keys confidential. Do not embed them directly in client-side code if the client is publicly accessible.
-   **Version Control:** Pay attention to the API version in the URL (`/api/v1/`). Future AiderDesk updates might introduce new API versions with breaking changes.

The AiderDesk REST API opens up many possibilities for extending its functionality and integrating it into broader development ecosystems. For detailed instructions, endpoint specifications, and authentication procedures, always consult the official API documentation provided with your AiderDesk installation.

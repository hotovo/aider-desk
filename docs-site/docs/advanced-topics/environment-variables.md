# Environment Variables

AiderDesk can be configured using a number of environment variables. These variables allow you to customize the application's behavior without modifying any files.

To set an environment variable, you can define it in your shell before launching AiderDesk.

**macOS/Linux:**
```bash
export VARIABLE_NAME=value
AiderDesk
```

**Windows (PowerShell):**
```powershell
$env:VARIABLE_NAME = "value"
AiderDesk
```

Here is a list of the supported environment variables:

## Core Configuration

-   **`AIDER_DESK_PORT`**
    -   **Description:** Specifies the port on which the AiderDesk application and its REST API will run.
    -   **Default:** `24337`

-   **`AIDER_DESK_NO_AUTO_UPDATE`**
    -   **Description:** If set to `true`, this variable disables the automatic update check on startup.
    -   **Default:** `false`

-   **`AIDER_DESK_AIDER_VERSION`**
    -   **Description:** Allows you to specify a custom version of the `aider-chat` package to be installed. This can be a version number (e.g., `0.83.1`) or a Git URL.
    -   **See Also:** [Custom Aider Version](./custom-aider-version.md)

## API Keys and Credentials

You can also set API keys for various AI providers using environment variables. These variables will be used by AiderDesk if the corresponding API key is not set in the application's settings.

-   **`OPENAI_API_KEY`**: Your API key for OpenAI models.
-   **`ANTHROPIC_API_KEY`**: Your API key for Anthropic models.
-   **`GOOGLE_API_KEY`**: Your API key for Google models.
-   **`DEEPSEEK_API_KEY`**: Your API key for DeepSeek models.
-   **`GROQ_API_KEY`**: Your API key for Groq models.
-   **`OPENROUTER_API_KEY`**: Your API key for OpenRouter.

### AWS Credentials

For Amazon Bedrock, AiderDesk uses the standard AWS SDK credential chain. You can configure your credentials using the following environment variables:

-   **`AWS_ACCESS_KEY_ID`**
-   **`AWS_SECRET_ACCESS_KEY`**
-   **`AWS_SESSION_TOKEN`** (optional)
-   **`AWS_REGION`**

By using these environment variables, you can easily configure AiderDesk for different environments and workflows, and keep your sensitive API keys out of configuration files.

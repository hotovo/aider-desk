# Aider Options and Environment Variables in AiderDesk

AiderDesk, by integrating `aider`, allows users to leverage various `aider` command-line options and environment variables to customize its behavior. These settings can influence everything from the AI model used to how code changes are applied and how context is managed.

You can typically configure these in a few ways:

1.  **AiderDesk Settings UI:** AiderDesk may provide a graphical interface to set common `aider` options.
2.  **Project-Specific Configuration (`.aider.conf.yml`):** `aider` itself supports a configuration file named `.aider.conf.yml` in the project root. AiderDesk will respect this file.
3.  **Environment Variables:** Several aspects of `aider` and AiderDesk can be controlled by setting environment variables before launching AiderDesk.

## Common `aider` Options (via `.aider.conf.yml` or Settings UI)

These are options you might typically set in your `.aider.conf.yml` file or through AiderDesk's settings if it exposes them.

### Model Configuration

-   `model`: Specifies the primary language model to use (e.g., `gpt-4-turbo-preview`, `gpt-3.5-turbo`, `claude-2`, etc.).
    -   Example: `model: gpt-4-turbo-preview`
-   `edit_format`: Defines the format `aider` requests for code edits (e.g., `whole`, `diff`, `udiff`, `json`). `diff` or `udiff` are common for precise changes.
    -   Example: `edit_format: diff`
-   `map_tokens`: The maximum number of tokens to use for the repository map if that feature is enabled.
    -   Example: `map_tokens: 1024`

### Git and Committing

-   `auto_commit`: Boolean (`true`/`false`). If true, `aider` automatically commits changes after they are applied. AiderDesk might override or manage this setting.
    -   Example: `auto_commit: false`
-   `git_command`: Allows specifying a custom path to the `git` executable.
    -   Example: `git_command: /usr/local/bin/git`

### File Handling

-   `ignore_files`: A list of glob patterns for files that `aider` should ignore.
    -   Example: `ignore_files: ["*.log", "dist/*"]`
-   `aider_ignore_file`: Path to a custom ignore file (similar to `.gitignore`) for `aider`.
    -   Example: `aider_ignore_file: .aiderignore`

### Other Options

-   `pretty`: Boolean (`true`/`false`). If true, enables "pretty" console output with colors and formatting. AiderDesk handles its own UI, but this might affect logs.
    -   Example: `pretty: true`
-   `show_diffs`: Boolean (`true`/`false`). If true, `aider` prints diffs of changes to the console. AiderDesk has its own diff viewer.
    -   Example: `show_diffs: true`
-   `yes`: Boolean (`true`/`false`). If true, automatically answers "yes" to all `aider` confirmations. **Use with extreme caution**, especially in AiderDesk, as it might bypass important approval steps. AiderDesk's own auto-approve settings are generally safer.
    -   Example: `yes: false`

## Environment Variables

These are set in your shell environment before launching AiderDesk.

### API Key Configuration

-   `OPENAI_API_KEY`: Your API key for OpenAI models.
    -   Example: `export OPENAI_API_KEY="sk-..."`
-   `ANTHROPIC_API_KEY`: Your API key for Anthropic (Claude) models.
    -   Example: `export ANTHROPIC_API_KEY="sk-ant-..."`
-   Other model provider API keys as supported by `aider` (e.g., for Cohere, PaLM).

### Model and API Endpoint Configuration

-   `OPENAI_API_BASE`: Allows specifying a custom base URL for the OpenAI API, useful for proxying or using compatible local LLMs.
    -   Example: `export OPENAI_API_BASE="http://localhost:1234/v1"`
-   `AIDER_MODEL`: Overrides the model specified in `.aider.conf.yml` or UI settings.
    -   Example: `export AIDER_MODEL="gpt-4"`

### AiderDesk-Specific Environment Variables

AiderDesk may introduce its own environment variables to control its specific behaviors or integration with `aider`.

-   **`AIDER_DESK_AIDER_VERSION`**:
    -   Allows you to specify a custom version of the `aider-chat` Python package. This is useful for testing specific Aider releases, development branches, or local clones.
    -   Example: `export AIDER_DESK_AIDER_VERSION="0.36.1"` or `export AIDER_DESK_AIDER_VERSION="git+https://github.com/user/aider.git@my-branch"`
    -   See [Using a Custom Aider Version](custom-aider-version.md) for more details.

-   **`AIDER_DESK_EXTRA_PYTHON_PACKAGES`**:
    -   A comma-separated list of additional Python packages to install into AiderDesk's virtual environment. Useful for adding new libraries for `aider` to use or overriding dependency versions.
    -   Example: `export AIDER_DESK_EXTRA_PYTHON_PACKAGES="scikit-learn,pandas==1.5.0"`
    -   See [AIDER_DESK_EXTRA_PYTHON_PACKAGES](extra-python-packages.md) for more details.

-   **`AIDER_DESK_SHELL_COMMAND`**:
    -   Specifies the shell to use for executing commands (e.g., from Power Tools or `aider` itself if it shells out).
    -   Example: `export AIDER_DESK_SHELL_COMMAND="/bin/zsh"` (defaults to `/bin/bash` or system default).

-   **`AIDER_DESK_LOG_LEVEL`**:
    -   Controls the verbosity of AiderDesk's own logging (e.g., `debug`, `info`, `warn`, `error`).
    -   Example: `export AIDER_DESK_LOG_LEVEL="debug"`

-   **`AIDER_DESK_CONFIG_DIR`**:
    -   Overrides the default AiderDesk configuration directory (usually `~/.aider-desk/`).
    -   Example: `export AIDER_DESK_CONFIG_DIR="/path/to/custom/config"`

### Proxy Configuration

-   `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY`: Standard environment variables for configuring network proxy settings. `aider` and AiderDesk (for model access and updates) will respect these.
    -   Example: `export HTTPS_PROXY="http://yourproxy.server.com:port"`

## Precedence

Generally, the order of precedence for settings is:

1.  **Environment Variables:** Often override other settings.
2.  **AiderDesk UI Settings:** Settings configured directly in AiderDesk's interface.
3.  **Project-Specific `.aider.conf.yml`:** Configuration within the project's `aider` config file.
4.  **Global `aider` Configuration:** If `aider` supports a global config file (e.g., in `~/.aider/`).
5.  **Default Values:** Built-in defaults in `aider` and AiderDesk.

## Finding Available Options

-   **`aider --help`:** The most definitive source for `aider` command-line options is to run `aider --help` in a terminal if you have `aider-chat` installed independently. Many of these options have corresponding settings in `.aider.conf.yml`.
-   **AiderDesk Documentation:** Check AiderDesk's official documentation for settings it specifically manages or exposes.
-   **Aider Documentation:** Refer to the official `aider` documentation (e.g., on its GitHub repository) for details on `.aider.conf.yml` and supported environment variables.

By leveraging these options and environment variables, you can fine-tune AiderDesk and its underlying `aider` engine to perfectly match your development workflow, preferred models, and project requirements. Remember to restart AiderDesk after changing environment variables for them to take effect.

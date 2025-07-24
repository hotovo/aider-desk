# OpenTelemetry Integration Guide

AiderDesk leverages OpenTelemetry to provide detailed tracing and telemetry for Agent and Aider messages, allowing users to gain deeper insights into their AI interactions. This guide focuses on setting up Langfuse as a tracing backend, but the system is designed to be extensible to other OpenTelemetry-compatible providers.

## Langfuse Setup

Langfuse is an open-source LLM engineering platform that helps you to observe, evaluate, and improve your LLM applications.

To integrate AiderDesk with Langfuse, you need to provide your Langfuse API keys and host. These can be set as environment variables in two ways:

### 1. System-wide Environment Variables

You can set the following environment variables in your operating system. This method makes the keys available globally to all applications running on your system.

-   `LANGFUSE_PUBLIC_KEY`: Your Langfuse public key.
-   `LANGFUSE_SECRET_KEY`: Your Langfuse secret key.
-   `LANGFUSE_HOST`: The URL of your Langfuse instance (e.g., `https://cloud.langfuse.com`).

**Example (Linux/macOS - add to `~/.bashrc`, `~/.zshrc`, or `~/.profile`):**

```bash
export LANGFUSE_PUBLIC_KEY="pk_YOUR_PUBLIC_KEY"
export LANGFUSE_SECRET_KEY="sk_YOUR_SECRET_KEY"
export LANGFUSE_HOST="https://cloud.langfuse.com"
```

**Example (Windows - via System Properties or PowerShell):**

```powershell
$env:LANGFUSE_PUBLIC_KEY="pk_YOUR_PUBLIC_KEY"
$env:LANGFUSE_SECRET_KEY="sk_YOUR_SECRET_KEY"
$env:LANGFUSE_HOST="https://cloud.langfuse.com"
```

Remember to restart AiderDesk (and your terminal if setting system-wide) after setting these variables for them to take effect.

### 2. Project-specific `.env` file

For more granular control, you can create a `.env` file in the root directory of your AiderDesk project. This method ensures that the environment variables are only applied to that specific project.

Create a file named `.env` in your project's root directory with the following content:

```
LANGFUSE_PUBLIC_KEY="pk_YOUR_PUBLIC_KEY"
LANGFUSE_SECRET_KEY="sk_YOUR_SECRET_KEY"
LANGFUSE_HOST="https://cloud.langfuse.com"
```

AiderDesk will automatically detect and load these variables when the project is opened.

### Obtaining Langfuse API Keys

To get your Langfuse API keys, you can [self-host Langfuse](https://langfuse.com/docs/deployment/self-host) or sign up for Langfuse Cloud [here](https://cloud.langfuse.com/). Create a project in the Langfuse dashboard to get your secretKey and publicKey.

## Extending Telemetry

AiderDesk's telemetry system is built on OpenTelemetry, which is a vendor-neutral observability framework. This means there is ample room for implementing support for other OpenTelemetry-compatible tracing providers beyond Langfuse.

If you have a specific provider you'd like to integrate, feel free to create an issue or pull request with your proposed changes on our GitHub repository. Your contributions are welcome!

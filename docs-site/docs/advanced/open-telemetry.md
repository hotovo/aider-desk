---
title: "OpenTelemetry"
sidebar_label: "OpenTelemetry"
---

# OpenTelemetry Integration Guide

AiderDesk leverages OpenTelemetry to provide detailed tracing and telemetry for Agent and Aider messages, allowing users to gain deeper insights into their AI interactions. The system supports multiple tracing backends and is designed to be extensible to other OpenTelemetry-compatible providers.

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

## PostHog Setup

[PostHog](https://posthog.com/) is an open source product analytics platform with LLM analytics capabilities. With the PostHog integration, you can track LLM usage alongside your product analytics to understand how AI features impact user behavior.

To integrate AiderDesk with PostHog, you need to provide your PostHog API key and optionally a host URL. These can be set as environment variables in two ways:

### 1. System-wide Environment Variables

You can set the following environment variables in your operating system. This method makes the keys available globally to all applications running on your system.

-   `POSTHOG_API_KEY`: Your PostHog project API key.
-   `POSTHOG_HOST`: The URL of your PostHog instance (defaults to `https://us.i.posthog.com`; use `https://eu.i.posthog.com` for EU).

**Example (Linux/macOS - add to `~/.bashrc`, `~/.zshrc`, or `~/.profile`):**

```bash
export POSTHOG_API_KEY="phc_YOUR_API_KEY"
export POSTHOG_HOST="https://us.i.posthog.com"
```

**Example (Windows - via System Properties or PowerShell):**

```powershell
$env:POSTHOG_API_KEY="phc_YOUR_API_KEY"
$env:POSTHOG_HOST="https://us.i.posthog.com"
```

Remember to restart AiderDesk (and your terminal if setting system-wide) after setting these variables for them to take effect.

### 2. Project-specific `.env` file

For more granular control, you can create a `.env` file in the root directory of your AiderDesk project. This method ensures that the environment variables are only applied to that specific project.

Create a file named `.env` in your project's root directory with the following content:

```
POSTHOG_API_KEY="phc_YOUR_API_KEY"
POSTHOG_HOST="https://us.i.posthog.com"
```

AiderDesk will automatically detect and load these variables when the project is opened.

### Obtaining PostHog API Key

To get your PostHog API key, you can [self-host PostHog](https://posthog.com/docs/self-host) or sign up for PostHog Cloud [here](https://us.posthog.com/signup). Find your project API key in Project Settings.

## Extending Telemetry

AiderDesk's telemetry system is built on OpenTelemetry, which is a vendor-neutral observability framework. This means there is ample room for implementing support for other OpenTelemetry-compatible tracing providers beyond Langfuse and PostHog.

If you have a specific provider you'd like to integrate, feel free to create an issue or pull request with your proposed changes on our GitHub repository. Your contributions are welcome!

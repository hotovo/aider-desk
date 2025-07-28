---
sidebar_position: 2
title: "Aider Configuration"
sidebar_label: "Aider Configuration"
---

# Aider Configuration

AiderDesk offers several ways to configure the underlying Aider engine, providing flexibility for advanced users. Configuration is loaded with the following priority (from highest to lowest):

1.  Settings configured in the AiderDesk UI.
2.  Command-line options specified in AiderDesk settings.
3.  Variables in a `.env` file in your project directory.
4.  Settings in a `.aider.conf.yml` file in your project directory.
5.  Variables in a `.env` file in your home directory.
6.  Settings in a `.aider.conf.yml` file in your home directory.
7.  System environment variables.

### Aider Options

You can pass command-line arguments directly to the Aider process.

1.  Go to **Settings > Aider**.
2.  In the **Options** section, enter any valid `aider-chat` command-line flags (e.g., `--no-auto-commits`, `--map-tokens 8192`).

Refer to the [official Aider documentation](https://aider.chat/docs/config/options.html) for a complete list of available options.

### Environment Variables

You can set environment variables for the Aider process, which is useful for configuring API keys and other secrets without hardcoding them.

1.  Go to **Settings > Aider**.
2.  In the **Environment Variables** section, add your variables in the `.env` format (e.g., `OPENAI_API_KEY=your-key-here`).
3.  You can show or hide the content of this field by clicking the "Show Secrets" button.

### `.aider.conf.yml`

AiderDesk respects the standard `.aider.conf.yml` file. You can place this file in your project's root directory or your home directory to define project-specific or global settings for Aider.

**Example `.aider.conf.yml`:**
```yaml
model: openai/gpt-4.1
weak-model: openai/gpt-4o-mini
edit-format: diff
auto-commits: false

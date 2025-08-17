---
sidebar_position: 1
title: "Onboarding Process"
sidebar_label: "Onboarding"
slug: "/getting-started/onboarding"
---

# Onboarding Process

Welcome to AiderDesk! The first time you launch the application, you will be guided through a simple onboarding process to get everything set up for AI-powered development.

## Step 1: Welcome & Language Selection

The first screen welcomes you to AiderDesk and provides a brief overview of its key features. In the top-right corner, you can select your preferred language for the application interface.

## Step 2: Connect Your AI Model

AiderDesk supports a wide range of Large Language Model (LLM) providers. In this step, you need to configure at least one provider to proceed.

1.  **Select a Provider**: Click on a provider card (e.g., Anthropic, OpenAI, Gemini).
2.  **Enter API Key**: In the expanded view, enter your API key for the selected provider. Your keys are stored securely on your local machine and are never sent to any third-party servers other than the provider's own API endpoints.
3.  **Configure Additional Settings**: Some providers have extra settings you can configure, such as a custom Base URL for self-hosted models.

If you prefer to use environment variables (`.env` or `.aider.conf.yml`), you can skip this step and configure them in the next step.

## Step 3: Fine-Tune Aider

This step allows you to configure the core `aider-chat` engine. While optional, it's a good place for advanced users to set up their environment.

- **Environment Variables**: Add your API keys (e.g., `OPENAI_API_KEY=...`) and other environment variables here. This is an alternative to configuring them in the "Providers" step.
- **Aider Options**: Pass any default command-line flags you want to use with Aider (e.g., `--no-auto-commits`).

Most users can safely skip this step and adjust these settings later in **Settings > Aider**.

## Step 4: Meet Your AI Agent

This screen introduces you to the powerful **Agent Mode**. The agent can autonomously plan and execute complex tasks. You have two options here:
1.  **Configure Agent**: Proceed to the next step to customize your default agent profile.
2.  **Finish Setup**: Skip the detailed agent configuration for now and complete the onboarding. You can always configure the agent later in **Settings > Agent**.

## Step 5: Configure Your Agent (Optional)

If you chose to configure the agent, this screen allows you to customize the default agent profile. You can set:
- The default LLM provider and model for the agent.
- Tool permissions and enabled MCP servers.
- Context preferences (e.g., whether to include the repository map).
- Custom instructions to guide the agent's behavior.

## Step 6: Finish

Congratulations! Your setup is complete. Click "Finish Setup" to be taken to the main application window, where you can open your first project and start coding.

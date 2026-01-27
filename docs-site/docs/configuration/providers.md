---
title: "Providers Configuration"
sidebar_label: "Providers"
---

# Providers Configuration

AiderDesk supports multiple Large Language Model (LLM) providers to power your AI coding assistant. You can configure these providers in the **Model Library** (accessible via the top bar icon). Each provider has specific configuration requirements, and most support environment variables for secure credential management.

## Table of Contents

- [Anthropic](#anthropic)
- [OpenAI](#openai)
- [Azure](#azure)
- [Gemini](#gemini)
- [Vertex AI](#vertex-ai)
- [Deepseek](#deepseek)
- [GPUStack](#gpustack)
- [Groq](#groq)
- [Bedrock](#bedrock)
- [Claude Agent SDK](#claude-agent-sdk)
- [OpenAI Compatible](#openai-compatible)
- [Ollama](#ollama)
- [LM Studio](#lm-studio)
- [OpenRouter](#openrouter)
- [Requesty](#requesty)

---

## Anthropic

Anthropic provides powerful AI models like Claude that excel at coding and reasoning tasks.

### Configuration Parameters

- **API Key**: Your Anthropic API key for authentication
  - Environment variable: `ANTHROPIC_API_KEY`
  - Get your API key from [Anthropic Console](https://console.anthropic.com/settings/keys)

### Setup

1. Go to [Anthropic Console](https://console.anthropic.com/settings/keys)
2. Create a new API key
3. Enter the API key in the Model Library Anthropic configuration
4. Or set the `ANTHROPIC_API_KEY` environment variable

---

## Azure

Azure OpenAI provides enterprise-grade AI models with enhanced security, compliance, and regional deployment options.

### Configuration Parameters

- **API Key**: Your Azure OpenAI API key for authentication
  - Environment variable: `AZURE_API_KEY`
  - Get your API key from [Azure Portal](https://portal.azure.com)
- **Resource Name**: Your Azure OpenAI resource name
  - Environment variable: `AZURE_RESOURCE_NAME`
  - Found in your Azure OpenAI resource overview page
- **API Version**: The API version to use
  - Environment variable: `AZURE_API_VERSION`
- **Reasoning Effort**: Control the level of reasoning for supported reasoning models
  - **None**: No reasoning (default)
  - **Minimal**: Minimal reasoning, faster responses
  - **Low**: Low reasoning, balanced speed
  - **Medium**: Balanced reasoning and speed
  - **High**: Maximum reasoning, more thorough but slower

### Setup

1. Go to [Azure Portal](https://portal.azure.com) and create an Azure OpenAI resource
2. Navigate to your resource and find the **Keys and Endpoint** section
3. Copy your API key and resource name
4. Enter the API key, resource name, and optionally API version in the Model Library Azure configuration
5. Or set the appropriate environment variables

### Important Notes

- **Custom Models Required**: Azure models are not automatically discovered. You need to add custom models manually through the [Model Library](../features/model-library.md)
- **Resource Name Format**: Use only the resource name (e.g., `my-openai-resource`), not the full endpoint URL
- **Regional Deployment**: Models are deployed to specific Azure regions, ensure your resource is in the desired region
- **Reasoning Models**: For reasoning models (like o1-series), you must configure the reasoning effort in the Model Library:
  1. Go to **Model Library** → **Models** tab
  2. Select your Azure reasoning model
  3. Expand **Provider Overrides** section
  4. Set **Reasoning Effort** to something other than **None**
  5. This fixes the error: `Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.`

---

## OpenAI

OpenAI provides advanced language models including GPT-4 series with enhanced reasoning capabilities.

### Configuration Parameters

- **API Key**: Your OpenAI API key for authentication
  - Environment variable: `OPENAI_API_KEY`
  - Get your API key from [OpenAI API Keys](https://platform.openai.com/api-keys)
- **Reasoning Effort**: Control the level of reasoning for supported models
  - **Low**: Minimal reasoning, faster responses
  - **Medium**: Balanced reasoning and speed (default)
  - **High**: Maximum reasoning, more thorough but slower

### Setup

1. Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Create a new API key
3. Enter the API key in the Model Library OpenAI configuration
4. Configure the Reasoning Effort based on your needs
5. Or set the `OPENAI_API_KEY` environment variable

---

## Gemini

Google's Gemini models offer versatile AI capabilities with advanced features like thinking budgets and search grounding.

### Configuration Parameters

- **API Key**: Your Gemini API key for authentication
  - Environment variable: `GEMINI_API_KEY`
  - Get your API key from [Google AI Studio](https://ai.google.dev)
- **Custom Base URL**: Optional custom endpoint URL
  - Environment variable: `GEMINI_API_BASE_URL`
- **Thinking Budget**: Maximum tokens for internal reasoning (0-24576)
- **Include Thoughts**: Enable to see the model's internal reasoning process
- **Use Search Grounding**: Enable to allow the model to use Google Search for factual grounding

### Setup

1. Go to [Google AI Studio](https://ai.google.dev)
2. Create a new API key
3. Enter the API key in the Model Library Gemini configuration
4. Configure optional parameters based on your needs
5. Or set appropriate environment variables

---

## GPUStack

GPUStack is an OpenAI-compatible GPU inference platform that provides optimized performance for running large language models on local or remote GPU infrastructure.

### Configuration Parameters

- **Base URL**: Your GPUStack server URL
  - Environment variable: `GPUSTACK_API_BASE`
  - Example: `http://localhost:8000` (default GPUStack installation)
- **API Key**: Optional GPUStack API key for authentication
  - Environment variable: `GPUSTACK_API_KEY`
  - Get your API key from your GPUStack server administration panel

### Setup

1. Install and configure GPUStack on your server or local machine
2. Access your GPUStack administration panel
3. (Optional) Create an API key for your application
4. Enter the base URL and optional API key in the Model Library GPUStack configuration
5. Or set the `GPUSTACK_API_BASE` and `GPUSTACK_API_KEY` environment variables

### Advanced Features

- **Model Discovery**: Automatically discovers available models from your GPUStack instance
- **Context Length Detection**: Automatically extracts maximum context length from model metadata
- **OpenAI Compatibility**: Uses the OpenAI-compatible `/v1-openai` API endpoint

### Important Notes

- **OpenAI Compatible**: GPUStack uses the OpenAI API format, ensuring compatibility with existing tools
- **Performance Optimization**: Optimized for GPU inference with automatic batching and quantization
- **Local Deployment**: Can be deployed on-premises for data privacy and security
- **Model Support**: Supports a wide range of open-source models like Llama, Mistral, and more

---

## Vertex AI

Google Cloud's Vertex AI provides enterprise-grade AI models with advanced configuration options.

### Configuration Parameters

- **Project**: Your Google Cloud project ID
- **Location**: The region/zone where your Vertex AI resources are located
- **Google Cloud Credentials JSON**: Service account credentials in JSON format
- **Thinking Budget**: Maximum tokens for internal reasoning (0-24576)
- **Include Thoughts**: Enable to see the model's internal reasoning process

### Setup

1. Create a Google Cloud project if you don't have one
2. Enable the Vertex AI API
3. Create a service account with Vertex AI permissions
4. Download the service account credentials JSON
5. Enter the project ID, location, and credentials in the Model Library Vertex AI configuration
6. Configure thinking budget and thoughts inclusion as needed

---

## Deepseek

Deepseek provides powerful AI models optimized for coding and technical tasks.

### Configuration Parameters

- **API Key**: Your Deepseek API key for authentication
  - Environment variable: `DEEPSEEK_API_KEY`
  - Get your API key from [Deepseek Platform](https://platform.deepseek.com/api_keys)

### Setup

1. Go to [Deepseek Platform](https://platform.deepseek.com/api_keys)
2. Create a new API key
3. Enter the API key in the Model Library Deepseek configuration
4. Or set the `DEEPSEEK_API_KEY` environment variable

---

## Groq

Groq offers ultra-fast inference with specialized hardware acceleration.

### Configuration Parameters

- **API Key**: Your Groq API key for authentication
  - Environment variable: `GROQ_API_KEY`
  - Get your API key from [Groq Console](https://console.groq.com/)
- **Models**: List of available models to use (comma-separated)

### Setup

1. Go to [Groq Console](https://console.groq.com)
2. Create a new API key
3. Enter the API key in the Model Library Groq configuration
4. Add the models you want to use (e.g., `llama3-70b-8192`, `mixtral-8x7b-32768`)
5. Or set the `GROQ_API_KEY` environment variable

---

## Bedrock

Amazon Bedrock provides access to foundation models from leading AI companies through AWS.

### Configuration Parameters

- **Region**: AWS region where Bedrock is available
  - Environment variable: `AWS_REGION`
  - Default: `us-east-1`
- **Access Key ID**: Your AWS access key ID
  - Environment variable: `AWS_ACCESS_KEY_ID`
- **Secret Access Key**: Your AWS secret access key
  - Environment variable: `AWS_SECRET_ACCESS_KEY`
- **Session Token**: Optional temporary session token
  - Environment variable: `AWS_SESSION_TOKEN`

### Setup

1. Ensure you have an AWS account with appropriate permissions
2. Enable Bedrock in your desired AWS region
3. Create an IAM user with Bedrock access permissions
4. Enter the AWS credentials in the Model Library Bedrock configuration
5. Or set the appropriate AWS environment variables

---

## Claude Agent SDK

Claude Agent SDK is a specialized provider for users with Claude Code Pro or Max subscriptions. It uses the Claude Code CLI for authentication and is powered by [ai-sdk-provider-claude-code](https://github.com/ben-vargas/ai-sdk-provider-claude-code).

### Configuration Parameters

- **No API Key Required**: Authentication is handled through the Claude Code CLI
- **No Additional Configuration**: The provider works once the CLI is authenticated

### Prerequisites

- **Claude Code Subscription**: Active Claude Code Pro or Max subscription required
- **Claude Code CLI**: Must be installed from [Claude Code](https://claude.com/product/claude-code)
- **Authentication**: Run `claude login` before using the provider
- **No Environment Variables**: No environment variable configuration needed

### Available Models

- **haiku**: 200K input tokens, 64K output tokens
- **sonnet**: 200K input tokens, 64K output tokens (default)
- **opus**: 200K input tokens, 64K output tokens

### Setup

1. Ensure you have an active Claude Code Pro or Max subscription
2. Install the Claude Code CLI from [https://claude.com/product/claude-code](https://claude.com/product/claude-code)
3. Run `claude login` in your terminal to authenticate
4. Add the Claude Agent SDK provider in AiderDesk's Model Library
5. Select one of the available models (haiku, sonnet, or opus)

### Mode Support

This provider **only works in Agent mode**:

- ✅ **Agent Mode**: Fully supported
- ❌ **Code Mode**: Not supported
- ❌ **Ask Mode**: Not supported
- ❌ **Architect Mode**: Not supported
- ❌ **Context Mode**: Not supported
- ❌ **Aider Integration**: Cannot be used with Aider

### Cost Tracking

- **Subscription-based pricing**: No per-message costs
- **Cost tracking**: Shows per-agent-turn costs (not per-message)
- Costs are tracked for the entire agent conversation turn

### Important Notes

- **CLI Required**: Claude Code CLI must be installed and authenticated before use
- **Agent Mode Only**: This provider exclusively works in Agent mode
- **Model Prefix**: Use `claude-agent-sdk/` prefix when specifying models
- **Tool Usage**: This provider relies on tools from AiderDesk and does not use Claude Code's internal tools. Tools are executed within the AiderDesk environment.
- **Provider Switching**: 
  - ✅ Switching FROM Claude Agent SDK to another provider works fine
  - ⚠️ Switching FROM another provider TO Claude Agent SDK during an active conversation might not fully work as expected and is not a recommended workflow

### Limitations

- **Message Editing**: Redo user message, Edit last user message, and Delete message actions do not work as expected because the provider does not support session modification
- **Token Usage Tracking**: Currently, it's not possible to properly track the model's token usage

### Troubleshooting

**Provider Not Available**:
1. Verify Claude Code CLI is installed and available in your system PATH
2. Run `claude login` to authenticate if you haven't already
3. Confirm you have an active Claude Code Pro or Max subscription

**Authentication Fails**:
1. Run `claude login` again to re-authenticate
2. Check that your Claude Code subscription is active
3. Verify the CLI version is up to date

**Mode Compatibility**:
- Remember: This provider only works in Agent mode
- If you need Code/Ask/Architect modes, use the standard Anthropic provider instead

---

## OpenAI Compatible

Configure any OpenAI-compatible API endpoint to use custom models or self-hosted solutions.

### Configuration Parameters

- **Base URL**: The API endpoint URL
  - Environment variable: `OPENAI_API_BASE`
- **API Key**: Your API key for the compatible service
  - Environment variable: `OPENAI_API_KEY`
- **Models**: List of available models (comma-separated)

### Setup

1. Obtain the base URL and API key from your OpenAI-compatible service provider
2. Enter the base URL and API key in the Model Library OpenAI Compatible configuration
3. Or set the `OPENAI_API_BASE` and `OPENAI_API_KEY` environment variables
4. **Use `openai-compatible/` prefix** in the model selector

### Important Notes

- **Unified Prefix**: Both Agent and Aider modes use the same `openai-compatible/` prefix
- **Model Library**: Use the [Model Library](../features/model-library.md) for advanced configuration and custom model management
- **API Compatibility**: Configure all settings in the Model Library for unified experience across all modes

---

## Ollama

Ollama allows you to run open-source models locally on your machine.

### Configuration Parameters

- **Base URL**: Your Ollama server endpoint
  - Environment variable: `OLLAMA_API_BASE`
  - Default: `http://localhost:11434`

### Setup

1. Install and run Ollama on your local machine
2. Ensure Ollama is running and accessible
3. Enter the base URL in the Model Library Ollama configuration
4. Or set the `OLLAMA_API_BASE` environment variable

---

## LM Studio

LM Studio provides a user-friendly interface for running local language models.

### Configuration Parameters

- **Base URL**: Your LM Studio server endpoint
  - Environment variable: `LMSTUDIO_API_BASE`
  - Default: `http://localhost:1234`

### Setup

1. Install and run LM Studio on your local machine
2. Start a local server in LM Studio
3. Enter the base URL in the Model Library LM Studio configuration
4. Or set the `LMSTUDIO_API_BASE` environment variable

---

## OpenRouter

OpenRouter provides access to multiple models from various providers through a single API.

### Configuration Parameters

- **API Key**: Your OpenRouter API key for authentication
  - Environment variable: `OPENROUTER_API_KEY`
  - Get your API key from [OpenRouter Keys](https://openrouter.ai/keys)
- **Models**: List of models to use (auto-populated when API key is provided)
- **Advanced Settings**: Additional configuration options:
  - **Require Parameters**: Enforce parameter requirements
  - **Order**: Model preference order
  - **Only**: Restrict to specific models
  - **Ignore**: Exclude specific models
  - **Allow Fallbacks**: Enable model fallback
  - **Data Collection**: Allow or deny data collection
  - **Quantizations**: Preferred quantization levels
  - **Sort**: Sort models by price or throughput

### Setup

1. Go to [OpenRouter Keys](https://openrouter.ai/keys)
2. Create a new API key
3. Enter the API key in the Model Library OpenRouter configuration
4. Select your preferred models from the auto-populated list
5. Configure advanced settings as needed
6. Or set the `OPENROUTER_API_KEY` environment variable

---

## Requesty

Requesty provides optimized model routing and caching for improved performance and cost efficiency.

### Configuration Parameters

- **API Key**: Your Requesty API key for authentication
  - Environment variable: `REQUESTY_API_KEY`
  - Get your API key from [Requesty API Keys](https://app.requesty.ai/api-keys)
- **Models**: List of available models (auto-populated when API key is provided)
- **Auto Cache**: Enable automatic response caching for improved performance
- **Reasoning Effort**: Control the level of reasoning for supported models
  - **None**: No reasoning
  - **Low**: Minimal reasoning
  - **Medium**: Balanced reasoning
  - **High**: Enhanced reasoning
  - **Max**: Maximum reasoning

### Setup

1. Go to [Requesty API Keys](https://app.requesty.ai/api-keys)
2. Create a new API key
3. Enter the API key in the Model Library Requesty configuration
4. Select your preferred models from the auto-populated list
5. Configure auto cache and reasoning effort as needed
6. Or set the `REQUESTY_API_KEY` environment variable
7. **Use `requesty/` prefix** in the model selector

### Important Notes

- **Unified Prefix**: Both Agent and Aider modes use the same `requesty/` prefix
- **Model Library**: Use the [Model Library](../features/model-library.md) for advanced configuration and custom model management
- **API Compatibility**: Configure all settings in the Providers section for unified experience across all modes

---

## Model Library Integration

The **Model Library** provides advanced provider and model management capabilities beyond basic provider configuration:

- **Multiple Profiles**: Create multiple profiles for the same provider (e.g., work and personal OpenAI accounts)
- **Custom Models**: Add custom models that aren't automatically discovered (e.g., Azure models)
- **Cost Configuration**: Set custom pricing and token limits for models
- **Model Management**: Hide irrelevant models, organize by provider profiles
- **Advanced Configuration**: Configure multiple OpenAI-compatible providers with different prefixes

For comprehensive provider and model management, see [Model Library](../features/model-library.md).

## Unified Model Prefix System

AiderDesk now uses a unified model prefix system across all modes (Agent, Code, Ask, Architect, Context):

| Provider | Model Prefix |
|----------|--------------|
| Anthropic | `anthropic/` |
| OpenAI | `openai/` |
| Azure | `azure/` |
| Gemini | `gemini/` |
| Vertex AI | `vertex_ai/` |
| Deepseek | `deepseek/` |
| GPUStack | `openai/` |
| Groq | `groq/` |
| Bedrock | `bedrock/` |
| Claude Agent SDK | `claude-agent-sdk/` |
| OpenAI Compatible | `openai-compatible/` |
| OpenCode ZEN | `opencode/` |
| Ollama | `ollama/` |
| LM Studio | `lmstudio/` |
| OpenRouter | `openrouter/` |
| Requesty | `requesty/` |

### Important Notes

- **Unified Configuration**: Configure all providers in the **Model Library** for consistent behavior across all modes
- **Model Selection**: Use the same model prefix regardless of the mode you're using
- **Environment Variables**: Environment variables are supported as fallbacks but primary configuration is through the Model Library
- **Model Library**: For advanced management of multiple profiles and custom models, use the Model Library

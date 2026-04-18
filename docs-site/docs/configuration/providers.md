---
title: "Providers Configuration"
sidebar_label: "Providers"
---

# Providers Configuration

AiderDesk supports multiple Large Language Model (LLM) providers to power your AI coding assistant. You can configure these providers in the **Model Library** (accessible via the top bar icon). Each provider has specific configuration requirements, and most support environment variables for secure credential management.

## Table of Contents

- [Alibaba Plan](#alibaba-plan)
- [Anthropic](#anthropic)
- [Anthropic Compatible](#anthropic-compatible)
- [Auggie](#auggie)
- [Azure](#azure)
- [Bedrock](#bedrock)
- [Cerebras](#cerebras)
- [Claude Agent SDK](#claude-agent-sdk)
- [Deepseek](#deepseek)
- [Gemini](#gemini)
- [Gemini CLI](#gemini-cli)
- [GPUStack](#gpustack)
- [Groq](#groq)
- [Kimi Plan](#kimi-plan)
- [LiteLLM](#litellm)
- [LM Studio](#lm-studio)
- [Minimax](#minimax)
- [Mistral](#mistral)
- [Ollama](#ollama)
- [OpenAI](#openai)
- [OpenAI Compatible](#openai-compatible)
- [OpenCode](#opencode)
- [OpenRouter](#openrouter)
- [Requesty](#requesty)
- [Synthetic](#synthetic)
- [Vertex AI](#vertex-ai)
- [ZAI Plan](#zai-plan)

---

## Alibaba Plan

Alibaba Plan provides access to models from Alibaba's coding-focused plan, including Qwen and other partner models via an OpenAI-compatible API.

### Configuration Parameters

- **API Key**: Your Alibaba Plan API key for authentication
  - Environment variable: `ALIBABA_PLAN_API_KEY`
- **Models**: Hardcoded list of available models (e.g., `qwen3.5-plus`, `qwen3-coder-plus`, `MiniMax-M2.5`, `glm-5`, `kimi-k2.5`)

### Setup

1. Obtain your API key from your Alibaba Plan subscription
2. Enter the API key in the Model Library Alibaba Plan configuration
3. Or set the `ALIBABA_PLAN_API_KEY` environment variable

### Important Notes

- **Thinking Support**: Supports extended thinking with configurable budget
- **Aider Prefix**: Uses `openai/` prefix for Aider mode

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

## Anthropic Compatible

Use any Anthropic-compatible API endpoint (e.g., third-party proxies, self-hosted solutions) with the standard Anthropic SDK.

### Configuration Parameters

- **API Key**: Your API key for authentication
  - Environment variable: `ANTHROPIC_API_KEY`
- **Base URL**: The base URL of the Anthropic-compatible API endpoint
  - Environment variable: `ANTHROPIC_API_BASE`

### Setup

1. Enter the API key and base URL in the Model Library Anthropic Compatible configuration
2. Or set the `ANTHROPIC_API_KEY` and `ANTHROPIC_API_BASE` environment variables

### Important Notes

- **Model Discovery**: Models are auto-discovered from the `/v1/models` endpoint
- **Aider Prefix**: Uses `anthropic/` prefix for Aider mode

---

## Auggie

Auggie provides access to models through the Augment platform, supporting Claude and GPT models via the Auggie SDK.

### Configuration Parameters

- **API Key**: Your Augment API token for authentication
  - Environment variable: `AUGMENT_API_TOKEN`
- **API URL**: The Augment API URL endpoint
  - Environment variable: `AUGMENT_API_URL`

### Setup

1. Install the Auggie CLI (`auggie`) and authenticate, or provide API token and URL manually
2. Enter the API key and API URL in the Model Library Auggie configuration
3. Or set the `AUGMENT_API_TOKEN` and `AUGMENT_API_URL` environment variables

### Important Notes

- **Auto-Discovery**: If no API key is provided, Auggie will attempt to use the local CLI session (`~/.augment/session.json`)
- **Available Models**: Includes Claude and GPT model variants (e.g., `claude-sonnet-4-5`, `gpt-5-1`)
- **Aider Prefix**: Uses `auggie/` prefix for Aider mode

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

## Gemini CLI

Gemini CLI uses the locally installed Gemini CLI tool for authentication, providing free access to Gemini models via your Google account.

### Configuration Parameters

- **Project ID**: Optional Google Cloud project ID (required for organization/enterprise accounts)

### Setup

1. Install the [Gemini CLI](https://github.com/google-gemini/gemini-cli)
2. Authenticate with your Google account (`gemini` command will prompt you)
3. Models are automatically available in AiderDesk when the Gemini CLI is detected in your PATH

### Important Notes

- **No API Key Required**: Authentication is handled by the Gemini CLI via OAuth
- **Auto-Detection**: AiderDesk automatically detects the Gemini CLI installation
- **Available Models**: Includes Gemini 2.5 and 3.x variants (e.g., `gemini-2.5-pro`, `gemini-3.1-pro-preview`)

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

## Kimi Plan

Kimi Plan provides access to Kimi's coding models through an Anthropic-compatible API.

### Configuration Parameters

- **API Key**: Your Kimi Plan API key for authentication
  - Environment variable: `KIMI_PLAN_API_KEY`

### Setup

1. Obtain your API key from your Kimi Plan subscription
2. Enter the API key in the Model Library Kimi Plan configuration
3. Or set the `KIMI_PLAN_API_KEY` environment variable

### Important Notes

- **Anthropic-Compatible**: Uses the Anthropic SDK with Kimi's endpoint
- **Available Models**: Includes `k2p5` model
- **Aider Prefix**: Uses `anthropic/` prefix for Aider mode

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

## Cerebras

Cerebras provides ultra-fast inference using purpose-built wafer-scale AI processors.

### Configuration Parameters

- **API Key**: Your Cerebras API key for authentication
  - Environment variable: `CEREBRAS_API_KEY`
  - Get your API key from [Cerebras Cloud](https://cloud.cerebras.ai/)
- **Models**: List of available models (auto-populated when API key is provided)

### Setup

1. Go to [Cerebras Cloud](https://cloud.cerebras.ai/)
2. Create a new API key
3. Enter the API key in the Model Library Cerebras configuration
4. Or set the `CEREBRAS_API_KEY` environment variable

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

## OpenCode

OpenCode ZEN provides access to multiple provider models (OpenAI, Anthropic, Gemini, and more) through a single unified endpoint.

### Configuration Parameters

- **API Key**: Your OpenCode API key for authentication
  - Environment variable: `OPENCODE_API_KEY`

### Setup

1. Get your API key from [OpenCode](https://opencode.ai/)
2. Enter the API key in the Model Library OpenCode configuration
3. Or set the `OPENCODE_API_KEY` environment variable

### Important Notes

- **Multi-Provider**: Automatically routes to the correct SDK (OpenAI, Anthropic, Gemini) based on model name
- **Available Models**: Includes models from multiple providers (e.g., `gpt-5`, `claude-sonnet-4-5`, `gemini-2.5-pro`)
- **Aider Prefix**: Uses `openai/` prefix for Aider mode

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

## LiteLLM

LiteLLM provides a unified API proxy that translates requests to over 100+ LLM providers using a consistent OpenAI-compatible interface.

### Configuration Parameters

- **API Key**: Your LiteLLM API key for authentication (optional, depends on your setup)
  - Environment variable: `LITELLM_API_KEY`
- **Base URL**: Your LiteLLM proxy server endpoint (required)
  - Environment variable: `LITELLM_API_BASE`

### Setup

1. Set up your [LiteLLM Proxy Server](https://docs.litellm.ai/docs/proxy)
2. Enter the base URL of your LiteLLM proxy in the Model Library LiteLLM configuration
3. Optionally enter the API key if your proxy requires authentication
4. Or set the `LITELLM_API_BASE` and `LITELLM_API_KEY` environment variables

### Important Notes

- **Model Discovery**: Models are loaded from the `/model/info` endpoint
- **Cost Tracking**: LiteLLM provides pricing info per model when configured in the proxy
- **Load Balancing**: Supports multiple backends per model name (uses the most conservative limits)

---

## Minimax

Minimax provides AI models with Anthropic-compatible API support, including caching capabilities for cost optimization.

### Configuration Parameters

- **API Key**: Your Minimax API key for authentication
  - Environment variable: `MINIMAX_API_KEY`

### Setup

1. Obtain your API key from [Minimax](https://platform.minimaxi.com/)
2. Enter the API key in the Model Library Minimax configuration
3. Or set the `MINIMAX_API_KEY` environment variable

### Important Notes

- **Anthropic-Compatible**: Uses the Anthropic SDK with Minimax's endpoint
- **Available Models**: Includes `MiniMax-M2` and `MiniMax-M2-Stable`
- **Cache Support**: Supports prompt caching for cost optimization
- **Aider Prefix**: Uses `openai/` prefix for Aider mode

---

## Mistral

Mistral AI provides powerful open and commercial models optimized for a variety of tasks including coding, reasoning, and multilingual support.

### Configuration Parameters

- **API Key**: Your Mistral API key for authentication
  - Environment variable: `MISTRAL_API_KEY`
  - Get your API key from [Mistral Platform](https://console.mistral.ai/api-keys)
- **Models**: List of available models (auto-populated when API key is provided)

### Setup

1. Go to [Mistral Platform](https://console.mistral.ai/api-keys)
2. Create a new API key
3. Enter the API key in the Model Library Mistral configuration
4. Select your preferred models from the auto-populated list
5. Or set the `MISTRAL_API_KEY` environment variable

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

## Synthetic

Synthetic provides AI models through an OpenAI-compatible API endpoint.

### Configuration Parameters

- **API Key**: Your Synthetic API key for authentication
  - Environment variable: `SYNTHETIC_API_KEY`

### Setup

1. Get your API key from [Synthetic](https://synthetic.new/)
2. Enter the API key in the Model Library Synthetic configuration
3. Or set the `SYNTHETIC_API_KEY` environment variable

### Important Notes

- **OpenAI-Compatible**: Uses the OpenAI-compatible SDK
- **Aider Prefix**: Uses `openai/` prefix for Aider mode

---

## ZAI Plan

ZAI Plan provides access to ZAI's coding models with thinking support through an OpenAI-compatible API.

### Configuration Parameters

- **API Key**: Your ZAI API key for authentication
  - Environment variable: `ZAI_API_KEY`

### Setup

1. Obtain your API key from your ZAI Plan subscription
2. Enter the API key in the Model Library ZAI Plan configuration
3. Or set the `ZAI_API_KEY` environment variable

### Important Notes

- **Thinking Support**: Supports extended thinking (enabled by default, can be disabled per model)
- **Aider Prefix**: Uses `openai/` prefix for Aider mode

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
| Alibaba Plan | `openai/` |
| Anthropic | `anthropic/` |
| Anthropic Compatible | `anthropic/` |
| Auggie | `auggie/` |
| OpenAI | `openai/` |
| Azure | `azure/` |
| Bedrock | `bedrock/` |
| Cerebras | `cerebras/` |
| Claude Agent SDK | `claude-agent-sdk/` |
| Deepseek | `deepseek/` |
| Gemini | `gemini/` |
| Gemini CLI | `gemini-cli/` |
| GPUStack | `openai/` |
| Groq | `groq/` |
| Kimi Plan | `anthropic/` |
| LiteLLM | `litellm/` |
| LM Studio | `lmstudio/` |
| Minimax | `openai/` |
| Mistral | `mistral/` |
| Ollama | `ollama/` |
| OpenAI Compatible | `openai-compatible/` |
| OpenCode ZEN | `opencode/` |
| OpenRouter | `openrouter/` |
| Requesty | `requesty/` |
| Synthetic | `openai/` |
| Vertex AI | `vertex_ai/` |
| ZAI Plan | `openai/` |

### Important Notes

- **Unified Configuration**: Configure all providers in the **Model Library** for consistent behavior across all modes
- **Model Selection**: Use the same model prefix regardless of the mode you're using
- **Environment Variables**: Environment variables are supported as fallbacks but primary configuration is through the Model Library
- **Model Library**: For advanced management of multiple profiles and custom models, use the Model Library

---
sidebar_position: 2
title: "Providers Configuration"
sidebar_label: "Providers"
---

# Providers Configuration

AiderDesk supports multiple Large Language Model (LLM) providers to power your AI coding assistant. You can configure these providers in the **Settings → Providers** tab. Each provider has specific configuration requirements, and most support environment variables for secure credential management.

## Table of Contents

- [Anthropic](#anthropic)
- [OpenAI](#openai)
- [Gemini](#gemini)
- [Vertex AI](#vertex-ai)
- [Deepseek](#deepseek)
- [Groq](#groq)
- [Bedrock](#bedrock)
- [OpenAI Compatible](#openai-compatible)
- [Ollama](#ollama)
- [LM Studio](#lm-studio)
- [OpenRouter](#openrouter)
- [Requesty](#requesty)
- [Special Configuration for Aider Modes](#special-configuration-for-aider-modes)

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
3. Enter the API key in the Settings → Providers → Anthropic section
4. Or set the `ANTHROPIC_API_KEY` environment variable

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
3. Enter the API key in the Settings → Providers → OpenAI section
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
3. Enter the API key in the Settings → Providers → Gemini section
4. Configure optional parameters based on your needs
5. Or set appropriate environment variables

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
5. Enter the project ID, location, and credentials in the Settings → Providers → Vertex AI section
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
3. Enter the API key in the Settings → Providers → Deepseek section
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
3. Enter the API key in the Settings → Providers → Groq section
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
4. Enter the AWS credentials in the Settings → Providers → Bedrock section
5. Or set the appropriate AWS environment variables

---

## OpenAI Compatible

Configure any OpenAI-compatible API endpoint to use custom models or self-hosted solutions.

### Configuration Parameters

- **Base URL**: The API endpoint URL
  - Environment variable: `OPENAI_API_BASE`
- **API Key**: Your API key for the compatible service
  - Environment variable: `OPENAI_API_KEY`
- **Models**: List of available models (comma-separated)

### Setup for Agent Mode

1. Obtain the base URL and API key from your OpenAI-compatible service provider
2. Enter the base URL, API key, and available models in the Settings → Providers → OpenAI Compatible section
3. Or set the `OPENAI_API_BASE` and `OPENAI_API_KEY` environment variables
4. **Use `openai-compatible/` prefix** in Agent mode model selector

### Setup for Aider Modes (Code, Ask, Architect, Context)

To use OpenAI Compatible providers in Aider modes, you need to configure environment variables:

1. **Set Environment Variables** in Settings → Aider → Environment Variables:
   ```
   OPENAI_API_BASE=[your_provider_base_url]
   OPENAI_API_KEY=[your_api_key]
   ```

2. **Use Model Prefix**: In the Aider model selector, use the `openai/` prefix:
   ```
   openai/gpt-4
   openai/claude-3-sonnet-20240229
   ```

### Important Notes

- **Agent Mode**: Use `openai-compatible/` prefix and configure in Providers section
- **Aider Modes**: Use `openai/` prefix and configure environment variables in Aider section
- **API Compatibility**: Aider treats all OpenAI-compatible providers as OpenAI, hence the `openai/` prefix in Aider modes

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
3. Enter the base URL in the Settings → Providers → Ollama section
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
3. Enter the base URL in the Settings → Providers → LM Studio section
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
3. Enter the API key in the Settings → Providers → OpenRouter section
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

### Setup for Agent Mode

1. Go to [Requesty API Keys](https://app.requesty.ai/api-keys)
2. Create a new API key
3. Enter the API key in the Settings → Providers → Requesty section
4. Select your preferred models from the auto-populated list
5. Configure auto cache and reasoning effort as needed
6. Or set the `REQUESTY_API_KEY` environment variable
7. **Use `requesty/` prefix** in Agent mode model selector

### Setup for Aider Modes (Code, Ask, Architect, Context)

To use Requesty models in Aider modes, you need to configure environment variables:

1. **Set Environment Variables** in Settings → Aider → Environment Variables:
   ```
   OPENAI_API_BASE=https://router.requesty.ai/v1
   OPENAI_API_KEY=[your_requesty_api_key]
   ```

2. **Use Model Prefix**: In the Aider model selector, use the `openai/` prefix:
   ```
   openai/anthropic/claude-3-sonnet-20240229
   openai/gpt-4-turbo
   ```

### Important Notes

- **Agent Mode**: Use `requesty/` prefix and configure in Providers section
- **Aider Modes**: Use `openai/` prefix and configure environment variables in Aider section
- **API Compatibility**: Requesty appears as OpenAI-compatible to Aider, hence the `openai/` prefix in Aider modes

---

### Agent Mode vs Aider Mode Prefix Differences

| Provider | Agent Mode Prefix | Aider Mode Prefix | Notes |
|----------|------------------|-------------------|-------|
| Requesty | `requesty/` | `openai/` | Requesty appears as OpenAI-compatible to Aider |
| OpenAI Compatible | `openai-compatible/` | `openai/` | Aider treats all compatible providers as OpenAI |
| All Others | `[provider_name]/` | `[provider_name]/` | Same prefix for both modes |

### Important Notes

- **Environment Variables**: Aider modes require environment variables to be set in **Settings → Aider → Environment Variables**, not in the Providers section
- **Model Selection**: Always use the correct prefix based on the mode you're using
- **API Compatibility**: Requesty and OpenAI Compatible providers appear as OpenAI to Aider, hence the `openai/` prefix in Aider modes
- **Configuration Location**: Agent mode uses the Providers configuration, while Aider modes use environment variables in the Aider configuration section

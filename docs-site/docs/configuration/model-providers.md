# Model Providers

AiderDesk supports a wide range of AI models from various providers. In the **Settings > Model Providers** section, you can manage your API keys and other credentials for each provider.

## Supported Providers

AiderDesk supports the following model providers:

-   OpenAI
-   Anthropic
-   Google
-   DeepSeek
-   Groq
-   OpenRouter
-   Amazon Bedrock

## Configuring API Keys

For each provider you want to use, you will need to enter your API key in the corresponding field. AiderDesk will securely store your API keys in the application's settings.

Alternatively, you can configure your API keys using environment variables. This is a good practice for security and for use in CI/CD environments. For more information, see the [Environment Variables](./../advanced-topics/environment-variables.md) page.

## Amazon Bedrock Configuration

To use models from Amazon Bedrock, you will need to configure your AWS credentials. AiderDesk uses the standard AWS SDK credential chain, so you can configure your credentials in any of the following ways:

-   **Environment Variables:** Set the `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_REGION` environment variables.
-   **Shared Credentials File:** Use a shared credentials file at `~/.aws/credentials`.
-   **IAM Instance Profile:** If you are running AiderDesk on an EC2 instance, you can use an IAM instance profile to automatically provide credentials.

You will also need to specify the AWS region where you want to use Bedrock.

By configuring your model providers, you can easily switch between different models and services, allowing you to choose the best tool for each task.

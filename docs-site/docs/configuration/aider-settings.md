# Aider Settings

In the **Settings > Aider** section, you can configure the behavior of the core `aider` engine that powers AiderDesk. These settings allow you to fine-tune how `aider` interacts with your code.

## Aider Model

This setting allows you to choose the default AI model that `aider` will use for its operations. This can be different from the model used by the autonomous agent. You can select any of the models that you have configured in the [Model Providers](./model-providers.md) section.

## Aider Options

This field allows you to specify additional command-line options to be passed to the `aider` process. This is an advanced feature that gives you access to the full range of `aider`'s capabilities.

For example, you could use this field to:

-   Specify a custom system prompt.
-   Enable or disable specific features of `aider`.
-   Configure the behavior of the diff viewer.

For a full list of available options, you can refer to the official `aider` documentation by running `aider --help` in your terminal.

## Environment Variables

This section allows you to define custom environment variables that will be passed to the `aider` process. This is useful for configuring `aider`'s behavior in ways that are not exposed through command-line options.

For example, you could use this to set an API key for a service that `aider` needs to access, or to configure the behavior of a plugin.

By customizing these settings, you can ensure that the `aider` engine is perfectly configured for your project and your personal workflow.

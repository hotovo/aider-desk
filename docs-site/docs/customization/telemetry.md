---
sidebar_position: 4
title: "Telemetry"
sidebar_label: "Telemetry"
---

# Telemetry in AiderDesk

AiderDesk collects anonymous telemetry data to help us understand how the application is used and to identify areas for improvement. This data is crucial for making informed decisions about future development, fixing bugs, and enhancing user experience.

## Anonymity and Privacy

All telemetry data collected is **anonymous**. We do not collect any personally identifiable information (PII). Your code, project details (beyond aggregated counts), or specific prompts are never transmitted. We respect your privacy and are committed to ensuring that your data remains secure and confidential. The `distinctId` used for telemetry is a randomly generated user ID stored locally and is not linked to any personal information.

You can always disable telemetry in **Settings -> About -> Telemetry** section.

## Collected Events and Properties

When telemetry is enabled, AiderDesk captures the following events:

*   **`identify`**: Sent when the telemetry service is initialized.
    *   `os`: The operating system (e.g., `darwin`, `win32`, `linux`).
    *   `version`: The version of the AiderDesk application.
*   **`telemetry-disabled`**: Sent when a user disables telemetry in settings.
*   **`project-opened`**: Sent when a project is opened.
    *   `count`: The total number of projects currently open.
*   **`project-closed`**: Sent when a project is closed.
    *   `count`: The total number of projects remaining open.
*   **`run-prompt`**: Sent when a prompt is run.
    *   `mode`: The mode in which the prompt was run (e.g., `code`, `ask`, `agent`...).
*   **`agent-run`**: Sent when an agent run is initiated.
    *   `maxIterations`: The maximum number of iterations configured for the agent.
    *   `maxTokens`: The maximum number of tokens configured for the agent.
    *   `customInstructionsDefined`: A boolean indicating whether custom instructions were provided.
    *   `useAiderTools`: A boolean indicating whether Aider tools were enabled.
    *   `usePowerTools`: A boolean indicating whether Power tools were enabled.
    *   `useTodoTools`: A boolean indicating whether Todo tools were enabled.
    *   `includeContextFiles`: A boolean indicating whether context files were included.
    *   `includeRepoMap`: A boolean indicating whether the repository map was included.
    *   `autoApprove`: A boolean indicating whether auto-approve was enabled.
    *   `enabledMcpServersCount`: The number of enabled MCP servers.
    *   `totalMcpServersCount`: The total number of configured MCP servers.
*   **`custom-command-run`**: Sent when a custom command is run.
    *   `commandName`: The name of the custom command.
    *   `argsCount`: The number of arguments provided to the command.

## Source Code Transparency

We believe in transparency. You can review the exact telemetry collection code in our open-source repository. The relevant file is [src/main/telemetry-manager.ts](https://github.com/hotovo/aider-desk/blob/main/src/main/telemetry-manager.ts).

## Agent and Aider Message Telemetry

Beyond the anonymous usage data, AiderDesk also supports collecting detailed telemetry for Agent and Aider messages. This allows users to gain deeper insights into their AI interactions, including token usage, costs, and model responses, by integrating with OpenTelemetry-compatible tracing systems.

For detailed setup instructions and information on supported providers, please refer to the [OpenTelemetry Integration Guide](open-telemetry).

---

Your contribution through anonymous telemetry helps us build a better AiderDesk for everyone. Thank you!

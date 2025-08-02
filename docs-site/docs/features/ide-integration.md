# IDE Integration

AiderDesk offers seamless integration with popular IDEs to help you manage the AI's context directly from your code editor. By connecting AiderDesk to your IDE, you can automatically add the file you are currently viewing to the AiderDesk context, saving you the effort of manually searching for it in the file tree.

## Supported IDEs

AiderDesk provides integration support for the following IDEs:

-   **Visual Studio Code:** Through the [Aider-Desk Connector extension](https://marketplace.visualstudio.com/items?itemName=hotovo-sk.aider-desk-connector) on the VS Marketplace.
-   **IntelliJ IDEA (and other JetBrains IDEs):** Through the [AiderDesk Connector plugin](https://plugins.jetbrains.com/plugin/26313-aiderdesk-connector) on the JetBrains Marketplace.

## How It Works

Once you install the appropriate extension or plugin for your IDE, it will automatically detect when AiderDesk is running. The integration works by monitoring the active file(s) in your editor.

When you open or switch to a file in your IDE, the connector will automatically:

1.  **Add the file to the context:** The file you are currently viewing will be added to the list of context files in AiderDesk.
2.  **Keep the context in sync:** If you close the file or switch to another one, the connector can be configured to either keep the file in the context or remove it.

This creates a smooth workflow where the AI's context is always aligned with the code you are focused on, without requiring any manual intervention.

## Setup Instructions

1.  **Install the AiderDesk application** and make sure it is running.
2.  **Install the appropriate connector** for your IDE from the marketplaces linked above.
3.  **Enable the integration:** In your IDE, you may need to enable the connector or configure its settings. Please refer to the documentation of the specific extension or plugin for detailed setup instructions.

Once set up, the connector will automatically find and connect to the running AiderDesk application, and you can start syncing your context files effortlessly.

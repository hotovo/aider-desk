# Custom Commands

Custom commands in AiderDesk allow you to define and execute your own scripts and actions, extending the capabilities of the application to fit your specific workflow. You can create commands that run shell scripts, execute Python code, or even interact with the AiderDesk chat.

## Creating a Custom Command

You can manage custom commands by going to **Settings > Custom Commands**. Here, you can create new commands, edit existing ones, and organize them into groups.

When you create a new command, you will need to configure the following:

-   **Name:** A unique name for your command.
-   **Description:** A brief description of what the command does. This will be shown as a tooltip in the UI.
-   **Type:** The type of command to execute. The available types are:
    -   **Shell Script:** Executes a shell script in your system's default shell.
    -   **Python Script:** Executes a Python script.
    -   **Send to Chat:** Sends a predefined message to the AiderDesk chat.

-   **Command/Script:** The actual script or command to be executed. You can use placeholders to insert dynamic values into your command.

## Using Placeholders

Placeholders allow you to make your custom commands more flexible by inserting information from the current project or application state. When the command is executed, AiderDesk will replace the placeholder with its current value.

Some of the available placeholders include:

-   `{{projectDir}}`: The absolute path to the current project's root directory.
-   `{{contextFiles}}`: A space-separated list of the files currently in the context.
-   `{{selectedText}}`: The text that is currently selected in the chat or input field.

## Executing a Custom Command

Once you have created a custom command, you can execute it in several ways:

-   **From the Prompt Field:** Type `/` in the prompt field to see a list of available commands, including your custom ones. Select the command you want to run and press Enter.
-   **From the Command Palette:** You can open the command palette (usually with `Ctrl+Shift+P` or `Cmd+Shift+P`) and search for your custom command by name.

When you execute a command, its output will be displayed in the chat interface, so you can see the results of its execution. Custom commands are a powerful way to automate repetitive tasks and integrate your own scripts and tools directly into the AiderDesk environment.

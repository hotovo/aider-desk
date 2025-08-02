# Context Files

The "context" is the set of files that the AI has access to when you interact with it. Providing the right context is crucial for getting accurate and relevant responses from the AI. AiderDesk provides several ways to manage the context.

## The Context Files Panel

The "Context Files" panel on the left side of the screen is the primary way to manage the context. It consists of two main sections:

-   **Context:** This section at the top shows the list of files that are currently in the context. You can remove a file from the context by clicking the "x" button next to its name.
-   **File Tree:** This section below shows the file tree of your project. You can add a file to the context by simply clicking on it in the file tree.

## Adding Files to the Context

You can add files to the context in several ways:

-   **Clicking in the File Tree:** As mentioned above, clicking a file in the file tree will add it to the context.
-   **Using the `/add` Command:** You can use the `/add` command in the chat to add one or more files to the context. For example: `/add src/main.ts`.
-   **IDE Integration:** If you have the [AiderDesk IDE integration](./../features/ide-integration.md) set up, you can automatically add the currently active file(s) in your editor to the context.

## Read-Only vs. Editable Files

When you add a file to the context, you can specify whether it should be read-only or editable.

-   **Editable Files:** By default, files are added as editable. This means the AI is allowed to modify them.
-   **Read-Only Files:** You can mark a file as read-only to prevent the AI from modifying it. This is useful for providing reference material or files that you don't want the AI to touch. You can toggle the read-only status of a file in the "Context" section.

When using Agent Mode, the content of the files is sent to the LLM with instructions on whether they are editable or not. This helps the agent make better decisions about which files to modify.

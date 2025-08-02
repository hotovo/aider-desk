# Quick Start

This guide will walk you through the basic workflow of using AiderDesk to work on a project.

## 1. Open a Project

The first step is to open a project. AiderDesk works with any local Git repository.

1.  Click the **Open Project** button on the welcome screen or in the project tabs bar.
2.  Select the root directory of your Git repository.

AiderDesk will open the project and display its file tree in the "Context Files" panel on the left.

## 2. Start a Chat

Once you have a project open, you can start a chat with the AI.

1.  Type a prompt in the input field at the bottom of the screen. For example, you could ask the AI to "add a new function that calculates the factorial of a number."
2.  Press **Enter** to send the prompt.

The AI will respond with its plan and then generate the code.

## 3. Add Files to the Context

To make the AI aware of existing code, you need to add files to the context.

1.  In the "Context Files" panel, click on a file to add it to the context.
2.  The file will appear in the "Context" section above the file tree.
3.  You can also add files by using the `/add` command in the chat, or by using the [IDE integration](./../features/ide-integration.md).

Now, when you chat with the AI, it will have the content of these files as context.

## 4. Review and Apply Changes

When the AI makes changes to your code, you can review them in the diff viewer.

1.  The AI will indicate which files it has modified. A diff view will automatically appear in the chat for each changed file.
2.  You can review the changes side-by-side.
3.  If you're happy with the changes, you can apply them to your project by clicking the **Apply** button. If you want to reject the changes, you can click the **Reject** button.

## 5. Save Your Session

AiderDesk allows you to save your chat history and context files as a session, so you can resume your work later.

1.  Click the **Save Session** button in the top right of the chat view.
2.  Give your session a name and click **Save**.
3.  You can load a session later by clicking the **Load Session** button.

This quick start guide has covered the basic workflow of AiderDesk. To learn more about the available features, check out the other sections of this documentation.

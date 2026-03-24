---
sidebar_label: "Diff Viewer"
---

# Reviewing Code Changes

One of AiderDesk's most powerful features is the ability to clearly visualize and manage the code changes proposed by the AI.

:::tip Updated Files
For a complete overview of how to track and interact with modified files, including making inline code requests, see the **[Updated Files](updated-files.md)** documentation.
:::

## The Diff Viewer

Whenever Aider modifies a file, the changes are presented in a **diff view** within a code block in the chat. This provides a clear comparison of the original code and the new, modified version.

### Diff View Modes

AiderDesk offers three different ways to visualize code changes, which you can switch between using the mode selector in the top-right corner of any diff code block:

- **Side-by-Side**: The classic view showing the original code on the left and the modified code on the right.
- **Unified**: Displays changes inline within a single column, showing deletions and additions sequentially.
- **Compact**: A space-saving mode that merges modified lines and highlights character-level edits inline for maximum density.

You can also set your preferred default view mode in **General Settings**.

![Diff Viewer Modes](../images/diff-viewer-modes.gif)

### Visual Indicators

Regardless of the mode, the following indicators help you identify changes:

- **Green highlighting** indicates lines that have been **added**.
- **Red highlighting** indicates lines that have been **removed**.
- **Darker shades** within a highlighted line pinpoint the exact characters that were changed.

## Understanding Aider's Diff Format

When Aider makes a change, it often uses a specific format within the code block to represent the edit:

```
<<<<<<< SEARCH
// Original code to be replaced
=======
// New code to insert
>>>>>>> REPLACE
```

AiderDesk automatically parses this format and renders it in the user-friendly diff viewer, so you don't have to read the raw diff syntax yourself.

## Reverting Changes

You have granular control over which changes to accept. If you disagree with a specific modification proposed by the AI, you can easily revert it.

1.  Hover over the code block containing the change you want to undo.
2.  An **Undo** icon (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-counterclockwise" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 3a5 5 0 1 1-4.546 2.914.5.5 0 0 0-.908-.417A6 6 0 1 0 8 2v1z"/><path d="M8 4.466V.534a.25.25 0 0 0-.41-.192L5.23 2.308a.25.25 0 0 0 0 .384l2.36 1.966A.25.25 0 0 0 8 4.466z"/></svg>) will appear in the top-right corner of the block.
3.  Click the icon.

AiderDesk will immediately apply the revert, replacing the AI's new code with the original code in the actual file on your disk. This action is instant and allows you to selectively accept or reject parts of the AI's work.

## Inline Code Requests

The diff viewer modal (accessed via the [Updated Files](updated-files.md) section) supports **inline code requests**, allowing you to request changes directly on specific lines.

### How It Works

1. **Open the diff view** by clicking on a file in the Updated Files section
2. **Click on any line** in the code where you want to request a change
3. **Enter your feedback** in the comment dialog that appears
4. **Submit** - AiderDesk creates a focused task to implement your change

The AI receives your comment along with surrounding code context, ensuring the change integrates well with the existing code structure.

### Example Requests

- *"Add error handling here"* - Request try-catch blocks on a function call
- *"Rename this variable to userCount"* - Request naming improvements
- *"Add JSDoc for this function"* - Request documentation
- *"Optimize this loop"* - Request performance improvements

For detailed best practices and more examples, see the **[Updated Files](updated-files.md)** documentation.

## Related Features

- **[Updated Files](updated-files.md)** - Track all modified files and make inline code requests
- **[Custom Prompts](../advanced/custom-prompts.md)** - Customize diff-related prompt templates

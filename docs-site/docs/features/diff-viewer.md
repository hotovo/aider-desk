# Diff Viewer

AiderDesk includes an integrated diff viewer that allows you to review changes made by the AI before applying them to your codebase. This is a critical feature for maintaining control over your code and ensuring that only desired changes are committed.

## Reviewing Changes

Whenever the AI modifies one or more files in your project, AiderDesk will automatically generate a diff for each change and display it directly in the chat interface.

The diff view presents a clear, side-by-side comparison of the original file and the modified version:

-   **Left Side (Original):** Shows the content of the file before the AI's changes.
-   **Right Side (Modified):** Shows the content of the file after the AI's changes.

Lines that have been added, removed, or modified are highlighted, making it easy to spot the exact changes that were made.

## Applying and Rejecting Changes

For each diff presented in the chat, you have two options:

-   **Apply:** If you are satisfied with the changes made by the AI, you can click the **Apply** button. This will save the modifications to the corresponding file on your local disk.
-   **Reject:** If you do not want to keep the changes, you can click the **Reject** button. This will discard the modifications, and the original file will remain unchanged.

This interactive review process gives you full authority over your code. You can choose to accept all, some, or none of the AI's suggestions, ensuring that you are always in command of your project.

## One-Click Reverts

In addition to the main "Apply" and "Reject" buttons, AiderDesk also provides a one-click revert feature for individual changes. If the AI has made multiple modifications within a single file, you may see options to revert specific hunks of the diff.

This granular control allows you to accept some changes within a file while rejecting others, giving you fine-grained control over the final output.

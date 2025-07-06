# Aider Tools in Agent Mode

When operating in Agent Mode, AiderDesk equips the AI agent with a suite of "Aider Tools." These tools are specialized functions that allow the agent to interact with your project's codebase in a structured and efficient manner, similar to how the underlying `aider` command-line tool works. They are crucial for tasks involving code understanding, modification, and generation.

## What are Aider Tools?

Aider Tools provide the agent with capabilities to:

-   **Read Files:** Access and understand the content of specific files within the project.
-   **Add Files to Context:** Explicitly include files in the AI's conversational context, ensuring it has the necessary information for tasks.
-   **Update Files:** Apply changes to existing files, such as refactoring code, adding new functions, or fixing bugs. This is often done through a diff-based application process.
-   **Create Files:** Generate new files within the project structure.
-   **Drop Files from Context:** Remove files from the AI's active conversational context if they are no longer relevant, helping to manage the context window and focus.
-   **List Files:** Get a directory listing to understand the project structure.
-   **Run Commands (Git):** Execute common Git commands (like `git diff`) to understand changes or prepare for commits.

These tools are designed to work seamlessly with the `aider` backend, ensuring that changes are managed correctly within the project's Git repository.

## How Aider Tools Enhance Agent Mode

In Agent Mode, the AI's primary goal is to accomplish tasks you set for it. Aider Tools are the agent's "hands and eyes" for interacting with your code:

-   **Targeted Operations:** Instead of just generating text, the agent can use these tools to perform precise actions on your codebase. For example, if asked to "refactor the `calculateTotal` function in `billing.py`," the agent can use `read_file` to understand `billing.py`, then propose changes, and finally use `update_file` to apply them.
-   **Context Management:** Tools like `add_to_context` and `drop_from_context` allow the agent to dynamically manage what information it's focusing on, which is critical for handling large projects and complex tasks.
-   **Structured Changes:** When the agent decides to modify code, it typically uses a tool that generates a diff (a description of changes). You often have the opportunity to review and approve these changes before they are applied, maintaining control over your codebase.
-   **Efficiency:** By using specific tools for specific tasks (e.g., reading a file vs. just discussing it abstractly), the agent can operate more efficiently and accurately.

## Common Aider Tools and Their Usage by the Agent

While the exact set of tools and their invocation might be abstracted from the end-user, understanding their purpose helps in formulating effective prompts for the agent.

1.  **`read_file` (or similar):**
    -   **Purpose:** Allows the agent to read the contents of one or more specified files.
    -   **Agent Usage:** When the agent needs to understand existing code, look for specific implementations, or gather context before making changes.
    -   **Example Prompt Trigger:** "Please review the `userService.js` file and identify any potential performance bottlenecks."

2.  **`add_to_context` / `edit_file`:**
    -   **Purpose:** Explicitly loads specified files into the AI's active working memory for detailed analysis and modification. This is a core `aider` concept.
    -   **Agent Usage:** When the agent needs to work extensively with certain files, it will "add" them to its context. Subsequent prompts and generated changes will then primarily concern these files.
    -   **Example Prompt Trigger:** "I need you to refactor the authentication logic. Start by looking at `authController.js` and `authService.js`."

3.  **`update_file` / `apply_diff`:**
    -   **Purpose:** Applies changes (often provided as a diff) to a file that is already in the agent's context.
    -   **Agent Usage:** After the agent has generated code modifications for a file, it uses this tool to write those changes to the actual file on disk. This step usually requires user approval.
    -   **Example Agent Action:** (After generating a code change) "I have prepared the following changes for `authController.js`. Should I apply them?"

4.  **`create_file`:**
    -   **Purpose:** Creates a new file with specified content.
    -   **Agent Usage:** When the task involves generating entirely new modules, components, or configuration files.
    -   **Example Prompt Trigger:** "Generate a new Python module named `data_processor.py` with a function to parse CSV files."

5.  **`drop_from_context`:**
    -   **Purpose:** Removes a file from the AI's active conversational context.
    -   **Agent Usage:** If a file is no longer relevant to the current task, the agent might drop it to free up context space or to focus on other files.
    -   **Example Prompt Trigger:** "We are done with `authController.js`. Now let's focus on the `userProfile.js` component."

6.  **Git Interaction Tools (e.g., `run_git_diff`):**
    -   **Purpose:** Allows the agent to see uncommitted changes or differences between commits.
    -   **Agent Usage:** To understand the current state of changes, to help generate commit messages, or to verify its own modifications.
    -   **Example Prompt Trigger:** "Show me the current git diff." or "Generate a commit message for the changes I've staged."

## Leveraging Aider Tools Effectively in Agent Mode

-   **Be Specific About Files:** When your request pertains to specific files, mention them by name. This helps the agent quickly identify and use the relevant tools (e.g., `add_to_context` or `read_file`).
-   **Guide the Workflow:** You can suggest a sequence of actions that implicitly guide tool usage. For instance, "First, read `config.yaml`. Then, based on its contents, update the `database_connection` string in `main.py`."
-   **Review Changes:** Pay close attention when the agent proposes file modifications. AiderDesk will typically show you the diff and ask for approval. This is your chance to ensure the agent's changes are correct and desirable.
-   **Understand Context Limitations:** While Aider Tools help manage context, there's still a limit to how much information the AI can handle at once. For very large-scale changes, break down the task.

Aider Tools are fundamental to the power of Agent Mode in AiderDesk, enabling the AI to go beyond simple chat and become an active participant in your development process. By understanding their role, you can better direct the agent and achieve more complex coding tasks.

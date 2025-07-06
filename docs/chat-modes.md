# Chat Modes in AiderDesk

AiderDesk offers various "chat modes" to tailor the AI's behavior and capabilities to specific types of tasks. Each mode optimizes the interaction for different goals, such as general assistance, code generation, context-aware Q&A, or delegating complex tasks. You can typically switch between these modes using a dropdown menu or a dedicated selector in the AiderDesk interface.

## Understanding Chat Modes

Chat modes determine:

-   **The underlying system prompt or persona** used for the AI.
-   **The tools and capabilities** available to the AI.
-   **How context (like files) is handled** and presented to the AI.
-   **The expected type of interaction** and response from the AI.

Switching to the appropriate chat mode for your current task can significantly improve the relevance and quality of the AI's assistance.

![Chat Modes Gif](images/chat-modes.gif)
*(Image showing the chat mode selector in AiderDesk)*

## Common Chat Modes and Their Uses

While the exact names and features of chat modes can evolve, here are some common ones found in AiderDesk and their typical use cases:

### 1. Agent Mode

-   **Purpose:** For delegating complex, multi-step tasks to the AI. The agent can plan, use tools (like Power Tools and Aider Tools), and work autonomously towards a goal.
-   **Use Cases:**
    -   Implementing new features.
    -   Refactoring large sections of code.
    -   Performing research and generating reports.
    -   Automating workflows that involve file operations, code changes, and analysis.
-   **Interaction Style:** You provide a high-level objective, and the agent breaks it down, showing its work and potentially asking for clarification or approval for certain steps.
-   **Key Features:** Access to a wide range of tools, task decomposition, autonomous operation.
-   **See Also:** [Agent Mode Documentation](agent-mode.md)

### 2. Code Mode (or Aider Mode)

-   **Purpose:** Optimized for direct interaction with your codebase, leveraging the power of the `aider` tool. This mode is focused on generating, editing, and discussing code within the context of specific files.
-   **Use Cases:**
    -   Writing new functions or classes.
    -   Debugging existing code.
    -   Refactoring specific code blocks.
    -   Explaining how parts of your code work.
    -   Adding comments or documentation to code.
-   **Interaction Style:** You typically add files to the `aider` context (e.g., using `/add path/to/file.py`) and then ask the AI to perform operations on that code. Changes are often presented as diffs for approval.
-   **Key Features:** Direct `aider` integration, file-centric context, code generation and modification with diffs.

### 3. Ask Mode (or Question Mode)

-   **Purpose:** For asking general questions, seeking explanations, or brainstorming ideas that may or may not be directly tied to specific files in your project.
-   **Use Cases:**
    -   Asking about programming concepts.
    -   Getting explanations of error messages.
    -   Brainstorming solutions to a problem.
    -   Requesting information on libraries or frameworks.
    -   General technical Q&A.
-   **Interaction Style:** Conversational, similar to interacting with a general-purpose AI assistant, but often with a technical focus.
-   **Key Features:** Less emphasis on direct file manipulation, more on providing information and explanations.

### 4. Context Mode (or Custom Context Mode)

-   **Purpose:** Allows you to define a custom set of context files or information that the AI should focus on, without necessarily using the full `aider` editing capabilities. This is useful for targeted Q&A about specific parts of your project.
-   **Use Cases:**
    -   Asking questions about a specific set of files you select.
    -   Understanding relationships between a few key components.
    -   Getting summaries or explanations based on a curated context.
-   **Interaction Style:** You manually select files or provide context, and then ask questions related to that specific information.
-   **Key Features:** User-defined context, focused Q&A, good for understanding specific modules or features without the overhead of full `aider` editing.

![Context Files](images/contex-files.png)
*(Image showing how context files might be managed or displayed for modes like Context Mode)*

### 5. Architect Mode (Conceptual/Planning)

-   **Purpose:** Designed for high-level planning, system design, and architectural discussions. The AI in this mode might be primed to think more abstractly about software structure and design patterns.
-   **Use Cases:**
    -   Designing the architecture for a new application or feature.
    -   Discussing trade-offs between different design choices.
    -   Generating diagrams or outlines for software components.
    -   Exploring technology stack options.
-   **Interaction Style:** More strategic and conceptual conversation, less focused on specific lines of code.
-   **Key Features:** Focus on abstraction, design principles, and high-level system structure.

## How to Switch Chat Modes

AiderDesk typically provides a clear way to switch between modes:

-   **Dropdown Menu:** Look for a dropdown list in the main interface, often near the prompt input area, that lists the available chat modes.
-   **Command Palette:** Some applications offer a command palette (e.g., accessible via `Ctrl+Shift+P` or `Cmd+Shift+P`) where you can search for and select different modes.
-   **Settings:** Mode selection might also be part of a settings panel related to the current project or chat session.

## Why Use Different Modes?

-   **Improved Relevance:** Each mode primes the AI with specific instructions and tools, making its responses more relevant to the task at hand.
-   **Efficiency:** Using the right mode can save time by providing the AI with the appropriate context and capabilities from the start.
-   **Better Control:** Modes give you more control over how the AI interacts with your project and the kind of assistance it provides.
-   **Optimized Tooling:** Agent Mode has powerful tools for automation, while Code Mode is fine-tuned for `aider`'s code manipulation capabilities.

By understanding and utilizing the different chat modes in AiderDesk, you can significantly enhance your productivity and get more targeted and effective assistance from the AI. Experiment with each mode to see how it best fits your various development workflows.

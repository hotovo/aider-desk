# `/compact` Command

The `/compact` command helps you summarize your conversation history with AiderDesk. This is particularly useful for long conversations, as it condenses the previous interactions into a concise summary, allowing the AI agent to maintain context more efficiently without being overwhelmed by excessive history.

## What It Does

When you run `/compact`, AiderDesk analyzes the entire conversation history in the current project. It then generates a structured summary that includes:

-   The primary request and overall intent of the conversation.
-   Key technical concepts discussed.
-   A chronological list of all user messages.
-   Details about files and code sections that were read, created, or modified, including relevant code snippets.
-   A log of errors encountered and their resolutions.
-   The current work being performed and the next logical step.

After the summary is generated, the conversation history in the current session is replaced with this summary, effectively "compacting" it.

## Why It's Useful

-   **Improved Context Management**: For lengthy sessions, the AI's context window can become full. Compacting the conversation helps keep the most relevant information available to the AI, preventing it from "forgetting" earlier details.
-   **Faster Responses**: With a more concise context, the AI can process information more quickly, potentially leading to faster response times.
-   **Cost Efficiency**: By reducing the amount of historical data sent to the model, it can help manage token usage, which might lead to more cost-efficient interactions with certain LLM providers.

## How to Use It

1.  **Run the Command**: Type `/compact` into the prompt field and press `Enter`.
    -   You can also provide custom instructions after the command, for example: `/compact Summarize only the code changes.`

2.  **Analysis and Summary**: The agent will analyze your conversation history and generate a summary. You will see log messages indicating its progress.

3.  **Context Update**: Once the summary is complete, your current conversation history will be replaced with the generated summary.

## Model Usage

The model used for compaction depends on your current mode:

-   **Agent Mode**: When in Agent mode, the `/compact` command utilizes a dedicated agent profile (`compact`) to perform the summarization. This profile is optimized for this task and uses the agent's configured model.
-   **Other Modes (Code, Ask, Architect, Context)**: In these modes, the `/compact` command uses Aider's underlying main model to generate the conversation summary.

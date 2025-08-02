# Agent Parameters

In addition to the system prompt and the set of available tools, you can also configure several advanced parameters that control the agent's behavior. These parameters can be adjusted for each agent profile in **Settings > Agent**.

## Max Iterations

-   **Description:** This parameter sets the maximum number of thinking and execution cycles the agent can perform for a single prompt. An iteration consists of the agent thinking about what to do, choosing a tool, executing it, and observing the result.
-   **Purpose:** This setting acts as a safeguard to prevent the agent from getting stuck in a loop or running indefinitely. If the agent reaches the maximum number of iterations without completing the task, it will stop and you will be notified.
-   **Default:** `10`

## Max Tokens

-   **Description:** This parameter controls the maximum number of tokens that the AI model can generate in a single response. This includes both the agent's thoughts and its final answer.
-   **Purpose:** This setting helps to control the cost and latency of the AI model. A higher limit allows for more complex reasoning and longer responses, but it can also increase costs.
-   **Default:** `4096`

## Temperature

-   **Description:** The temperature parameter controls the randomness of the AI model's output. It is a value between 0 and 2.
-   **Purpose:**
    -   A **lower temperature** (e.g., `0.2`) results in more deterministic and focused output. The model is more likely to choose the most probable next word, which is good for tasks that require precision and predictability.
    -   A **higher temperature** (e.g., `0.8`) results in more creative and diverse output. The model is more likely to explore less probable words, which can be useful for brainstorming or generating creative text.
-   **Default:** `0.7`

By fine-tuning these parameters, you can significantly influence the agent's performance, cost, and output quality, allowing you to optimize its behavior for different types of tasks.

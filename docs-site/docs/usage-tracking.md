# Usage and Cost Tracking

AiderDesk provides detailed tools to help you monitor your token usage and associated costs, ensuring you stay in control of your spending.

## Cost Info Panel

Located at the bottom of the right-hand sidebar, the Cost Info panel gives you a real-time overview of your current session's usage.

- **Token Breakdown**: See a detailed breakdown of token usage for:
    - **Files**: Tokens used by the content of files in your context.
    - **Repo Map**: Tokens used by the repository map, if enabled.
    - **Messages**: Tokens used by the chat history.
- **Cost Breakdown**:
    - **Aider**: The total cost incurred by the Aider engine for the current project.
    - **Agent**: The total cost incurred by Agent Mode for the current project.
    - **Total**: The combined cost of both Aider and Agent.
- **Token Usage Bar**: A visual indicator showing your current prompt's token count relative to the selected model's maximum input token limit. This helps you avoid exceeding the context window.

## Usage Dashboard

For a more in-depth analysis, AiderDesk includes a comprehensive Usage Dashboard. You can access it by clicking the **Chart** icon (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-bar-chart-fill" viewBox="0 0 16 16"><path d="M1 11a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1v-3zm5-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7zm5-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V2z"/></svg>) in the top-right corner.

### Features

- **Filtering**: Filter your usage data by a custom **Date Range**, by **Projects**, and by **Models**.
- **Table View**: A detailed, sortable table showing usage data for each interaction, including input/output tokens, cache usage, and cost.
- **Charts View**: Visualize your usage data with interactive charts:
    - **Token Usage Trend**: A line chart showing input, output, and total token usage over time.
    - **Model Usage Distribution**: A pie chart showing the percentage of tokens used by each model.
    - **Daily Cost Breakdown**: A stacked bar chart showing daily costs, broken down by project.
    - **Daily Message Breakdown**: A stacked bar chart showing the number of messages per day, broken down by project.
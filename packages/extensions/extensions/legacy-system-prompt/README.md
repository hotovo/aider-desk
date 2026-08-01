# Legacy System Prompt

This extension restores the **verbose system prompt and workflow** that were used before the optimization in commit `cd49ed0f3` (v0.30.0).

## When to Use

The default system prompt was streamlined to be concise and token-efficient, which works well with modern, highly capable models (e.g., Claude Sonnet 4+, GPT-4o, Gemini 2.5+).

However, **less capable or smaller models** may benefit from more explicit, step-by-step instructions. If you notice your agent:

- Skipping context gathering before making changes
- Not identifying all relevant files
- Rushing to implementation without a plan
- Failing to verify changes

…then this extension may improve reliability by providing more prescriptive guidance.

## How It Works

The extension intercepts the `onPromptTemplate` event and replaces the rendered `system-prompt` and `workflow` templates with their pre-optimization versions. These legacy templates include:

- **Detailed Core Directives** — context-first, iterative tools, security-first, assumptions, goal-tracking, persistence, tool-mandate, and more
- **Per-Tool Usage Guidelines** — explicit instructions for each power tool (semantic search, file read/write/edit, glob, grep, bash)
- **Verbose Workflow** — multi-step process: Analyze Request → Retrieve Memory → Gather Context → Fill Memory Gaps → Identify All Relevant Files → Develop Plan → Execute → Verify → Review → Assess Completion → Store Memory → Final Summary

All dynamic variables (project directory, tool permissions, tool constants, conditional sections) are preserved — the legacy templates are rendered with the same data as the default ones.

## Installation

Enable this extension from **Settings → Extensions**.

## Compatibility

Works with any agent profile. The legacy templates are applied globally to all agent mode runs when the extension is enabled.

---
sidebar_position: 3
title: "Project-Specific Rules"
sidebar_label: "Project Rules"
---

# Project-Specific Rules

To ensure the AI agent adheres to the specific conventions, architecture, and best practices of your project, you can provide it with custom rule files. This is a powerful feature for tailoring the agent's behavior and improving the quality of its output.

## The `.aider-desk/rules` Directory

AiderDesk automatically looks for a directory named `.aider-desk/rules/` in the root of your project. Any markdown files (`.md`) placed in this directory will be automatically read and included in the agent's system prompt as read-only context.

This allows you to create a persistent set of instructions that guide every agent interaction within that project.

### What to Include in Rule Files

Good candidates for rule files include:
- **High-level architecture overview**: Describe the main components and how they interact.
- **Coding conventions**: Specify code style, naming conventions, or patterns that are unique to your project.
- **Technology stack**: List the key libraries, frameworks, and tools used.
- **"Do's and Don'ts"**: Provide specific instructions on what the agent should or should not do (e.g., "Always use our custom `useApi` hook for data fetching," "Do not add new dependencies without approval").

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

## Bootstrapping with `/init`

To help you get started, AiderDesk provides the `/init` command. This command is only available in **Agent Mode**.

When you run `/init`, the agent will:
1.  Perform an analysis of your entire codebase.
2.  Generate a `PROJECT.md` file inside the `.aider-desk/rules/` directory.
3.  This generated file will contain the agent's understanding of your project's architecture, common commands, and key files.

After generation, you should review the `PROJECT.md` file, correct any misunderstandings, and add any missing information. A well-defined `PROJECT.md` file dramatically improves the agent's effectiveness.

### Adding `PROJECT.md` to Aider's Config

After running `/init`, AiderDesk will ask if you want to add the newly created `PROJECT.md` to your `.aider.conf.yml` file as a read-only file. This ensures that the rules are also available to the standard Aider engine, not just the agent.

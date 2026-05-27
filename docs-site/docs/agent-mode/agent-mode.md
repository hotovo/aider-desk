---
title: "Overview"
sidebar_label: "Overview"
---

# Agent Mode Overview

Agent Mode in AiderDesk transforms the application into a powerful, autonomous assistant capable of handling complex software engineering tasks. Powered by the Vercel AI SDK, the agent can plan, reason, and utilize a suite of tools to achieve its goals with minimal human intervention.

## Key Capabilities

- **Autonomous Task Execution**: The agent can break down a high-level request (e.g., "refactor the authentication logic") into a series of concrete steps.
- **Tool Utilization**: It can use a wide range of tools, including built-in Power Tools for file system operations, Aider Tools for code manipulation, and external tools via MCP Servers.
- **Configurable Profiles**: Tailor the agent's behavior, capabilities, and LLM settings for different tasks using Agent Profiles.
- **Transparent Operation**: Observe the agent's thought process, the tools it chooses, and the results of its actions directly in the chat interface.

## Autonomy Modes

When working in Agent Mode, you control how much freedom the agent has to act on your behalf. The **Autonomy Selector** in the prompt field lets you choose between three modes, each balancing automation and control differently.

### Manual

Every tool execution and plan requires your explicit approval before proceeding. The agent will present its planned actions and wait for you to approve each one.

**Best for:** Unfamiliar codebases, risky operations, or when you want full oversight of every step the agent takes.

### Guided

The agent plans before acting and presents its plan for your approval. Once a plan is approved, tool executions within that plan are auto-approved, allowing the agent to work through the steps without interruption.

**Best for:** Everyday development — you stay in control of the overall direction while the agent executes the details efficiently.

### Autonomous

The agent plans and executes without interruption until the task is complete. No approval dialogs are shown — the agent works independently from start to finish.

**Best for:** Trusted, well-understood tasks where you want to step away and let the agent complete the work on its own.

### Locking the Autonomy Mode

By default, each new task starts in Guided mode. If you find yourself switching to the same mode every time, you can **lock** the autonomy mode by clicking the lock icon next to the selector. When locked, all newly created tasks will start in your chosen mode instead of the default.

---

To learn how to use Agent Mode, see [How to Use Agent Mode](./how-to-use.md).



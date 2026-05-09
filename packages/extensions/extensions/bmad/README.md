# BMAD Method Extension

Integrates the [BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD) (**B**uild **M**ore **A**rchitect **D**reams) into AiderDesk, providing a guided UI for running BMAD workflows directly from your desktop.

## What is the BMAD Method?

The BMAD Method is an AI-driven agile development framework that guides you through the full software development lifecycle — from brainstorming and analysis through planning, architecture, and implementation. Instead of letting AI tools do all the thinking, BMAD uses specialized agents and structured workflows that act as expert collaborators, bringing out your best thinking in partnership with the AI.

Key ideas:

- **Structured workflows** grounded in agile best practices across analysis, planning, solutioning, and implementation
- **Specialized agents** — domain experts (Analyst, PM, Architect, Developer, UX Designer, and more) that guide each phase
- **Scale-adaptive** — automatically adjusts planning depth based on project complexity, from quick fixes to enterprise systems

Learn more at [docs.bmad-method.org](https://docs.bmad-method.org).

## What This Extension Adds to AiderDesk

This extension brings the BMAD Method directly into AiderDesk with:

### Welcome Page with Workflow Dashboard

When you select **BMAD** mode in AiderDesk, a welcome page appears with a visual workflow dashboard showing:

- **Full Workflow** — organized into four phases: Analysis → Planning → Solutioning → Implementation
- **Quick Flow** — a streamlined path for well-defined tasks that don't need full planning
- Progress tracking per workflow with step indicators
- Artifact detection — completed workflow outputs are linked and openable
- Suggested next workflows based on your current progress

### One-Click Installation

The welcome page detects whether BMAD is installed in your project. If not, it offers a one-click install that runs `npx bmad-method install` in your project directory — no terminal needed.

### Task Actions

While working on a task in BMAD mode, the extension shows contextual actions in the task status bar:

- **Resume** buttons for incomplete workflows
- **Suggested next workflow** based on what you've completed so far
- Quick access to execute the next logical step in your project

### Automatic Context Preparation

When you start a workflow, the extension automatically:

- Loads the relevant BMAD workflow prompt
- Attaches completed artifacts (product brief, PRD, architecture, etc.) as context
- Sets up the agent with the right system prompt for the selected workflow

## Workflows

### Full Workflow

| Phase | Workflow | Description |
|-------|----------|-------------|
| **Analysis** | Brainstorming | Interactive brainstorming with diverse creative techniques |
| **Analysis** | Research | Comprehensive research across multiple domains |
| **Analysis** | Create Product Brief | Define product vision and target users |
| **Planning** | Create PRD | Comprehensive requirements document |
| **Planning** | Create UX Design | UX design documentation for product interface |
| **Solutioning** | Create Architecture | Technical architecture and system design |
| **Solutioning** | Create Epics & Stories | Break down requirements into implementation-ready items |
| **Implementation** | Sprint Planning | Generate sprint status tracking |
| **Implementation** | Create Story | Guided development for implementing stories |
| **Implementation** | Dev Story | Execute stories with implementation, tests, and validation |
| **Implementation** | Code Review | Adversarial senior developer code review |

### Quick Flow

| Workflow | Description |
|----------|-------------|
| Quick Spec | Create focused specifications for well-defined features |
| Quick Dev | Rapid spec-to-implementation for small features |

## Prerequisites

- **Node.js v20+** — required to install the BMAD Method via npx
- **AiderDesk** — the extension is available in the extensions gallery

## Getting Started

1. Install the extension from AiderDesk's extension gallery
2. Open a project and select **BMAD** from the mode selector
3. Click **Install BMAD Method** on the welcome page (or install manually via `npx bmad-method install`)
4. Choose a workflow and start building

## Troubleshooting

### Installation Fails

If the one-click installation fails, check the following:

1. **Node.js version** — BMAD requires **Node.js v20 or newer**. Check your version:
   ```bash
   node --version
   ```
   If you're running an older version, upgrade via [nodejs.org](https://nodejs.org) or your package manager (nvm, fnm, etc.).

2. **Legacy installation conflict** — If you previously installed BMAD v4, the `.bmad-method` folder in your project will block installation. Remove it and retry:
   ```bash
   rm -rf .bmad-method
   ```

3. **Manual installation** — You can always install directly from the terminal:
   ```bash
   npx bmad-method install
   ```
   Then click **Refresh** on the welcome page to detect the installation.

## Links

- [BMAD Method Documentation](https://docs.bmad-method.org)
- [BMAD Method GitHub](https://github.com/bmad-code-org/BMAD-METHOD)
- [Discord Community](https://discord.gg/gk8jAdXWmj)

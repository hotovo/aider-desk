import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    "index",
    {
      type: "category",
      label: "Getting Started",
      collapsed: false,
      items: [
        "getting-started/installation",
        "getting-started/first-launch",
        "getting-started/quick-start",
        "getting-started/managing-projects",
        "getting-started/development",
      ],
    },
    {
      type: "category",
      label: "Core Workflow",
      collapsed: false,
      items: [
        "core/chat-modes",
        "core/context-files",
        "core/model-library",
        "core/commands",
        "core/reviewing-changes",
        "core/handoff-and-compaction",
        "core/command-palette",
        "core/terminal-and-editor",
      ],
    },
    {
      type: "category",
      label: "Agent Mode",
      collapsed: true,
      items: [
        {
          type: "category",
          label: "Fundamentals",
          collapsed: true,
          items: [
            "agent-mode/agent-mode",
            "agent-mode/how-to-use",
            "agent-mode/managing-tasks",
            "agent-mode/init",
          ],
        },
        {
          type: "category",
          label: "Customization",
          collapsed: true,
          items: [
            "agent-mode/agent-profiles",
            "agent-mode/subagents",
          ],
        },
        {
          type: "category",
          label: "Tools",
          collapsed: true,
          items: [
            "agent-mode/aider-tools",
            "agent-mode/power-tools",
            "agent-mode/task-tools",
            "agent-mode/task-management",
            "agent-mode/memory",
            "agent-mode/skills",
            "agent-mode/mcp-servers",
          ],
        },
      ],
    },
    {
      type: "category",
      label: "Extensions",
      collapsed: false,
      items: [
        "extensions/index",
        "extensions/extensions-gallery",
        "extensions/installation",
        {
          type: "category",
          label: "Developing Extensions",
          collapsed: true,
          items: [
            "extensions/creating-extensions",
            "extensions/event-flow",
            "extensions/events",
            "extensions/api-reference",
          ],
        },
      ],
    },
    {
      type: "category",
      label: "Features",
      collapsed: true,
      items: [
        "features/git-worktrees",
        "features/updated-files",
        "features/usage-dashboard",
        "features/web-scraping",
        "features/voice-control",
      ],
    },
    {
      type: "category",
      label: "Configuration",
      collapsed: true,
      items: [
        "configuration/settings",
        "configuration/providers",
        "configuration/aider-configuration",
        "configuration/project-specific-rules",
        "configuration/look-and-feel",
        "configuration/prompt-behavior",
        "configuration/automatic-updates",
        "configuration/telemetry",
      ],
    },
    {
      type: "category",
      label: "Integrations",
      collapsed: true,
      items: [
        "integrations/ide-integration",
        "integrations/rest-api",
        "integrations/socketio-events",
        "integrations/browser-api",
        "integrations/aider-mcp-server",
        "integrations/readonly-view",
        "integrations/acp",
      ],
    },
    {
      type: "category",
      label: "Advanced",
      collapsed: true,
      items: [
        "advanced/docker",
        "advanced/npm-cli",
        "advanced/cli-run",
        "advanced/custom-aider-version",
        "advanced/extra-python-packages",
        "advanced/open-telemetry",
        "advanced/custom-prompts",
      ],
    },
  ],
};

export default sidebars;

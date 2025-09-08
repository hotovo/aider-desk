import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */
const sidebars: SidebarsConfig = {
  // By default, Docusaurus generates a sidebar from the docs folder structure
  docsSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: ['getting-started/onboarding-process', 'getting-started/project-management'],
    },
    {
      type: 'category',
      label: 'Features',
      collapsed: true,
      items: [
        'features/chat-modes',
        'features/commands-reference',
        'features/ide-integration',
        'features/reviewing-code-changes',
        'features/custom-commands',
        'features/web-scraping',
        'features/compact',
        'features/session-management',
        'features/usage-dashboard',
        'features/aider-mcp-server',
      ],
    },
    {
      type: 'category',
      label: 'Agent Mode',
      collapsed: true,
      items: [
        'agent-mode/agent-mode',
        'agent-mode/how-to-use',
        'agent-mode/agent-profiles',
        'agent-mode/subagents',
        'agent-mode/aider-tools',
        'agent-mode/power-tools',
        'agent-mode/mcp-servers',
        'agent-mode/init',
        'agent-mode/task-management',
      ],
    },
    {
      type: 'category',
      label: 'Configuration',
      collapsed: true,
      items: [
        'configuration/settings',
        'configuration/providers',
        'configuration/aider-configuration',
        'configuration/project-specific-rules',
        'configuration/look-and-feel',
        'configuration/prompt-behavior',
        'configuration/automatic-updates',
        'configuration/telemetry',
      ],
    },
    {
      type: 'category',
      label: 'API & Integration',
      collapsed: true,
      items: ['features/rest-api', 'features/socketio-events', 'features/browser-api'],
    },
    {
      type: 'category',
      label: 'Advanced',
      collapsed: true,
      items: ['advanced/custom-aider-version', 'advanced/extra-python-packages', 'advanced/open-telemetry'],
    },
  ],
};

export default sidebars;

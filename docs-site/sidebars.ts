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
      label: 'Core Features',
      collapsed: true,
      items: [
        'core-features/chat-modes',
        'core-features/commands-reference',
        'core-features/custom-commands',
        'core-features/reviewing-code-changes',
        'core-features/session-management',
      ],
    },
    {
      type: 'category',
      label: 'Agent Mode',
      collapsed: true,
      items: [
        'agent-mode/agent-mode',
        'agent-mode/init',
        'agent-mode/task-management',
        'agent-mode/aider-tools',
        'agent-mode/power-tools',
        'agent-mode/mcp-servers',
      ],
    },
    {
      type: 'category',
      label: 'Configuration',
      collapsed: true,
      items: ['configuration/settings', 'configuration/aider-configuration', 'configuration/project-specific-rules', 'configuration/prompt-behavior'],
    },
    {
      type: 'category',
      label: 'Advanced Features',
      collapsed: true,
      items: [
        'advanced-features/usage-tracking',
        'advanced-features/web-scraping',
        'advanced-features/ide-integration',
        'advanced-features/rest-api',
        'advanced-features/compact',
      ],
    },
    {
      type: 'category',
      label: 'Customization & Extensions',
      collapsed: true,
      items: ['customization/custom-aider-version', 'customization/extra-python-packages', 'customization/automatic-updates', 'customization/telemetry'],
    },
  ],
  // But you can create a sidebar manually
  /*
  tutorialSidebar: [
    'intro',
    'hello',
    {
      type: 'category',
      label: 'Tutorial',
      items: ['tutorial-basics/create-a-document'],
    },
  ],
   */
};

export default sidebars;

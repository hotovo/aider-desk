import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

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
      items: ['getting-started/installation', 'getting-started/quick-start'],
    },
    {
      type: 'category',
      label: 'Core Concepts',
      collapsed: false,
      items: [
        'core-concepts/projects',
        'core-concepts/chat-interface',
        'core-concepts/context-files',
        'core-concepts/sessions',
        {
          type: 'category',
          label: 'Agent Mode',
          collapsed: true,
          items: [
            'core-concepts/agent-mode/index',
            'core-concepts/agent-mode/profiles',
            'core-concepts/agent-mode/tools',
            'core-concepts/agent-mode/parameters',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Features',
      collapsed: false,
      items: [
        'features/multi-project-management',
        'features/ide-integration',
        'features/custom-commands',
        'features/diff-viewer',
        'features/usage-tracking',
        'features/todo-list',
      ],
    },
    {
      type: 'category',
      label: 'Configuration',
      collapsed: false,
      items: [
        'configuration/index',
        'configuration/general-settings',
        'configuration/model-providers',
        'configuration/aider-settings',
      ],
    },
    {
      type: 'category',
      label: 'Advanced Topics',
      collapsed: false,
      items: [
        'advanced-topics/mcp-servers',
        'advanced-topics/aiderdesk-as-mcp-server',
        'advanced-topics/custom-aider-version',
        'advanced-topics/environment-variables',
      ],
    },
    {
      type: 'category',
      label: 'API Reference',
      collapsed: false,
      items: ['api-reference/rest-api'],
    },
  ],
};

export default sidebars;

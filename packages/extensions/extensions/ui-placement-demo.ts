/**
 * UI Placement Demo Extension
 *
 * Demonstrates all available UI component placement locations in AiderDesk.
 * Each placement renders a small chip showing the placement name.
 *
 * This extension is useful for:
 * - Testing that all placements work correctly
 * - Visual reference for extension developers
 * - Debugging placement issues
 */

import type { Extension, ExtensionContext, UIComponentDefinition, UIComponentPlacement, MessageFilter } from '@aiderdesk/extensions';

// Placements that are always visible (simple chip or compact icon)
const ALWAYS_ON_PLACEMENTS: UIComponentPlacement[] = [
  'task-status-bar-left',
  'task-status-bar-right',
  'task-usage-info-bottom',
  'task-messages-top',
  'task-messages-bottom',
  'task-message-above',
  'task-message-below',
  'task-message-bar',
  'task-input-above',
  'task-input-toolbar-left',
  'task-input-toolbar-right',
  'task-top-bar-left',
  'task-top-bar-right',
  'tasks-sidebar-header',
  'tasks-sidebar-bottom',
  'tasks-sidebar-actions-left',
  'tasks-sidebar-actions-right',
  'header-left',
  'header-right',
  'task-state-actions',
];

// Placements toggled via the task-floating panel checkboxes (disabled by default)
const TOGGLABLE_PLACEMENTS: UIComponentPlacement[] = [
  'welcome-page',
  'task-state-actions-all',
  'task-message',
];

const TASK_FLOATING_COMPONENT_ID = 'placement-demo-task-floating';
const PROJECT_FLOATING_COMPONENT_ID = 'placement-demo-project-floating';
const APP_FLOATING_COMPONENT_ID = 'placement-demo-app-floating';

// Shared styles for all placement chips
const CHIP_STYLES = `
  inline-flex items-center gap-1 px-2 py-0.5
  text-2xs font-medium rounded
  bg-accent-primary/20 text-accent-primary
  border border-accent-primary/30
  whitespace-nowrap
`;

// Placements that should render as a compact icon with tooltip instead of a chip
const COMPACT_PLACEMENTS: Set<UIComponentPlacement> = new Set([
  'tasks-sidebar-actions-left',
  'tasks-sidebar-actions-right',
]);

// JSX template for each placement chip
const createChipJsx = (placement: string): string => `
  (props) => (
    <div className="${CHIP_STYLES}">
      <span className="opacity-60">📍</span>
      <span>${placement}</span>
    </div>
  )
`;

// JSX template for compact icon placement with tooltip
const createCompactIconJsx = (placement: string): string => `
  (props) => (
    <props.ui.Tooltip content="${placement}">
      <div className="p-1.5 rounded-md hover:bg-bg-tertiary transition-colors cursor-default">
        <span className="opacity-60 text-sm">📍</span>
      </div>
    </props.ui.Tooltip>
  )
`;

// JSX for the task-message placement — demonstrates custom message rendering
const TASK_MESSAGE_JSX = `
  (props) => {
    const message = props.message;
    if (!message) return null;

    const typeColors = {
      user: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      response: 'bg-green-500/20 text-green-400 border-green-500/30',
      'assistant-group': 'bg-green-500/20 text-green-400 border-green-500/30',
      tool: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      log: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      loading: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    };

    const toolColorClass = typeColors['tool'] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    const colorClass = typeColors[message.type] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';

    const renderToolMessage = (toolMsg) => (
      <div key={toolMsg.id} className={\`rounded-md border p-2 text-xs \${toolColorClass}\`}>
        <div className="flex items-center gap-1 mb-1">
          <span className="opacity-60">📍</span>
          <span className="font-medium">{toolMsg.serverName}/{toolMsg.toolName}</span>
        </div>
        <pre className="whitespace-pre-wrap opacity-80 max-h-24 overflow-auto text-2xs">
          {typeof toolMsg.content === 'string' ? toolMsg.content.slice(0, 200) : ''}
        </pre>
      </div>
    );

    return (
      <div className="rounded-md border p-2 text-xs border-dashed" style={{ borderColor: 'currentColor' }}>
        <div className="flex items-center gap-1 mb-1">
          <span className="opacity-60">📍</span>
          <span className="font-medium">task-message</span>
          <span className="opacity-60">(custom renderer for: {message.type})</span>
        </div>
        {message.type === 'assistant-group' && message.responseMessage && (
          <div className={\`rounded-md border p-2 text-xs mb-1 \${colorClass}\`}>
            <pre className="whitespace-pre-wrap opacity-80 max-h-24 overflow-auto text-2xs">
              {typeof message.responseMessage.content === 'string' ? message.responseMessage.content.slice(0, 200) : ''}
            </pre>
          </div>
        )}
        {message.type === 'assistant-group' && message.toolMessages?.length > 0 && (
          <div className="space-y-1">
            {message.toolMessages.map(renderToolMessage)}
          </div>
        )}
        {message.type !== 'assistant-group' && (
          <pre className="whitespace-pre-wrap opacity-80 max-h-24 overflow-auto text-2xs">
            {typeof message.content === 'string' ? message.content.slice(0, 200) : ''}
          </pre>
        )}
      </div>
    );
  }
`;

// JSX for the task-floating placement — panel with checkboxes controlling togglable placements
const TASK_FLOATING_PANEL_JSX = `
  (props) => {
    return (
      <div className="p-3 space-y-3">
        <p className="text-xs text-text-secondary">
          {props.task ? 'Task: ' + props.task.name : 'No task context'}
        </p>
      </div>
    );
  }
`;

const PROJECT_FLOATING_PANEL_JSX = `
  (props) => {
    const data = props.data || {};
    const enabledPlacements = data.enabledPlacements || {};

    return (
      <div className="p-3 space-y-3">
        <p className="text-xs text-text-secondary">
          Project-wide panel (persists across task switches)
        </p>
        <div className="space-y-1.5">
          <p className="text-2xs text-text-muted font-medium uppercase tracking-wider">Project Floating</p>
          <p className="text-2xs text-text-muted">Enabled placements: {Object.keys(enabledPlacements).length}</p>
        </div>
      </div>
    );
  }
`;

const APP_FLOATING_PANEL_JSX = `
  (props) => {
    const { useCallback } = React;
    const data = props.data || {};
    const enabledPlacements = data.enabledPlacements || {};

    const handleToggle = useCallback((placement) => {
      props.executeExtensionAction('toggle-placement', placement);
    }, []);

    const toggleItems = ${JSON.stringify(TOGGLABLE_PLACEMENTS)}.map((placement) => ({
      placement,
      enabled: !!enabledPlacements[placement],
    }));

    return (
      <div className="p-3 space-y-3">
        <p className="text-xs text-text-secondary">
          App-wide panel (persists across projects)
        </p>
        <div className="space-y-1.5">
          <p className="text-2xs text-text-muted font-medium uppercase tracking-wider">App Floating</p>
          <p className="text-2xs text-text-muted">Always available regardless of project or task</p>
        </div>
        <div className="space-y-1.5">
          <p className="text-2xs text-text-muted font-medium uppercase tracking-wider">Togglable Placements</p>
          {toggleItems.map((item) => (
            <props.ui.Checkbox checked={item.enabled} onChange={() => handleToggle(item.placement)} label={item.placement}/>
          ))}
        </div>
      </div>
    );
  }
`;

export default class UIPlacementDemoExtension implements Extension {
  static metadata = {
    name: 'UI Placement Demo',
    version: '1.5.0',
    description: 'Demonstrates all available UI component placement locations in AiderDesk for extension development',
    author: 'wladimiiir',
    iconUrl: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/ui-placement-demo.png',
    capabilities: ['ui', 'example'],
  };

  private enabledPlacements: Record<string, boolean> = {};

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('UI Placement Demo Extension loaded', 'info');
  }

  getUIComponents(_context: ExtensionContext): UIComponentDefinition[] {
    const alwaysOn = ALWAYS_ON_PLACEMENTS.map((placement) => ({
      id: `placement-demo-${placement}`,
      placement,
      jsx: COMPACT_PLACEMENTS.has(placement) ? createCompactIconJsx(placement) : createChipJsx(placement),
    }));

    const togglable = TOGGLABLE_PLACEMENTS
      .filter((placement) => !!this.enabledPlacements[placement])
      .map((placement) => {
        const def: UIComponentDefinition = {
          id: `placement-demo-${placement}`,
          placement,
          jsx: placement === 'task-message' ? TASK_MESSAGE_JSX : createChipJsx(placement),
        };

        if (placement === 'task-message') {
          def.messageFilter = {
            types: ['user', 'response', 'assistant-group', 'tool', 'log', 'loading'],
          } as MessageFilter;
        }

        return def;
      });

    const taskFloating: UIComponentDefinition = {
      id: TASK_FLOATING_COMPONENT_ID,
      placement: 'task-floating',
      name: 'Placement Demo (Task)',
      loadData: true,
      noDataCache: true,
      jsx: TASK_FLOATING_PANEL_JSX,
    };

    const projectFloating: UIComponentDefinition = {
      id: PROJECT_FLOATING_COMPONENT_ID,
      placement: 'project-floating',
      name: 'Placement Demo (Project)',
      loadData: true,
      noDataCache: true,
      jsx: PROJECT_FLOATING_PANEL_JSX,
    };

    const appFloating: UIComponentDefinition = {
      id: APP_FLOATING_COMPONENT_ID,
      placement: 'app-floating',
      name: 'Placement Demo (App)',
      loadData: true,
      noDataCache: true,
      jsx: APP_FLOATING_PANEL_JSX,
    };

    return [...alwaysOn, ...togglable, taskFloating, projectFloating, appFloating];
  }

  async getUIExtensionData(componentId: string, _context: ExtensionContext): Promise<unknown> {
    if (componentId === APP_FLOATING_COMPONENT_ID || componentId === PROJECT_FLOATING_COMPONENT_ID) {
      return { enabledPlacements: this.enabledPlacements };
    }
    return null;
  }

  async executeUIExtensionAction(
    _componentId: string,
    action: string,
    args: unknown[],
    context: ExtensionContext,
  ): Promise<unknown> {
    if (action === 'toggle-placement' && typeof args[0] === 'string') {
      const placement = args[0];
      this.enabledPlacements[placement] = !this.enabledPlacements[placement];
      context.triggerUIComponentsReload();
      context.triggerUIDataRefresh(APP_FLOATING_COMPONENT_ID);
      context.triggerUIDataRefresh(PROJECT_FLOATING_COMPONENT_ID);
    }
    return null;
  }
}

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

import type { Extension, ExtensionContext, UIComponentDefinition, UIComponentPlacement } from '@aiderdesk/extensions';

// All available placements - update this list as new placements are added
const ALL_PLACEMENTS: UIComponentPlacement[] = [
  // Existing placements
  'task-status-bar-left',
  'task-status-bar-right',
  'task-usage-info-bottom',
  // Chat/Message area
  'task-messages-top',
  'task-messages-bottom',
  'task-message-above',
  'task-message-below',
  'task-message-bar',
  // Input area
  'task-input-above',
  'task-input-toolbar-left',
  'task-input-toolbar-right',
  // Task top bar
  'task-top-bar-left',
  'task-top-bar-right',
  // Sidebar
  'tasks-sidebar-header',
  'tasks-sidebar-bottom',
  'tasks-sidebar-actions-left',
  'tasks-sidebar-actions-right',
  // Header
  'header-left',
  'header-right',
  // Task State
  'task-state-actions',
  'task-state-actions-all',
  // Welcome
  'welcome-page',
  // Floating
  'floating',
];

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

// JSX template for the floating placement — content only, panel chrome is automatic
const FLOATING_PANEL_JSX = `
  (props) => {
    const { useState, useCallback } = React;
    const [items, setItems] = useState([
      { id: 1, text: 'Drag me by the title bar', done: false },
      { id: 2, text: 'Resize from any edge or corner', done: false },
      { id: 3, text: 'Minimize with the minus button', done: true },
    ]);

    const toggleItem = useCallback((id) => {
      setItems((prev) => prev.map((item) => item.id === id ? { ...item, done: !item.done } : item));
    }, []);

    return (
      <div className="p-3 space-y-2">
        <p className="text-xs text-text-secondary">
          Task: <span className="text-text-primary font-medium">{props.task?.name ?? 'none'}</span>
        </p>
        <div className="space-y-1">
          {items.map((item) => (
            <label key={item.id} className="flex items-center gap-2 text-xs cursor-pointer">
              <props.ui.Checkbox checked={item.done} onChange={() => toggleItem(item.id)} />
              <span className={item.done ? 'line-through text-text-secondary' : 'text-text-primary'}>{item.text}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }
`;

export default class UIPlacementDemoExtension implements Extension {
  static metadata = {
    name: 'UI Placement Demo',
    version: '1.3.0',
    description: 'Demonstrates all available UI component placement locations in AiderDesk for extension development',
    author: 'wladimiiir',
    iconUrl: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/ui-placement-demo.png',
    capabilities: ['ui', 'example'],
  };

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('UI Placement Demo Extension loaded', 'info');
  }

  getUIComponents(_context: ExtensionContext): UIComponentDefinition[] {
    return ALL_PLACEMENTS.map((placement) => ({
      id: `placement-demo-${placement}`,
      placement,
      ...(placement === 'floating' ? { name: 'Floating Demo' } : {}),
      jsx: placement === 'floating' ? FLOATING_PANEL_JSX : COMPACT_PLACEMENTS.has(placement) ? createCompactIconJsx(placement) : createChipJsx(placement),
    }));
  }
}

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
  // Header
  'header-left',
  'header-right',
  // Task State
  'task-state-actions',
];

// Shared styles for all placement chips
const CHIP_STYLES = `
  inline-flex items-center gap-1 px-2 py-0.5
  text-2xs font-medium rounded
  bg-accent-primary/20 text-accent-primary
  border border-accent-primary/30
  whitespace-nowrap
`;

// JSX template for each placement chip
const createChipJsx = (placement: string): string => `
  <div className="${CHIP_STYLES}">
    <span className="opacity-60">📍</span>
    <span>${placement}</span>
  </div>
`;

export default class UIPlacementDemoExtension implements Extension {
  static metadata = {
    name: 'UI Placement Demo',
    version: '1.0.0',
    description: 'Demonstrates all available UI component placement locations in AiderDesk for extension development',
    author: 'AiderDesk',
    capabilities: ['ui'],
  };

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('UI Placement Demo Extension loaded', 'info');
  }

  getUIComponents(_context: ExtensionContext): UIComponentDefinition[] {
    return ALL_PLACEMENTS.map((placement) => ({
      id: `placement-demo-${placement}`,
      placement,
      jsx: createChipJsx(placement),
    }));
  }
}

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import type { Extension, ExtensionContext, UIComponentDefinition, TaskUpdatedEvent, TaskCreatedEvent, TaskClosedEvent } from '@aiderdesk/extensions';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LIBRARY_SPEC = 'react-kanban-kit@^0.0.2-beta.7';
const COMPONENT_ID = 'kanban-board';

export default class KanbanExtension implements Extension {
  static metadata = {
    name: 'Kanban Board',
    version: '1.0.0',
    description: 'Kanban board for project tasks, grouped by task state',
    author: 'wladimiiir',
    capabilities: ['ui'],
    iconUrl: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/kanban/icon.png',
  };

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('Kanban Board Extension loaded', 'info');
  }

  async onTaskUpdated(_event: TaskUpdatedEvent, context: ExtensionContext): Promise<void> {
    context.triggerUIDataRefresh(COMPONENT_ID);
  }

  async onTaskCreated(_event: TaskCreatedEvent, context: ExtensionContext): Promise<void> {
    context.triggerUIDataRefresh(COMPONENT_ID);
  }

  async onTaskClosed(_event: TaskClosedEvent, context: ExtensionContext): Promise<void> {
    context.triggerUIDataRefresh(COMPONENT_ID);
  }

  getUIComponents(_context: ExtensionContext): UIComponentDefinition[] {
    const jsx = readFileSync(join(__dirname, './ui/KanbanBoard.jsx'), 'utf-8');

    return [
      {
        id: COMPONENT_ID,
        placement: 'tasks-sidebar-actions-left',
        jsx,
        loadData: true,
        noDataCache: true,
      },
    ];
  }

  getUIComponentsLibraries(): Record<string, string> {
    return {
      kanban: LIBRARY_SPEC,
    };
  }

  async getUIExtensionData(componentId: string, context: ExtensionContext): Promise<unknown> {
    if (componentId !== COMPONENT_ID) {
      return undefined;
    }

    try {
      const projectContext = context.getProjectContext();
      const tasks = await projectContext.getTasks();
      return {
        tasks: tasks
          .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
          .map((t) => ({
            id: t.id,
            name: t.name,
            state: t.state,
            model: t.model,
            parentId: t.parentId,
          })),
      };
    } catch {
      return { tasks: [] };
    }
  }

}

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import type { Extension, ExtensionContext, UIComponentDefinition } from '@aiderdesk/extensions';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const COMPONENT_ID = 'doom-panel';

export default class DoomExtension implements Extension {
  static metadata = {
    name: 'Doom',
    version: '1.0.0',
    description: 'Play DOOM while waiting for your agent to finish',
    author: 'wladimiiir',
    capabilities: ['ui'],
  };

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('Doom extension loaded', 'info');
  }

  getUIComponents(_context: ExtensionContext): UIComponentDefinition[] {
    const jsx = readFileSync(join(__dirname, './DoomPanel.jsx'), 'utf-8');

    return [
      {
        id: COMPONENT_ID,
        placement: 'app-floating',
        name: 'DOOM',
        jsx,
      },
    ];
  }
}

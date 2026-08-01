import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Handlebars from 'handlebars';

import type { Extension, ExtensionContext, PromptTemplateEvent } from '@aiderdesk/extensions';

const __dirname = import.meta.dirname;

const registerHelpers = () => {
  Handlebars.registerHelper('equals', (v1: unknown, v2: unknown) => v1 === v2);
  Handlebars.registerHelper('not', (v: unknown) => !v);
  Handlebars.registerHelper('assign', function (this: unknown, varName: string, varValue: unknown, options: { data: { root: Record<string, unknown> } }) {
    if (!options.data.root) {
      options.data.root = {};
    }
    options.data.root[varName] = varValue;
  });
  Handlebars.registerHelper('increment', function (this: unknown, varName: string, options: { data: { root: Record<string, unknown> } }) {
    const root = options.data.root;
    if (root[varName] !== undefined) {
      root[varName] = (root[varName] as number) + 1;
    }
  });
  Handlebars.registerHelper('cdata', (text: unknown) => {
    if (typeof text !== 'string') {
      return '';
    }
    return `<![CDATA[\n${text}\n]]>`;
  });
};

export default class LegacySystemPromptExtension implements Extension {
  static metadata = {
    name: 'Legacy System Prompt',
    version: '1.0.0',
    description: 'Restores the verbose pre-optimization system prompt and workflow — ideal for less capable models',
    iconUrl: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/legacy-system-prompt/icon.png',
    author: 'wladimiiir',
    capabilities: ['context'],
  };

  private systemPromptTemplate: HandlebarsTemplateDelegate;
  private workflowTemplate: HandlebarsTemplateDelegate;

  constructor() {
    registerHelpers();

    const systemPromptSource = readFileSync(join(__dirname, 'system-prompt.hbs'), 'utf-8');
    const workflowSource = readFileSync(join(__dirname, 'workflow.hbs'), 'utf-8');

    this.systemPromptTemplate = Handlebars.compile(systemPromptSource);
    this.workflowTemplate = Handlebars.compile(workflowSource);
  }

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('Legacy System Prompt extension loaded', 'info');
  }

  async onPromptTemplate(event: PromptTemplateEvent, context: ExtensionContext): Promise<void | Partial<PromptTemplateEvent>> {
    if (event.name === 'system-prompt') {
      context.log('Replacing system prompt with legacy version', 'debug');
      return { prompt: this.systemPromptTemplate(event.data) };
    }

    if (event.name === 'workflow') {
      context.log('Replacing workflow with legacy version', 'debug');
      return { prompt: this.workflowTemplate(event.data) };
    }

    return undefined;
  }
}

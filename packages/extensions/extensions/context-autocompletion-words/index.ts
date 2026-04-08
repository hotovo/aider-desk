/**
 * Context Autocompletion Words Extension
 *
 * Automatically extracts symbols from context files and adds them to autocompletion.
 */

import { extractSymbols } from '@aiderdesk/tree-sitter-utils';

import type { Extension, ExtensionContext, FilesAddedEvent, FilesDroppedEvent } from '@aiderdesk/extensions';

const DEBOUNCE_MS = 2000;

export default class ContextAutocompletionWordsExtension implements Extension {
  static metadata = {
    name: 'Context Autocompletion Words',
    version: '1.1.0',
    description: 'Automatically extracts symbols from context files and adds them to autocompletion',
    author: 'wladimiiir',
    capabilities: ['context'],
  };

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('Context Autocompletion Words Extension loaded', 'info');
  }

  async onFilesAdded(_event: FilesAddedEvent, context: ExtensionContext): Promise<void> {
    this.scheduleProcess(context);
  }

  async onFilesDropped(_event: FilesDroppedEvent, context: ExtensionContext): Promise<void> {
    this.scheduleProcess(context);
  }

  private scheduleProcess(context: ExtensionContext): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.processFiles(context);
    }, DEBOUNCE_MS);
  }

  private async processFiles(context: ExtensionContext): Promise<void> {
    const taskContext = context.getTaskContext();
    if (!taskContext) {
      context.log('No active task context available', 'debug');
      return;
    }

    const allContextFiles = await taskContext.getContextFiles();
    const filePaths = allContextFiles.map((f) => f.path);

    if (filePaths.length === 0) {
      await taskContext.updateAutocompletionWords([]);
      return;
    }

    try {
      context.log(`Extracting autocomplete symbols from ${filePaths.length} files`, 'info');

      const symbols = await extractSymbols(filePaths);

      if (symbols.length === 0) {
        context.log('No symbols found in the provided files', 'debug');
        return;
      }

      const autocompleteWords = this.filterAutocompleteSymbols(symbols);

      if (autocompleteWords.length === 0) {
        context.log('No autocomplete-relevant symbols found', 'debug');
        return;
      }

      context.log(`Adding ${autocompleteWords.length} autocomplete words`, 'info');
      await taskContext.updateAutocompletionWords(autocompleteWords);
    } catch (error) {
      context.log(`Error extracting autocomplete symbols: ${error}`, 'error');
    }
  }

  private filterAutocompleteSymbols(symbols: Awaited<ReturnType<typeof extractSymbols>>): string[] {
    const definitions = symbols.filter((s) => s.kind === 'def');

    const uniqueNames = new Set<string>();
    for (const symbol of definitions) {
      if (symbol.name && symbol.name.trim().length > 0) {
        uniqueNames.add(symbol.name.trim());
      }
    }

    return Array.from(uniqueNames);
  }
}

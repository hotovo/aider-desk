/**
 * Context Autocompletion Words Extension
 *
 * Automatically extracts symbols from context files and adds them to autocompletion.
 */

import { extractSymbols } from '@aiderdesk/tree-sitter-utils';

import type { ContextFile, Extension, ExtensionContext, FilesAddedEvent, FilesDroppedEvent } from '@aiderdesk/extensions';

export default class ContextAutocompletionWordsExtension implements Extension {
  static metadata = {
    name: 'Context Autocompletion Words',
    version: '1.0.0',
    description: 'Automatically extracts symbols from context files and adds them to autocompletion',
    author: 'wladimiiir',
    capabilities: ['context'],
  };

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('Context Autocompletion Words Extension loaded', 'info');
  }

  async onFilesAdded(event: FilesAddedEvent, context: ExtensionContext): Promise<void> {
    await this.processFiles(event.files, 'add', context);
  }

  async onFilesDropped(event: FilesDroppedEvent, context: ExtensionContext): Promise<void> {
    await this.processFiles(event.files, 'drop', context);
  }

  private async processFiles(
    files: ContextFile[],
    action: 'add' | 'drop',
    context: ExtensionContext,
  ): Promise<void> {
    const taskContext = context.getTaskContext();
    if (!taskContext) {
      context.log('No active task context available', 'debug');
      return;
    }

    const allContextFiles = await taskContext.getContextFiles();
    const existingPaths = new Set(allContextFiles.map((f) => f.path));
    const eventPaths = new Set(files.map((f) => f.path));

    let filePaths: string[];
    if (action === 'add') {
      filePaths = [...Array.from(existingPaths), ...Array.from(eventPaths)];
    } else {
      filePaths = Array.from(existingPaths).filter((path) => !eventPaths.has(path));
    }

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

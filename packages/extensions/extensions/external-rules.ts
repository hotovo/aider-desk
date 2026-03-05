/**
 * External Rules Extension
 *
 * Discovers and includes rule files from external AI coding assistant configurations.
 * Scans for rule files in:
 * - .cursor/rules/ (Cursor IDE rules)
 * - CLAUDE.md (Claude Code instructions)
 * - .roo/rules/ (Roo Code rules)
 *
 * This allows AiderDesk to respect project-specific rules from other AI tools,
 * providing a unified experience across different coding assistants.
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import type { Extension, ExtensionContext, RuleFilesRetrievedEvent } from '@aiderdesk/extensions';

// External rule directories to scan for .md and .mdc files
const EXTERNAL_RULE_DIRECTORIES = ['.cursor/rules', '.roo/rules'];

// Root-level rule files to include if they exist
const ROOT_RULE_FILES = ['CLAUDE.md'];

export default class ExternalRulesExtension implements Extension {
  static metadata = {
    name: 'External Rules Extension',
    version: '1.0.0',
    description: 'Includes rule files from Cursor, Claude Code, and Roo Code configurations',
    author: 'AiderDesk',
    capabilities: ['events'],
  };

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('External Rules Extension loaded', 'info');
  }

  async onRuleFilesRetrieved(event: RuleFilesRetrievedEvent, context: ExtensionContext): Promise<void | Partial<RuleFilesRetrievedEvent>> {
    const projectDir = context.getProjectDir();
    if (!projectDir) {
      context.log('No project directory available', 'warn');
      return undefined;
    }

    const additionalFiles = [];

    // Scan directory-based rule sources
    for (const rulesPath of EXTERNAL_RULE_DIRECTORIES) {
      const ruleFiles = this.scanRulesDirectory(projectDir, rulesPath, context);
      if (ruleFiles.length > 0) {
        additionalFiles.push(...ruleFiles);
        context.log(`Found ${ruleFiles.length} rule file(s) in ${rulesPath}`, 'info');
      }
    }

    // Check for root-level rule files
    for (const filename of ROOT_RULE_FILES) {
      const filePath = join(projectDir, filename);
      if (existsSync(filePath)) {
        additionalFiles.push({
          path: filename,
          readOnly: true,
          source: 'project-rule',
        });
        context.log(`Found ${filename}`, 'info');
      }
    }

    if (additionalFiles.length > 0) {
      context.log(`Added ${additionalFiles.length} external rule file(s) to context`, 'info');
      return {
        files: [...event.files, ...additionalFiles],
      };
    }

    return undefined;
  }

  private scanRulesDirectory(projectDir: string, rulesPath: string, context: ExtensionContext) {
    const fullRulesPath = join(projectDir, rulesPath);
    const ruleFiles = [];

    if (!existsSync(fullRulesPath)) {
      return ruleFiles;
    }

    try {
      const stat = statSync(fullRulesPath);
      if (!stat.isDirectory()) {
        return ruleFiles;
      }

      const files = readdirSync(fullRulesPath);
      for (const file of files) {
        if (file.endsWith('.md') || file.endsWith('.mdc')) {
          const relativePath = relative(projectDir, join(fullRulesPath, file));
          ruleFiles.push({
            path: relativePath,
            readOnly: true,
            source: 'project-rule',
          });
        }
      }
    } catch (error) {
      context.log(`Error scanning ${rulesPath}: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }

    return ruleFiles;
  }
}

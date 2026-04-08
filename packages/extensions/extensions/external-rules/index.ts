/**
 * External Rules Extension
 *
 * Discovers and includes rule files from external AI coding assistant configurations.
 * Rule sources are configured via the extension settings (comma-separated paths).
 * Directories are scanned for .md/.mdc files; individual files are added directly.
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import type { Extension, ExtensionContext, RuleFilesRetrievedEvent } from "@aiderdesk/extensions";

const configComponentJsx = readFileSync(join(__dirname, './ConfigComponent.jsx'), 'utf-8');

interface ExternalRulesConfig {
  ruleFolders: string;
}

export default class ExternalRulesExtension implements Extension {
  static metadata = {
    name: 'External Rules',
    version: '1.1.0',
    description: 'Includes rule files from Cursor, Claude Code, and Roo Code configurations',
    author: 'wladimiiir',
    iconUrl: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/external-rules/icon.png',
    capabilities: ['context'],
  };

  private configPath: string;

  constructor() {
    this.configPath = join(__dirname, 'config.json');
  }

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('External Rules Extension loaded', 'info');
  }

  getConfigComponent(): string {
    return configComponentJsx;
  }

  async getConfigData(): Promise<ExternalRulesConfig> {
    try {
      if (existsSync(this.configPath)) {
        const data = readFileSync(this.configPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch {
      // Ignore errors, return defaults
    }
    return { ruleFolders: '' };
  }

  async saveConfigData(configData: unknown): Promise<unknown> {
    const config = configData as Partial<ExternalRulesConfig>;
    writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
    return config;
  }

  async onRuleFilesRetrieved(event: RuleFilesRetrievedEvent, context: ExtensionContext): Promise<void | Partial<RuleFilesRetrievedEvent>> {
    const projectDir = context.getProjectDir();
    if (!projectDir) {
      context.log('No project directory available', 'warn');
      return undefined;
    }

    const config = await this.getConfigData();
    const rulePaths = config.ruleFolders
      ? config.ruleFolders.split(',').map((f) => f.trim()).filter(Boolean)
      : [];
    const additionalFiles = [];

    // Scan each path — handles both directories and individual files
    for (const rulesPath of rulePaths) {
      const ruleFiles = this.scanRulesPath(projectDir, rulesPath, context);
      if (ruleFiles.length > 0) {
        additionalFiles.push(...ruleFiles);
        context.log(`Found ${ruleFiles.length} rule file(s) from ${rulesPath}`, 'info');
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

  private scanRulesPath(projectDir: string, rulesPath: string, context: ExtensionContext) {
    const fullRulesPath = join(projectDir, rulesPath);
    const ruleFiles = [];

    if (!existsSync(fullRulesPath)) {
      return ruleFiles;
    }

    try {
      const stat = statSync(fullRulesPath);

      if (stat.isDirectory()) {
        // Scan directory for .md and .mdc files
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
      } else if (stat.isFile()) {
        // Add single file directly
        ruleFiles.push({
          path: rulesPath,
          readOnly: true,
          source: 'project-rule',
        });
      }
    } catch (error) {
      context.log(`Error scanning ${rulesPath}: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }

    return ruleFiles;
  }
}

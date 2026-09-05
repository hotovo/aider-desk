import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

import Handlebars from 'handlebars';

import type { ContextMessage, ExtensionContext } from '@aiderdesk/extensions';

import { loadBmadConfig } from './skill-preprocessor';
import { registerFileHelpers } from './file-helpers';
import { resolveSkillsDir } from './skills';

import type { CatalogEntry } from './install-registry';
import type { InstalledSkill } from './types';

export interface PreparedContext {
  contextMessages: ContextMessage[];
  contextFiles: string[];
  execute: boolean;
  taskName?: string;
}

/**
 * Used to detect whether a workflow/skill context has already been injected
 * into a conversation. Re-injecting the full template on every agent start
 * duplicates message ids and invalidates UI message references
 * (redo/regenerate), so continuation checks match on prompt-context ids.
 */
export const hasContextMessages = (
  messages: ContextMessage[],
  contextIds: string[],
): boolean => {
  return messages.some(
    (message) =>
      contextIds.some((id) => message.promptContext?.id === id) ||
      (message.role === 'user' &&
        typeof message.content === 'string' &&
        message.content.includes('[BMAD continuation]')),
  );
};

/**
 * Prepares the start context for BMAD workflows and skills (v2).
 *
 * There is exactly ONE generic start template: it loads the ORIGINAL
 * SKILL.md of the selected catalog entry (or any installed skill) and
 * instructs the agent to follow it exactly. All method knowledge — steps,
 * files to read, artifacts to write — lives in the installed method's own
 * skill files; the extension adds nothing on top.
 */
export class ContextPreparer {
  constructor(
    private readonly projectDir: string,
    private readonly context: ExtensionContext,
  ) {}

  /**
   * Prepare context for a menu entry of the installed method.
   */
  async prepareEntry(entry: CatalogEntry): Promise<PreparedContext> {
    return this.prepare({
      skillId: entry.skillId,
      // Directory name of the backing skill on disk
      skillName: leafNameOf(entry.skillPath),
      skillModule: existingConfigModule(this.projectDir, entry.module),
      skillPath: entry.skillPath,
      entryName: entry.name,
      actionHint: entry.action ?? undefined,
    });
  }

  /**
   * Prepare context for an arbitrary installed skill (no menu row).
   */
  async prepareSkill(skill: InstalledSkill): Promise<PreparedContext> {
    return this.prepare({
      skillId: skill.id,
      skillName: leafNameOf(skill.skillPath),
      skillModule: existingConfigModule(this.projectDir, skill.module),
      skillPath: skill.skillPath,
      entryName: skill.name,
    });
  }

  private async prepare(vars: {
    skillId: string;
    skillName: string;
    skillModule: string;
    skillPath: string;
    entryName: string;
    actionHint?: string;
  }): Promise<PreparedContext> {
    const context: PreparedContext = {
      contextMessages: [],
      contextFiles: [],
      execute: true,
      taskName: vars.entryName,
    };

    const injected = await this.injectTemplate('workflow-start', context, vars);
    if (!injected) {
      throw new Error(`Failed to prepare context for '${vars.entryName}'`);
    }

    return context;
  }

  private async injectTemplate(
    templateName: string,
    context: PreparedContext,
    extraData: Record<string, unknown>,
  ): Promise<boolean> {
    try {
      const templatePath = join(__dirname, '..', 'context', `${templateName}.json.hbs`);
      const templateSource = await fs.readFile(templatePath, 'utf-8');

      const skillsDir = resolveSkillsDir(this.projectDir);
      if (!skillsDir) {
        this.context.log('No BMAD skills directory found - is bmad-method 6.10+ installed?', 'warn');
      }

      const bmadConfig = loadBmadConfig(this.projectDir);

      registerFileHelpers();

      const template = Handlebars.compile(templateSource, {
        noEscape: true,
      });

      const rendered = template({ projectDir: this.projectDir, skillsDir, bmadConfig, ...extraData });
      const messages = JSON.parse(rendered) as ContextMessage[];

      context.contextMessages = messages.map((msg) => ({ ...msg }));

      return true;
    } catch (error) {
      this.context.log(`Failed to load context template: ${error instanceof Error ? error.message : String(error)}`, 'error');
      return false;
    }
  }
}

/** Extract the skill directory name from a '<skillsDir>/<leaf>/SKILL.md' path. */
const leafNameOf = (skillPath: string): string => {
  const parts = skillPath.replace(/\\/g, '/').split('/');
  return parts[parts.length - 2] || parts[0];
};

/**
 * The start template reads '_bmad/<module>/config.yaml' as context. Modules
 * without their own config fall back to core so the template never fails on
 * a missing file.
 */
const existingConfigModule = (projectDir: string, moduleCode: string): string => {
  return existsSync(join(projectDir, '_bmad', moduleCode, 'config.yaml')) ? moduleCode : 'core';
};

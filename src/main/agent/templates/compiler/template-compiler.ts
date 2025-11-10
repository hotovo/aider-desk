import fs from 'fs/promises';
import path from 'path';

import Handlebars from 'handlebars';

import { registerAllHelpers } from '../helpers';

import { RESOURCES_DIR } from '@/constants';
import logger from '@/logger';

export interface CompiledTemplate {
  name: string;
  template: HandlebarsTemplateDelegate;
  sourcePath: string;
}

export class TemplateCompiler {
  private compiledTemplates = new Map<string, CompiledTemplate>();
  private templatesDir: string;

  constructor(templatesDir: string = path.join(RESOURCES_DIR, 'templates')) {
    this.templatesDir = templatesDir;
    registerAllHelpers();
  }

  /**
   * Find all .hbs template files recursively
   */
  private async findTemplateFiles(): Promise<string[]> {
    const templateFiles: string[] = [];

    const findFiles = async (dir: string): Promise<void> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await findFiles(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.hbs')) {
          templateFiles.push(fullPath);
        }
      }
    };

    await findFiles(this.templatesDir);
    return templateFiles;
  }

  /**
   * Compile a single template file
   */
  private async compileTemplate(filePath: string): Promise<CompiledTemplate> {
    const relativePath = path.relative(this.templatesDir, filePath);
    const templateName = relativePath.replace(/\\/g, '/').replace('.hbs', '');

    try {
      const source = await fs.readFile(filePath, 'utf8');
      const template = Handlebars.compile(source, {
        strict: true,
        noEscape: true, // We handle escaping ourselves where needed
      });

      return {
        name: templateName,
        template,
        sourcePath: filePath,
      };
    } catch (error) {
      throw new Error(`Failed to compile template ${templateName}: ${error}`);
    }
  }

  /**
   * Compile all template files
   */
  async compileAll(): Promise<void> {
    logger.info('Compiling Handlebars templates...');

    try {
      // First register partials
      await this.registerPartials();

      const templateFiles = await this.findTemplateFiles();

      for (const filePath of templateFiles) {
        const compiled = await this.compileTemplate(filePath);
        this.compiledTemplates.set(compiled.name, compiled);
        logger.info(`✓ Compiled template: ${compiled.name}`);
      }

      logger.info(`Successfully compiled ${this.compiledTemplates.size} templates`);
    } catch (error) {
      logger.error('Template compilation failed:', error);
      throw error;
    }
  }

  /**
   * Get a compiled template by name
   */
  getTemplate(templateName: string): CompiledTemplate | undefined {
    return this.compiledTemplates.get(templateName);
  }

  /**
   * Render a template with data
   */
  render(templateName: string, data: unknown): string {
    const compiled = this.getTemplate(templateName);
    if (!compiled) {
      throw new Error(`Template '${templateName}' not found. Available templates: ${Array.from(this.compiledTemplates.keys()).join(', ')}`);
    }

    try {
      // Type assertion to satisfy Handlebars template delegate
      return compiled.template(data as Record<string, unknown>);
    } catch (error) {
      throw new Error(`Error rendering template '${templateName}': ${error}`);
    }
  }

  /**
   * Get all compiled template names
   */
  getTemplateNames(): string[] {
    return Array.from(this.compiledTemplates.keys());
  }

  /**
   * Check if template exists
   */
  hasTemplate(templateName: string): boolean {
    return this.compiledTemplates.has(templateName);
  }

  /**
   * Clear all compiled templates (useful for hot reloading)
   */
  clear(): void {
    this.compiledTemplates.clear();
  }

  /**
   * Register Handlebars partials
   */
  private async registerPartials(): Promise<void> {
    const partialsDir = path.join(this.templatesDir, 'system');

    try {
      await fs.access(partialsDir);
      const partialFiles = await fs.readdir(partialsDir);

      for (const file of partialFiles) {
        if (file.endsWith('.hbs')) {
          const partialPath = path.join(partialsDir, file);
          const relativePath = path.relative(this.templatesDir, partialPath);
          const partialName = relativePath.replace(/\\/g, '/').replace('.hbs', '');
          const partialContent = await fs.readFile(partialPath, 'utf8');

          Handlebars.registerPartial(partialName, partialContent);
          logger.info(`✓ Registered partial: ${partialName}`);
        }
      }
    } catch {
      // Directory doesn't exist, skip partial registration
      logger.info('Partials directory not found, skipping partial registration');
    }
  }

  /**
   * Watch templates for changes (development mode)
   */
  async watchTemplates(callback: () => void): Promise<void> {
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
      const chokidar = await import('chokidar');
      const watcher = chokidar.watch(path.join(this.templatesDir, '**/*.hbs'));

      watcher.on('change', async () => {
        logger.info('Template files changed, recompiling...');
        this.clear();
        await this.compileAll();
        callback();
      });

      logger.info('Watching template files for changes...');
    }
  }
}

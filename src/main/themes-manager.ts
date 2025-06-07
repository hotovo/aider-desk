import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { Theme } from '@common/types';
import defaultThemes from '@common/themes/themes.json';

import logger from './logger';

export class ThemesManager {
  private themesFilePath: string;

  constructor() {
    this.themesFilePath = path.join(app.getPath('userData'), 'themes.json');
  }

  async loadThemes(): Promise<{ themes: Theme[] }> {
    try {
      if (fs.existsSync(this.themesFilePath)) {
        const themesData = await fs.promises.readFile(this.themesFilePath, 'utf-8');
        return JSON.parse(themesData);
      }
      
      // If no custom themes file exists, create one with default themes
      await this.saveThemes(defaultThemes.themes as Theme[]);
      return { themes: defaultThemes.themes as Theme[] };
    } catch (error) {
      logger.error('Failed to load themes:', error);
      return { themes: defaultThemes.themes as Theme[] };
    }
  }

  async saveThemes(themes: Theme[]): Promise<void> {
    try {
      await fs.promises.writeFile(
        this.themesFilePath,
        JSON.stringify({ themes }, null, 2),
        'utf-8'
      );
      logger.info('Themes saved successfully');
    } catch (error) {
      logger.error('Failed to save themes:', error);
      throw error;
    }
  }
}
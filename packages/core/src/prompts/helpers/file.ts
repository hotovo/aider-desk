import fs from 'fs';
import path from 'path';

import Handlebars from 'handlebars';

export const registerFileHelpers = (): void => {
  Handlebars.registerHelper('fileContent', (filePath: string, options: Handlebars.HelperOptions) => {
    const projectDir = options.data?.root?.projectDir;
    if (!projectDir) {
      throw new Error('fileContent helper requires projectDir in context');
    }

    const absolutePath = path.resolve(projectDir, filePath);
    try {
      return JSON.stringify(fs.readFileSync(absolutePath, 'utf8'));
    } catch (error) {
      throw new Error(`Failed to read file ${absolutePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
};

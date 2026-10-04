import * as fs from 'fs';
import * as path from 'path';

export const atomicWriteJsonFile = async (filePath: string, data: unknown): Promise<void> => {
  const dir = path.dirname(filePath);
  await fs.promises.mkdir(dir, { recursive: true });

  const baseName = path.basename(filePath);
  const temporaryPath = path.join(dir, `${baseName}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`);
  await fs.promises.writeFile(temporaryPath, JSON.stringify(data, null, 2), 'utf8');
  await fs.promises.rename(temporaryPath, filePath);
};

export const cleanupStaleTempFiles = async (filePath: string): Promise<void> => {
  const dir = path.dirname(filePath);
  try {
    const baseName = path.basename(filePath);
    const files = await fs.promises.readdir(dir);
    for (const file of files) {
      if (file.startsWith(`${baseName}.`) && file.endsWith('.tmp')) {
        await fs.promises.unlink(path.join(dir, file)).catch(() => undefined);
      }
    }
  } catch {
    return;
  }
};

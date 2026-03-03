import * as fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface RepoMapConfig {
  maxLines: number;
  exclude: string[];
}

const DEFAULT_CONFIG: RepoMapConfig = {
  maxLines: 2000,
  exclude: ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
};

const CONFIG_FILE = path.join(__dirname, 'config.json');

export const loadConfig = async (): Promise<RepoMapConfig> => {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(data);
    return { ...DEFAULT_CONFIG, ...config };
  } catch {
    // Return default config if file doesn't exist or is invalid
    return { ...DEFAULT_CONFIG };
  }
};

export const saveConfig = async (config: RepoMapConfig): Promise<void> => {
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
};

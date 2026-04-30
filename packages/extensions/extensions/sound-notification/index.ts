import { exec } from 'child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import https from 'https';

import type { Extension, ExtensionContext, PromptFinishedEvent, QuestionAskedEvent } from '@aiderdesk/extensions';

const execAsync = promisify(exec);

const PACKS_URL = 'https://raw.githubusercontent.com/PeonPing/og-packs/main';
const CACHE_DIR = join(tmpdir(), 'aider-desk-sound-notification');
const CONFIG_COMPONENT_ID = 'sound-config';

interface PackSound {
  file: string;
  label: string;
  sha256: string;
}

interface SoundPack {
  name: string;
  displayName: string;
  sounds: PackSound[];
}

interface SoundConfig {
  pack: string;
  sound: string;
}

interface ExtensionConfig {
  agentFinished: SoundConfig;
  questionAsked: SoundConfig;
}

const DEFAULT_CONFIG: ExtensionConfig = {
  agentFinished: { pack: 'peasant', sound: 'PeasantJobDone' },
  questionAsked: { pack: 'peasant', sound: '' },
};

const configComponentJsx = readFileSync(join(__dirname, 'ConfigComponent.jsx'), 'utf-8');
const bundledPacks: SoundPack[] = JSON.parse(readFileSync(join(__dirname, 'packs.json'), 'utf-8'));

export default class SoundNotificationExtension implements Extension {
  static metadata = {
    name: 'Sound Notification',
    version: '2.0.0',
    description: 'Plays sound notifications using packs from og-packs',
    icon: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/sound-notification/icon.png',
    capabilities: ['notifications'],
  };

  private configPath: string;

  constructor() {
    this.configPath = join(__dirname, 'config.json');
  }

  async onLoad(context: ExtensionContext): Promise<void> {
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true });
    }
    context.log('Sound notification extension loaded', 'info');
  }

  getConfigComponent(): string {
    return configComponentJsx;
  }

  async getConfigData(): Promise<unknown> {
    let config = { ...DEFAULT_CONFIG };

    try {
      if (existsSync(this.configPath)) {
        const data = readFileSync(this.configPath, 'utf-8');
        config = { ...DEFAULT_CONFIG, ...JSON.parse(data) };
      }
    } catch {
      // Ignore errors, use defaults
    }

    return { ...config, packs: bundledPacks };
  }

  async saveConfigData(configData: unknown): Promise<unknown> {
    const data = configData as Partial<ExtensionConfig> & { packs?: SoundPack[] };
    const { packs: _, ...userConfig } = data;
    const merged = { ...DEFAULT_CONFIG, ...userConfig };
    writeFileSync(this.configPath, JSON.stringify(merged, null, 2), 'utf-8');

    // Eagerly download selected WAVs
    await this.downloadSoundIfNeeded(merged.agentFinished);
    await this.downloadSoundIfNeeded(merged.questionAsked);

    return merged;
  }

  async executeUIExtensionAction(componentId: string, action: string, args: unknown[], context: ExtensionContext): Promise<unknown> {
    if (componentId !== CONFIG_COMPONENT_ID && componentId !== 'config' && componentId !== this.extensionId) {
      return undefined;
    }

    if (action === 'play-sound') {
      const [packName, soundName] = args as [string, string];
      await this.playSound(packName, soundName, context);
      return { success: true };
    }

    if (action === 'refresh-packs') {
      return await this.refreshPacks(context);
    }

    return undefined;
  }

  async onPromptFinished(_event: PromptFinishedEvent, context: ExtensionContext): Promise<void> {
    const config = await this.loadConfig();
    try {
      await this.playEventSound(config.agentFinished, context);
    } catch (error) {
      context.log(`Failed to play agent finished sound: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  }

  async onQuestionAsked(_event: QuestionAskedEvent, context: ExtensionContext): Promise<void> {
    const config = await this.loadConfig();
    try {
      await this.playEventSound(config.questionAsked, context);
    } catch (error) {
      context.log(`Failed to play question asked sound: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  }

  private async loadConfig(): Promise<ExtensionConfig> {
    try {
      if (existsSync(this.configPath)) {
        const data = readFileSync(this.configPath, 'utf-8');
        return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
      }
    } catch {
      // Ignore
    }
    return { ...DEFAULT_CONFIG };
  }

  private async playEventSound(soundConfig: SoundConfig, context: ExtensionContext): Promise<void> {
    const pack = bundledPacks.find((p) => p.name === soundConfig.pack);
    if (!pack) {
      context.log(`Sound pack "${soundConfig.pack}" not found`, 'warn');
      return;
    }

    const soundEntry = pack.sounds.find((s) => {
      const fileName = s.file.split('/').pop();
      return fileName?.replace(/\.(wav|mp3)$/, '') === soundConfig.sound;
    });

    if (!soundEntry) {
      context.log(`Sound "${soundConfig.sound}" not found in pack "${soundConfig.pack}"`, 'warn');
      return;
    }

    const soundFile = soundEntry.file;
    const extension = soundFile.split('.').pop() || 'wav';
    const cachePath = join(CACHE_DIR, soundConfig.pack, `${soundConfig.sound}.${extension}`);

    if (!existsSync(cachePath)) {
      await this.downloadSound(soundConfig.pack, soundFile, cachePath, context);
    }

    await this.playAudioFile(cachePath, context);
  }

  private async downloadSoundIfNeeded(soundConfig: SoundConfig): Promise<void> {
    const pack = bundledPacks.find((p) => p.name === soundConfig.pack);
    if (!pack) return;

    const soundEntry = pack.sounds.find((s) => {
      const fileName = s.file.split('/').pop();
      return fileName?.replace(/\.(wav|mp3)$/, '') === soundConfig.sound;
    });
    if (!soundEntry) return;

    const extension = soundEntry.file.split('.').pop() || 'wav';
    const cachePath = join(CACHE_DIR, soundConfig.pack, `${soundConfig.sound}.${extension}`);

    if (!existsSync(cachePath)) {
      const packDir = join(CACHE_DIR, soundConfig.pack);
      if (!existsSync(packDir)) {
        mkdirSync(packDir, { recursive: true });
      }
      await this.downloadFile(
        `${PACKS_URL}/${soundConfig.pack}/${soundEntry.file}`,
        cachePath,
      );
    }
  }

  private async downloadSound(packName: string, soundFile: string, cachePath: string, context: ExtensionContext): Promise<void> {
    const packDir = join(CACHE_DIR, packName);
    if (!existsSync(packDir)) {
      mkdirSync(packDir, { recursive: true });
    }

    const url = `${PACKS_URL}/${packName}/${soundFile}`;
    context.log(`Downloading sound: ${url}`, 'debug');
    await this.downloadFile(url, cachePath);
  }

  private downloadFile(url: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = createWriteStream(destPath);
      const request = https.get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            https
              .get(redirectUrl, (redirectResponse) => {
                redirectResponse.pipe(file);
                file.on('finish', () => {
                  file.close();
                  resolve();
                });
              })
              .on('error', reject);
            return;
          }
        }

        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      });

      request.on('error', reject);
      request.setTimeout(30000, () => {
        request.destroy();
        reject(new Error('Download timeout'));
      });
    });
  }

  private async playSound(packName: string, soundName: string, context: ExtensionContext): Promise<void> {
    const pack = bundledPacks.find((p) => p.name === packName);
    if (!pack) {
      context.log(`Sound pack "${packName}" not found`, 'warn');
      return;
    }

    const soundEntry = pack.sounds.find((s) => {
      const fileName = s.file.split('/').pop();
      return fileName?.replace(/\.(wav|mp3)$/, '') === soundName;
    });

    if (!soundEntry) {
      context.log(`Sound "${soundName}" not found in pack "${packName}"`, 'warn');
      return;
    }

    const extension = soundEntry.file.split('.').pop() || 'wav';
    const cachePath = join(CACHE_DIR, packName, `${soundName}.${extension}`);

    if (!existsSync(cachePath)) {
      await this.downloadSound(packName, soundEntry.file, cachePath, context);
    }

    await this.playAudioFile(cachePath, context);
  }

  private async playAudioFile(filePath: string, context: ExtensionContext): Promise<void> {
    const platform = process.platform;
    let command: string;

    switch (platform) {
      case 'darwin':
        command = `afplay "${filePath}"`;
        break;
      case 'win32':
        command = `powershell -c "Add-Type -AssemblyName presentationCore; $player = New-Object System.Windows.Media.MediaPlayer; $player.Open('${filePath.replace(/\\/g, '\\\\')}'); $player.Play(); Start-Sleep -Seconds 3"`;
        break;
      case 'linux':
        command = `paplay "${filePath}" 2>/dev/null || mpg123 --quiet "${filePath}" 2>/dev/null || mpv --no-video --really-quiet "${filePath}" 2>/dev/null || ffplay -nodisp -autoexit -loglevel quiet "${filePath}" 2>/dev/null`;
        break;
      default:
        context.log(`Unsupported platform: ${platform}`, 'warn');
        return;
    }

    try {
      await execAsync(command, { timeout: 10000 });
      context.log('Sound played successfully', 'debug');
    } catch {
      if (platform === 'linux') {
        try {
          await execAsync(`aplay "${filePath}" 2>/dev/null`, { timeout: 10000 });
          return;
        } catch {
          // All players failed
        }
        context.log('Failed to play sound: no audio player available', 'warn');
      } else {
        context.log('Failed to play sound', 'warn');
      }
    }
  }

  private async refreshPacks(context: ExtensionContext): Promise<SoundPack[]> {
    context.log('Refreshing sound packs from GitHub...', 'info');

    try {
      const contentsUrl = 'https://api.github.com/repos/PeonPing/og-packs/contents';
      const response = await this.fetchJson(contentsUrl);

      if (!Array.isArray(response)) {
        throw new Error('Unexpected API response');
      }

      const dirs = response.filter((item: { type: string }) => item.type === 'dir' && item.name !== '.github');
      const newPacks: SoundPack[] = [];

      for (const dir of dirs) {
        const packName = dir.name;
        try {
          const openpeonUrl = `${PACKS_URL}/${packName}/openpeon.json`;
          const data = await this.fetchJson(openpeonUrl);

          const seen = new Set<string>();
          const sounds: PackSound[] = [];

          if (data.categories) {
            for (const cat of Object.values(data.categories) as { sounds?: PackSound[] }[]) {
              if (cat.sounds) {
                for (const s of cat.sounds) {
                  if (!seen.has(s.file)) {
                    seen.add(s.file);
                    sounds.push({ file: s.file, label: s.label, sha256: s.sha256 });
                  }
                }
              }
            }
          }

          newPacks.push({
            name: packName,
            displayName: data.display_name || packName,
            sounds,
          });
        } catch {
          context.log(`Failed to fetch pack: ${packName}`, 'warn');
        }
      }

      writeFileSync(join(__dirname, 'packs.json'), JSON.stringify(newPacks, null, 2), 'utf-8');

      // Update bundled packs
      bundledPacks.length = 0;
      bundledPacks.push(...newPacks);

      context.log(`Refreshed ${newPacks.length} packs from GitHub`, 'info');
      return newPacks;
    } catch (error) {
      context.log(`Failed to refresh packs: ${error instanceof Error ? error.message : String(error)}`, 'error');
      return bundledPacks;
    }
  }

  private fetchJson(url: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      https.get(url, { headers: { 'User-Agent': 'AiderDesk' } }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
  }
}

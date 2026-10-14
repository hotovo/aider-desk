import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import https from 'https';

import type { Extension, ExtensionContext, PromptFinishedEvent, QuestionAskedEvent } from '@aiderdesk/extensions';

import { playAudio, SoundSource, storeUploadedAudio, validateAudioPath } from './audio';

const PACKS_URL = 'https://raw.githubusercontent.com/PeonPing/og-packs/main';
const CACHE_DIR = join(__dirname, 'data', 'cache');
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
  source?: SoundSource;
  filePath?: string;
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
    version: '2.2.0',
    description: 'Plays sound notifications using og-packs or custom audio files',
    iconUrl: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/sound-notification/icon.png',
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
    const data = configData as Partial<ExtensionConfig> & {
      packs?: SoundPack[];
    };
    const { packs: _, ...userConfig } = data;
    const merged = { ...DEFAULT_CONFIG, ...userConfig };

    for (const soundConfig of [merged.agentFinished, merged.questionAsked]) {
      if (soundConfig.source === SoundSource.Custom && soundConfig.filePath) {
        validateAudioPath(soundConfig.filePath);
      }
    }

    // Eagerly download selected WAVs
    await this.downloadSoundIfNeeded(merged.agentFinished);
    await this.downloadSoundIfNeeded(merged.questionAsked);

    writeFileSync(this.configPath, JSON.stringify(merged, null, 2), 'utf-8');
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

    if (action === 'upload-audio') {
      try {
        const filePath = storeUploadedAudio(args[0], args[1]);
        return { success: true, filePath };
      } catch (error) {
        context.log(`Failed to upload audio: ${error instanceof Error ? error.message : String(error)}`, 'error');
        return { success: false };
      }
    }

    if (action === 'play-custom-sound') {
      try {
        const [filePath] = args;
        if (typeof filePath !== 'string') {
          throw new Error('Invalid audio path.');
        }
        validateAudioPath(filePath);
        await this.playAudioFile(filePath, context);
        return { success: true };
      } catch (error) {
        context.log(`Failed to preview audio: ${error instanceof Error ? error.message : String(error)}`, 'error');
        return { success: false };
      }
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

  async onQuestionAsked(event: QuestionAskedEvent, context: ExtensionContext): Promise<void> {
    if (event.storedAnswer) {
      return;
    }

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
    if (soundConfig.source === SoundSource.Custom) {
      if (soundConfig.filePath) {
        validateAudioPath(soundConfig.filePath);
        await this.playAudioFile(soundConfig.filePath, context);
      }
      return;
    }
    if (!soundConfig.sound) {
      return;
    }

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
    if (soundConfig.source === SoundSource.Custom) return;
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
      await this.downloadFile(`${PACKS_URL}/${soundConfig.pack}/${soundEntry.file}`, cachePath);
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
    await playAudio(filePath);
    context.log('Sound played successfully', 'debug');
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
            for (const cat of Object.values(data.categories) as {
              sounds?: PackSound[];
            }[]) {
              if (cat.sounds) {
                for (const s of cat.sounds) {
                  if (!seen.has(s.file)) {
                    seen.add(s.file);
                    sounds.push({
                      file: s.file,
                      label: s.label,
                      sha256: s.sha256,
                    });
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
      https
        .get(url, { headers: { 'User-Agent': 'AiderDesk' } }, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(e);
            }
          });
        })
        .on('error', reject);
    });
  }
}

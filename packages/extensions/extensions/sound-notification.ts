/**
 * Sound Notification Extension
 *
 * Plays a "Jobs Done" sound when a prompt finishes.
 * Works cross-platform on macOS, Windows, and Linux.
 */

import { exec } from 'child_process';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import https from 'https';

import type { Extension, ExtensionContext, PromptFinishedEvent } from '@aiderdesk/extensions';

const execAsync = promisify(exec);

const SOUND_URL = 'https://www.myinstants.com/media/sounds/jobs_done.mp3';
const CACHE_DIR = join(tmpdir(), 'aider-desk-sound-notification');
const SOUND_FILE = join(CACHE_DIR, 'jobs_done.mp3');

export default class SoundNotificationExtension implements Extension {
  static metadata = {
    name: 'Sound Notification',
    version: '1.0.0',
    description: 'Plays a "Jobs Done" sound when a prompt finishes',
    author: 'wladimiiir',
    capabilities: ['notifications'],
  };

  private soundDownloaded = false;
  private downloadPromise: Promise<void> | null = null;

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('Sound notification extension loaded', 'info');

    // Ensure cache directory exists
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true });
    }

    // Start downloading the sound file in the background
    this.downloadPromise = this.downloadSoundFile(context);
  }

  private async downloadSoundFile(context: ExtensionContext): Promise<void> {
    if (existsSync(SOUND_FILE)) {
      this.soundDownloaded = true;
      context.log('Sound file already cached', 'debug');
      return;
    }

    return new Promise((resolve, reject) => {
      context.log(`Downloading sound file from ${SOUND_URL}`, 'debug');

      const file = createWriteStream(SOUND_FILE);
      const request = https.get(SOUND_URL, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            https
              .get(redirectUrl, (redirectResponse) => {
                redirectResponse.pipe(file);
                file.on('finish', () => {
                  file.close();
                  this.soundDownloaded = true;
                  context.log('Sound file downloaded successfully (redirect)', 'debug');
                  resolve();
                });
              })
              .on('error', (err) => {
                context.log(`Download error (redirect): ${err.message}`, 'error');
                reject(err);
              });
            return;
          }
        }

        response.pipe(file);
        file.on('finish', () => {
          file.close();
          this.soundDownloaded = true;
          context.log('Sound file downloaded successfully', 'debug');
          resolve();
        });
      });

      request.on('error', (err) => {
        context.log(`Download error: ${err.message}`, 'error');
        reject(err);
      });

      // Set timeout
      request.setTimeout(10000, () => {
        request.destroy();
        reject(new Error('Download timeout'));
      });
    });
  }

  async onPromptFinished(event: PromptFinishedEvent, context: ExtensionContext): Promise<void> {
    context.log('Prompt finished! Playing notification sound...', 'debug');

    try {
      // Wait for download to complete if still in progress
      if (this.downloadPromise) {
        await this.downloadPromise;
        this.downloadPromise = null;
      }

      if (!this.soundDownloaded && !existsSync(SOUND_FILE)) {
        context.log('Sound file not available, attempting download', 'warn');
        await this.downloadSoundFile(context);
      }

      await this.playSound(context);
    } catch (error) {
      context.log(`Failed to play sound: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  }

  private async playSound(context: ExtensionContext): Promise<void> {
    const platform = process.platform;
    let command: string;

    switch (platform) {
      case 'darwin':
        command = `afplay "${SOUND_FILE}"`;
        break;
      case 'win32':
        // Use PowerShell with Windows Media Player for mp3 support
        command = `powershell -c "Add-Type -AssemblyName presentationCore; $player = New-Object System.Windows.Media.MediaPlayer; $player.Open('${SOUND_FILE.replace(/\\/g, '\\\\')}'); $player.Play(); Start-Sleep -Seconds 3"`;
        break;
      case 'linux':
        // Try players that support MP3 decoding (paplay, mpv, ffplay)
        // Note: aplay removed - it doesn't decode MP3, causing distortion
        command = `paplay "${SOUND_FILE}" 2>/dev/null || mpv --no-video --really-quiet "${SOUND_FILE}" 2>/dev/null || ffplay -nodisp -autoexit -loglevel quiet "${SOUND_FILE}" 2>/dev/null`;
        break;
      default:
        context.log(`Unsupported platform: ${platform}`, 'warn');
        return;
    }

    try {
      await execAsync(command, { timeout: 10000 });
      context.log('Sound played successfully', 'debug');
    } catch (error) {
      // On Linux, try fallback options
      if (platform === 'linux') {
        context.log('Primary audio player failed, trying fallback options', 'warn');
      } else {
        throw error;
      }
    }
  }
}

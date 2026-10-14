import { execFile } from 'child_process';
import { createHash } from 'crypto';
import { accessSync, constants, mkdirSync, statSync, writeFileSync } from 'fs';
import { extname, isAbsolute, join } from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const UPLOAD_DIR = join(__dirname, 'data', 'audio');
const AUDIO_EXTENSIONS = new Set(['.wav', '.mp3', '.ogg', '.flac', '.m4a', '.aac', '.aiff', '.aif', '.opus', '.wma']);
export const MAX_AUDIO_SIZE = 10 * 1024 * 1024;

export enum SoundSource {
  Pack = 'pack',
  Custom = 'custom',
}

export const validateAudioPath = (filePath: string): void => {
  if (!isAbsolute(filePath)) {
    throw new Error('Enter an absolute path to an audio file on the machine running AiderDesk.');
  }
  if (!AUDIO_EXTENSIONS.has(extname(filePath).toLowerCase())) {
    throw new Error('Unsupported audio file extension.');
  }
  if (!statSync(filePath).isFile()) {
    throw new Error('The audio path must point to a file.');
  }
  accessSync(filePath, constants.R_OK);
};

export const storeUploadedAudio = (fileName: unknown, base64: unknown): string => {
  if (typeof fileName !== 'string' || typeof base64 !== 'string') {
    throw new Error('Invalid audio upload.');
  }
  const extension = extname(fileName).toLowerCase();
  if (!AUDIO_EXTENSIONS.has(extension)) {
    throw new Error('Unsupported audio file extension.');
  }
  if (!base64 || base64.length > Math.ceil(MAX_AUDIO_SIZE / 3) * 4 || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
    throw new Error('Upload a non-empty audio file up to 10 MB.');
  }
  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length || buffer.length > MAX_AUDIO_SIZE) {
    throw new Error('Upload a non-empty audio file up to 10 MB.');
  }
  mkdirSync(UPLOAD_DIR, { recursive: true });
  const hash = createHash('sha256').update(buffer).digest('hex');
  const filePath = join(UPLOAD_DIR, `${hash}${extension}`);
  writeFileSync(filePath, buffer);
  return filePath;
};

export const playAudio = async (filePath: string, platform: NodeJS.Platform = process.platform): Promise<void> => {
  const options = { timeout: 10000 };
  if (platform === 'darwin') {
    await execFileAsync('afplay', [filePath], options);
    return;
  }
  if (platform === 'win32') {
    const script = `Add-Type -AssemblyName presentationCore; $player = New-Object System.Windows.Media.MediaPlayer; $player.Open([Uri]'${filePath.replace(/'/g, "''")}'); $player.Play(); Start-Sleep -Seconds 3`;
    await execFileAsync('powershell', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], options);
    return;
  }
  if (platform === 'linux') {
    const players = [
      { command: 'paplay', args: [filePath] },
      { command: 'mpg123', args: ['--quiet', filePath] },
      { command: 'mpv', args: ['--no-video', '--really-quiet', filePath] },
      {
        command: 'ffplay',
        args: ['-nodisp', '-autoexit', '-loglevel', 'quiet', filePath],
      },
      { command: 'aplay', args: [filePath] },
    ];
    for (const player of players) {
      try {
        await execFileAsync(player.command, player.args, options);
        return;
      } catch {
        continue;
      }
    }
    throw new Error('Could not play audio. Install an audio player and check that it supports this file format.');
  }
  throw new Error(`Unsupported platform: ${platform}`);
};

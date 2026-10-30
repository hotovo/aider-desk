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

const PLAY_TIMEOUT_MS = 10000;
const PLAY_WATCHDOG_MS = 15000;
const execOptions = { timeout: PLAY_TIMEOUT_MS, killSignal: 'SIGKILL' } as const;

// paplay and mpg123 are deliberately not preferred for mp3 files: paplay cannot open them and
// mpg123 can hang at process exit on some pipewire setups, while ffplay exits cleanly.
type WATCHABLE_PLAYER = { command: string; args: (filePath: string) => string[] };
const WAV_PLAYERS: WATCHABLE_PLAYER[] = [
  { command: 'paplay', args: (filePath) => [filePath] },
  { command: 'aplay', args: (filePath) => [filePath] },
  { command: 'mpv', args: (filePath) => ['--no-video', '--really-quiet', filePath] },
  { command: 'ffplay', args: (filePath) => ['-nodisp', '-autoexit', '-loglevel', 'quiet', filePath] },
];
const MP3_PLAYERS: WATCHABLE_PLAYER[] = [
  { command: 'ffplay', args: (filePath) => ['-nodisp', '-autoexit', '-loglevel', 'quiet', filePath] },
  { command: 'mpv', args: (filePath) => ['--no-video', '--really-quiet', filePath] },
  { command: 'mpg123', args: (filePath) => ['--quiet', filePath] },
];
const MPV_ONLY_PLAYERS: WATCHABLE_PLAYER[] = [{ command: 'mpv', args: (filePath) => ['--no-video', '--really-quiet', filePath] }];

const WAV_EXTENSIONS = new Set(['.wav', '.oga', '.ogg', '.flac']);
const MP3_EXTENSIONS = new Set(['.mp3']);

const getPlayersForExtension = (extension: string): WATCHABLE_PLAYER[] => {
  if (WAV_EXTENSIONS.has(extension)) {
    return WAV_PLAYERS;
  }
  if (MP3_EXTENSIONS.has(extension)) {
    return MP3_PLAYERS;
  }
  return MPV_ONLY_PLAYERS;
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export const playAudio = async (filePath: string, platform: NodeJS.Platform = process.platform): Promise<void> => {
  const options = execOptions;
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
    const players = getPlayersForExtension(extname(filePath).toLowerCase());
    const chain = (async () => {
      for (const player of players) {
        try {
          await execFileAsync(player.command, player.args(filePath), options);
          return;
        } catch (error) {
          const killed = (error as { killed?: boolean }).killed;
          if (killed) {
            // The player was killed after the timeout — it may have played already.
            // Retrying another player would play the sound a second time, so stop here.
            return;
          }
          continue;
        }
      }
      throw new Error('Could not play audio. Install an audio player and check that it supports this file format.');
    })();

    // Never let a stuck audio player hold the caller for longer than the watchdog window
    await Promise.race([chain, sleep(PLAY_WATCHDOG_MS)]);
    return;
  }
  throw new Error(`Unsupported platform: ${platform}`);
};

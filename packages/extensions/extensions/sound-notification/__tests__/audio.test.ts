import { execFile } from 'child_process';
import { accessSync, mkdirSync, statSync, writeFileSync } from 'fs';
import { basename, dirname, join } from 'path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_AUDIO_SIZE, playAudio, storeUploadedAudio, validateAudioPath } from '../audio';

vi.mock('child_process', () => ({ execFile: vi.fn() }));
vi.mock('fs', () => ({
  accessSync: vi.fn(),
  constants: { R_OK: 4 },
  mkdirSync: vi.fn(),
  statSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

const mockExec = (failures = 0) => {
  let calls = 0;
  vi.mocked(execFile).mockImplementation((...args: unknown[]) => {
    const callback = args[args.length - 1] as (error: Error | null, stdout: string, stderr: string) => void;
    callback(calls++ < failures ? new Error('Player unavailable') : null, '', '');
    return undefined as unknown as ReturnType<typeof execFile>;
  });
};

describe('custom audio files', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(statSync).mockReturnValue({ isFile: () => true } as ReturnType<typeof statSync>);
    mockExec();
  });

  it('stores uploads inside the extension using content hashes rather than user filenames', () => {
    const filePath = storeUploadedAudio('../../sound.WAV', Buffer.from('audio').toString('base64'));
    expect(dirname(filePath)).toBe(join(__dirname, '..', 'data', 'audio'));
    expect(basename(filePath)).toMatch(/^[a-f0-9]{64}\.wav$/);
    expect(mkdirSync).toHaveBeenCalledWith(join(__dirname, '..', 'data', 'audio'), { recursive: true });
    expect(writeFileSync).toHaveBeenCalledWith(filePath, Buffer.from('audio'));
    expect(storeUploadedAudio('other.wav', Buffer.from('audio').toString('base64'))).toBe(filePath);
  });

  it.each([
    ['sound.txt', 'YQ=='],
    ['sound.wav', ''],
    ['sound.wav', 'invalid!'],
    ['sound.wav', 'Y==='],
    ['sound.wav', 'YQ'],
    [null, 'YQ=='],
    ['sound.wav', null],
  ])('rejects invalid uploads (%s, %s)', (name, data) => {
    expect(() => storeUploadedAudio(name, data)).toThrow();
    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it('rejects oversized uploads before writing', () => {
    const base64 = Buffer.alloc(MAX_AUDIO_SIZE + 1).toString('base64');
    expect(() => storeUploadedAudio('large.mp3', base64)).toThrow('10 MB');
    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it('accepts readable absolute audio paths with spaces and special characters', () => {
    const filePath = '/audio/My "sound" $(touch nope).MP3';
    expect(() => validateAudioPath(filePath)).not.toThrow();
    expect(accessSync).toHaveBeenCalledWith(filePath, 4);
  });

  it('rejects relative paths, unsupported formats, directories, and missing files', () => {
    expect(() => validateAudioPath('sound.wav')).toThrow('absolute path');
    expect(() => validateAudioPath('/audio/sound.txt')).toThrow('extension');
    vi.mocked(statSync).mockReturnValue({ isFile: () => false } as ReturnType<typeof statSync>);
    expect(() => validateAudioPath('/audio/directory.wav')).toThrow('file');
    vi.mocked(statSync).mockImplementation(() => {
      throw new Error('ENOENT');
    });
    expect(() => validateAudioPath('/audio/missing.wav')).toThrow('ENOENT');
  });

  const expectedOptions = { timeout: 10000, killSignal: 'SIGKILL' };

  it('passes macOS paths as arguments without shell interpolation', async () => {
    const filePath = '/audio/My "sound" $(touch nope).wav';
    await playAudio(filePath, 'darwin');
    expect(execFile).toHaveBeenCalledWith('afplay', [filePath], expectedOptions, expect.any(Function));
  });

  it('tries Linux wav players in paplay, aplay, ffplay, mpv order without invoking a shell', async () => {
    mockExec(2);
    const filePath = '/audio/sound; touch nope.wav';
    await playAudio(filePath, 'linux');
    expect(execFile).toHaveBeenNthCalledWith(1, 'paplay', [filePath], expectedOptions, expect.any(Function));
    expect(execFile).toHaveBeenNthCalledWith(2, 'aplay', [filePath], expectedOptions, expect.any(Function));
    expect(execFile).toHaveBeenNthCalledWith(3, 'mpv', ['--no-video', '--really-quiet', filePath], expectedOptions, expect.any(Function));
    expect(execFile).not.toHaveBeenCalledWith('ffplay', expect.anything(), expect.anything(), expect.anything());
  });

  it('reports failure when no Linux player works', async () => {
    mockExec(4);
    await expect(playAudio('/audio/sound.wav', 'linux')).rejects.toThrow('Could not play audio');
    expect(execFile).toHaveBeenCalledTimes(4);
  });

  it('plays mp3 files with ffplay first and never invokes paplay, aplay or mpg123 before it', async () => {
    mockExec(1);
    await playAudio('/audio/sound.mp3', 'linux');
    expect(execFile).toHaveBeenNthCalledWith(1, 'ffplay', ['-nodisp', '-autoexit', '-loglevel', 'quiet', '/audio/sound.mp3'], expectedOptions, expect.any(Function));
    expect(execFile).toHaveBeenNthCalledWith(2, 'mpv', ['--no-video', '--really-quiet', '/audio/sound.mp3'], expectedOptions, expect.any(Function));
    expect(execFile).not.toHaveBeenCalledWith('paplay', expect.anything(), expect.anything(), expect.anything());
    expect(execFile).not.toHaveBeenCalledWith('aplay', expect.anything(), expect.anything(), expect.anything());
    expect(execFile).not.toHaveBeenCalledWith('mpg123', expect.anything(), expect.anything(), expect.anything());
  });

  it('does not retry with other players when one is killed after the timeout', async () => {
    vi.mocked(execFile).mockImplementation((...args: unknown[]) => {
      const callback = args[args.length - 1] as (error: Error & { killed?: boolean }) => void;
      const killError: Error & { killed?: boolean } = new Error('Process killed');
      killError.killed = true;
      callback(killError);
      return undefined as unknown as ReturnType<typeof execFile>;
    });
    await playAudio('/audio/sound.wav', 'linux');
    expect(execFile).toHaveBeenCalledTimes(1);
  });

  it('resolves via watchdog even when every player hangs', async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(execFile).mockImplementation(() => undefined as unknown as ReturnType<typeof execFile>);
      const playing = playAudio('/audio/sound.wav', 'linux');
      const expectation = expect(playing).resolves.toBeUndefined();
      await vi.advanceTimersByTimeAsync(15100);
      await expectation;
    } finally {
      vi.useRealTimers();
    }
  });

  it('encodes Windows playback and escapes apostrophes as PowerShell literals', async () => {
    await playAudio("C:\\audio\\Sam's $(sound).wav", 'win32');
    const args = vi.mocked(execFile).mock.calls[0][1] as string[];
    expect(args.slice(0, 3)).toEqual(['-NoProfile', '-NonInteractive', '-EncodedCommand']);
    const script = Buffer.from(args[3], 'base64').toString('utf16le');
    expect(script).toContain("$player.Open([Uri]'C:\\audio\\Sam''s $(sound).wav')");
  });

  it('reports unsupported platforms', async () => {
    await expect(playAudio('/audio/sound.wav', 'freebsd')).rejects.toThrow('Unsupported platform');
    expect(execFile).not.toHaveBeenCalled();
  });
});

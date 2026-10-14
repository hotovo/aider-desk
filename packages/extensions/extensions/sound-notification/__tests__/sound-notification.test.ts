import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ExtensionContext, QuestionAskedEvent } from '@aiderdesk/extensions';

import SoundNotificationExtension from '../index';
import { playAudio, SoundSource, storeUploadedAudio, validateAudioPath } from '../audio';

vi.mock('fs', () => ({
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
  createWriteStream: vi.fn(),
  readFileSync: vi.fn((path: string) =>
    path.endsWith('packs.json') ? JSON.stringify([{ name: 'peasant', sounds: [{ file: 'sounds/PeasantJobDone.wav' }] }]) : '',
  ),
  writeFileSync: vi.fn(),
}));
vi.mock('../audio', () => ({
  SoundSource: { Pack: 'pack', Custom: 'custom' },
  playAudio: vi.fn(),
  storeUploadedAudio: vi.fn(),
  validateAudioPath: vi.fn(),
}));

const context = { log: vi.fn() } as unknown as ExtensionContext;
const customConfig = {
  agentFinished: {
    source: SoundSource.Custom,
    filePath: '/audio/finished.wav',
    pack: 'peasant',
    sound: 'PeasantJobDone',
  },
  questionAsked: {
    source: SoundSource.Custom,
    filePath: '/audio/question.mp3',
    pack: 'peasant',
    sound: '',
  },
};
const questionEvent = {
  question: {},
  storedAnswer: undefined,
} as QuestionAskedEvent;

describe('SoundNotificationExtension', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(customConfig));
    vi.mocked(validateAudioPath).mockReset();
    vi.mocked(playAudio).mockReset();
    vi.mocked(storeUploadedAudio).mockReset();
  });

  it('creates the downloaded pack cache inside the extension folder', async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    await new SoundNotificationExtension().onLoad(context);
    expect(mkdirSync).toHaveBeenCalledWith(join(__dirname, '..', 'data', 'cache'), { recursive: true });
  });

  it('plays independent custom sounds for task completion and questions', async () => {
    const extension = new SoundNotificationExtension();
    await extension.onPromptFinished({ responses: [] }, context);
    await extension.onQuestionAsked(questionEvent, context);
    expect(playAudio).toHaveBeenNthCalledWith(1, '/audio/finished.wav');
    expect(playAudio).toHaveBeenNthCalledWith(2, '/audio/question.mp3');
    expect(validateAudioPath).toHaveBeenCalledTimes(2);
  });

  it('retains pack playback for existing configurations without a source', async () => {
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({
        agentFinished: { pack: 'peasant', sound: 'PeasantJobDone' },
      }),
    );
    await new SoundNotificationExtension().onPromptFinished({ responses: [] }, context);
    expect(playAudio).toHaveBeenCalledWith(expect.stringContaining('PeasantJobDone.wav'));
    expect(validateAudioPath).not.toHaveBeenCalled();
  });

  it('does not play questions with stored answers', async () => {
    await new SoundNotificationExtension().onQuestionAsked({ ...questionEvent, storedAnswer: 'yes' }, context);
    expect(playAudio).not.toHaveBeenCalled();
  });

  it('allows custom sounds to be disabled with an empty path', async () => {
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({
        agentFinished: { ...customConfig.agentFinished, filePath: '' },
      }),
    );
    await new SoundNotificationExtension().onPromptFinished({ responses: [] }, context);
    expect(playAudio).not.toHaveBeenCalled();
  });

  it('validates and saves custom paths without downloading their retained packs', async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    const saved = await new SoundNotificationExtension().saveConfigData({
      ...customConfig,
      packs: [],
    });
    expect(saved).toEqual(customConfig);
    expect(validateAudioPath).toHaveBeenCalledWith('/audio/finished.wav');
    expect(validateAudioPath).toHaveBeenCalledWith('/audio/question.mp3');
    expect(writeFileSync).toHaveBeenCalledWith(expect.stringContaining('config.json'), JSON.stringify(customConfig, null, 2), 'utf-8');
  });

  it('does not overwrite configuration when a custom path is invalid', async () => {
    vi.mocked(validateAudioPath).mockImplementation(() => {
      throw new Error('Missing file');
    });
    await expect(new SoundNotificationExtension().saveConfigData(customConfig)).rejects.toThrow('Missing file');
    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it('uploads audio through the configuration action bridge', async () => {
    vi.mocked(storeUploadedAudio).mockReturnValue('/persistent/audio/hash.wav');
    const result = await new SoundNotificationExtension().executeUIExtensionAction('config', 'upload-audio', ['my.wav', 'YQ=='], context);
    expect(result).toEqual({
      success: true,
      filePath: '/persistent/audio/hash.wav',
    });
    expect(storeUploadedAudio).toHaveBeenCalledWith('my.wav', 'YQ==');
  });

  it('previews a custom path without saving the configuration', async () => {
    const result = await new SoundNotificationExtension().executeUIExtensionAction('config', 'play-custom-sound', ['/audio/preview.wav'], context);
    expect(result).toEqual({ success: true });
    expect(playAudio).toHaveBeenCalledWith('/audio/preview.wav');
    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it('returns a failure result for upload and preview errors', async () => {
    vi.mocked(storeUploadedAudio).mockImplementation(() => {
      throw new Error('Invalid upload');
    });
    vi.mocked(playAudio).mockRejectedValue(new Error('No player'));
    const extension = new SoundNotificationExtension();
    await expect(extension.executeUIExtensionAction('config', 'upload-audio', [], context)).resolves.toEqual({ success: false });
    await expect(extension.executeUIExtensionAction('config', 'play-custom-sound', ['/audio/preview.wav'], context)).resolves.toEqual({ success: false });
    await expect(extension.executeUIExtensionAction('config', 'play-custom-sound', [null], context)).resolves.toEqual({ success: false });
  });

  it('logs invalid file errors without interrupting task completion', async () => {
    vi.mocked(validateAudioPath).mockImplementation(() => {
      throw new Error('Missing file');
    });
    await new SoundNotificationExtension().onPromptFinished({ responses: [] }, context);
    expect(context.log).toHaveBeenCalledWith(expect.stringContaining('Missing file'), 'error');
    expect(playAudio).not.toHaveBeenCalled();
  });
});

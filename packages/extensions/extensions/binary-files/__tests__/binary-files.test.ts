import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { inferMediaType, readBinaryFile } from '../index';

const temporaryDirectories: string[] = [];

const createTemporaryDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), 'aiderdesk-binary-files-'));
  temporaryDirectories.push(directory);
  return directory;
};

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('Binary Files extension', () => {
  it('infers MIME types for common multimodal files', () => {
    expect(inferMediaType('photo.PNG')).toBe('image/png');
    expect(inferMediaType('report.pdf')).toBe('application/pdf');
    expect(inferMediaType('contract.docx')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(inferMediaType('recording.avi')).toBe('video/x-msvideo');
    expect(inferMediaType('archive.custom')).toBe('application/octet-stream');
  });

  it('returns MCP media content with base64 data for the optimizer to convert', async () => {
    const directory = await createTemporaryDirectory();
    const filePath = join(directory, 'image.png');
    await writeFile(filePath, Buffer.from([0, 1, 2, 3]));

    await expect(readBinaryFile({ filePath: 'image.png' }, directory)).resolves.toEqual({
      content: [
        { type: 'text', text: 'Attached binary file image.png (4 bytes, image/png).' },
        { type: 'media', data: 'AAECAw==', mimeType: 'image/png' },
      ],
    });
  });

  it('uses an explicitly supplied MIME type', async () => {
    const directory = await createTemporaryDirectory();
    const filePath = join(directory, 'attachment.bin');
    await writeFile(filePath, Buffer.from([1]));

    const result = await readBinaryFile({ filePath, mediaType: 'application/pdf' }, directory);

    expect(result.content[1]).toEqual({ type: 'media', data: 'AQ==', mimeType: 'application/pdf' });
  });
});

import { readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, extname, isAbsolute, resolve } from 'node:path';

import { z } from 'zod';

import type { Extension, ExtensionContext, ToolDefinition } from '@aiderdesk/extensions';

const MEDIA_TYPES: Record<string, string> = {
  '.avi': 'video/x-msvideo',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.csv': 'text/csv',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.gif': 'image/gif',
  '.heic': 'image/heic',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.m4a': 'audio/mp4',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.ogg': 'audio/ogg',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.svg': 'image/svg+xml',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.wav': 'audio/wav',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const metadata = {
  name: 'Binary Files',
  version: '1.0.0',
  description: 'Adds a tool that attaches local binary files to multimodal model requests',
  author: 'AiderDesk',
  iconUrl: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/binary-files/icon.png',
  capabilities: ['tools', 'multimodal'],
};

const inputSchema = z.object({
  filePath: z.string().describe('The path to the binary file to attach, relative to the task working directory or absolute.'),
  mediaType: z.string().optional().describe('Optional MIME type override. Use this when the file extension does not identify the correct type.'),
});

type BinaryFileInput = z.infer<typeof inputSchema>;

export const inferMediaType = (filePath: string): string => {
  return MEDIA_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
};

const resolveFilePath = (filePath: string, taskDir: string): string => {
  if (filePath.startsWith('~/')) {
    return resolve(homedir(), filePath.slice(2));
  }

  return isAbsolute(filePath) ? filePath : resolve(taskDir, filePath);
};

export const readBinaryFile = async (input: BinaryFileInput, taskDir: string, signal?: AbortSignal) => {
  const absolutePath = resolveFilePath(input.filePath, taskDir);
  const fileStats = await stat(absolutePath);

  if (!fileStats.isFile()) {
    throw new Error(`Path is not a file: ${input.filePath}`);
  }

  const data = await readFile(absolutePath, { signal });
  const mediaType = input.mediaType ?? inferMediaType(absolutePath);

  return {
    content: [
      {
        type: 'text' as const,
        text: `Attached binary file ${basename(absolutePath)} (${data.byteLength} bytes, ${mediaType}).`,
      },
      {
        type: 'media' as const,
        data: data.toString('base64'),
        mimeType: mediaType,
      },
    ],
  };
};

export default class BinaryFilesExtension implements Extension {
  static metadata = metadata;

  getTools(_context: ExtensionContext): ToolDefinition<typeof inputSchema>[] {
    return [
      {
        name: 'read_binary_file',
        description:
          'Read a local binary file and attach it to the next model request for multimodal analysis. Use this for images, PDFs, Office documents, audio, video, and other binary files. The selected model must support the file type.',
        inputSchema,
        execute: async (input, signal, context) => {
          const taskDir = context.getTaskContext()?.getTaskDir() ?? context.getProjectDir();

          try {
            return await readBinaryFile(input, taskDir, signal);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return {
              content: [{ type: 'text' as const, text: `Error reading binary file '${input.filePath}': ${message}` }],
              isError: true,
            };
          }
        },
      },
    ];
  }
}

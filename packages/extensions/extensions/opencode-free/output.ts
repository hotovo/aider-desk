import type { Tool } from 'ai';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

type ModelOutput = Awaited<ReturnType<NonNullable<Tool['toModelOutput']>>>;

export const toMcpResult = (output: ModelOutput): CallToolResult => {
  if (output.type === 'execution-denied') {
    return {
      isError: true,
      content: [{ type: 'text', text: output.reason ?? 'Tool execution denied.' }],
    };
  }
  if (output.type === 'content') {
    return {
      content: output.value.map((part): CallToolResult['content'][number] => {
        if (part.type === 'text') {
          return { type: 'text', text: part.text };
        }
        if (part.type === 'file') {
          if (part.data.type === 'data' && part.mediaType.startsWith('image/')) {
            return {
              type: 'image',
              data:
                typeof part.data.data === 'string'
                  ? part.data.data
                  : Buffer.from(part.data.data instanceof ArrayBuffer ? new Uint8Array(part.data.data) : part.data.data).toString('base64'),
              mimeType: part.mediaType,
            };
          }
          if (part.data.type === 'text') {
            return { type: 'text', text: part.data.text };
          }
          if (part.data.type === 'url') {
            return {
              type: 'resource_link',
              uri: part.data.url.toString(),
              name: part.filename ?? 'attachment',
              mimeType: part.mediaType,
            };
          }
        }
        return { type: 'text', text: JSON.stringify(part) };
      }),
    };
  }
  return {
    ...(output.type === 'error-text' || output.type === 'error-json' ? { isError: true } : {}),
    content: [
      {
        type: 'text',
        text: typeof output.value === 'string' ? output.value : JSON.stringify(output.value),
      },
    ],
  };
};

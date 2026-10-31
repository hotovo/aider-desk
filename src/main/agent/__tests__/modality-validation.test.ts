import { describe, expect, it } from 'vitest';
import { ModelModality } from '@common/types';

import {
  AttachmentRemovalReason,
  classifyAttachmentMediaType,
  filterAttachmentsForModel,
  type AttachmentFilterContext,
} from '../message-preparation/modality-validation';

import type { ModelMessage } from 'ai';

const textOnlyModel = (provider = 'anthropic', model = 'claude-3-haiku'): AttachmentFilterContext => ({
  providerId: provider,
  modelName: model,
  resolveModalities: () => ({ input: [ModelModality.Text], output: [ModelModality.Text] }),
});

const pdfCapableModel = (provider = 'google', model = 'gemini'): AttachmentFilterContext => ({
  providerId: provider,
  modelName: model,
  resolveModalities: (providerId, modelName) =>
    providerId === provider && modelName === model
      ? { input: [ModelModality.Text, ModelModality.Image, ModelModality.Pdf], output: [ModelModality.Text] }
      : { input: [ModelModality.Text], output: [ModelModality.Text] },
});

const unknownModel: AttachmentFilterContext = {
  providerId: 'cursor-sdk',
  modelName: 'composer-2.5',
  resolveModalities: () => undefined,
};

const userMessageWithFile = (mediaType: string): ModelMessage => ({
  role: 'user',
  content: [{ type: 'text', text: 'Describe the attachment.' }, { type: 'file', data: 'file-data', mediaType } as never],
});

const toolResultWithInjectedImageMessage = (): ModelMessage[] => [
  {
    role: 'tool',
    content: [{ type: 'tool-result', toolCallId: 'call-1', toolName: 'extensions/read_binary_file', output: { type: 'text', value: 'Image rendered.' } }],
  },
  {
    role: 'user',
    content: [{ type: 'file', data: { type: 'data', data: 'base64' }, mediaType: 'image/png' } as never],
  } as ModelMessage,
];

describe('classifyAttachmentMediaType', () => {
  it('maps known MIME categories to modalities', () => {
    expect(classifyAttachmentMediaType('image/png')).toEqual({ modality: ModelModality.Image, binaryUnsupported: false, isAttachment: true });
    expect(classifyAttachmentMediaType('audio/mpeg')).toEqual({ modality: ModelModality.Audio, binaryUnsupported: false, isAttachment: true });
    expect(classifyAttachmentMediaType('video/mp4')).toEqual({ modality: ModelModality.Video, binaryUnsupported: false, isAttachment: true });
    expect(classifyAttachmentMediaType('application/pdf')).toEqual({ modality: ModelModality.Pdf, binaryUnsupported: false, isAttachment: true });
  });

  it('marks non-mapped binary types as explicitly unsupported', () => {
    expect(classifyAttachmentMediaType('application/vnd.openxmlformats-officedocument.wordprocessingml.document').binaryUnsupported).toBe(true);
    expect(classifyAttachmentMediaType('application/vnd.ms-excel').binaryUnsupported).toBe(true);
    expect(classifyAttachmentMediaType('application/octet-stream').binaryUnsupported).toBe(true);
    expect(classifyAttachmentMediaType('application/zip').binaryUnsupported).toBe(true);
  });

  it('treats textual types and missing metadata as non-attachments', () => {
    expect(classifyAttachmentMediaType('text/plain').isAttachment).toBe(false);
    expect(classifyAttachmentMediaType('application/json').isAttachment).toBe(false);
    expect(classifyAttachmentMediaType('application/vnd.foo+json').isAttachment).toBe(false);
    expect(classifyAttachmentMediaType('application/xhtml+xml').isAttachment).toBe(false);
    expect(classifyAttachmentMediaType(undefined).isAttachment).toBe(false);
    expect(classifyAttachmentMediaType(undefined).binaryUnsupported).toBe(false);
  });
});

describe('filterAttachmentsForModel', () => {
  it.each(['image/png', 'audio/mpeg', 'video/mp4', 'application/pdf', 'application/octet-stream'])(
    'preserves %s attachments when model capabilities are unknown',
    (mediaType) => {
      const messages = [userMessageWithFile(mediaType)];
      const result = filterAttachmentsForModel(messages, unknownModel);
      expect(result.messages).toBe(messages);
      expect(result.removed).toEqual([]);
    },
  );

  it('preserves tool-result images and their placeholders when model capabilities are unknown', () => {
    const messages = toolResultWithInjectedImageMessage();
    const original = structuredClone(messages);
    const result = filterAttachmentsForModel(messages, unknownModel);
    expect(result.messages).toBe(messages);
    expect(result.messages).toEqual(original);
    expect(result.removed).toEqual([]);
  });

  it('enforces explicitly empty input modalities', () => {
    const result = filterAttachmentsForModel([userMessageWithFile('image/png')], {
      ...unknownModel,
      resolveModalities: () => ({ input: [], output: [] }),
    });
    expect(result.removed).toHaveLength(1);
  });

  it('removes attachments whose modality is absent from known input modalities', () => {
    const result = filterAttachmentsForModel([userMessageWithFile('image/png')], textOnlyModel());
    expect(result.removed).toHaveLength(1);
    expect(result.removed[0]).toMatchObject({
      mediaType: 'image/png',
      modality: ModelModality.Image,
      reason: AttachmentRemovalReason.UnsupportedModality,
      origin: 'user request',
    });
    const content = result.messages[0].content as Array<{ type: string; text?: string }>;
    expect(content.find((part) => part.type === 'file')).toBeUndefined();
    expect(content.some((part) => part.type === 'text' && part.text?.includes('Attachment omitted'))).toBe(true);
    expect(content.some((part) => part.type === 'text' && part.text?.includes('anthropic/claude-3-haiku'))).toBe(true);
  });

  it('keeps attachments supported by the model', () => {
    const result = filterAttachmentsForModel([userMessageWithFile('image/png'), userMessageWithFile('application/pdf')], pdfCapableModel());
    expect(result.removed).toHaveLength(0);
    expect(result.messages[0].content).toHaveLength(2);
    expect(result.messages[1].content).toHaveLength(2);
  });

  it('removes unsupported binary attachments even for capable models, never justified by PDF support', () => {
    const result = filterAttachmentsForModel(
      [userMessageWithFile('application/vnd.openxmlformats-officedocument.wordprocessingml.document')],
      pdfCapableModel(),
    );
    expect(result.removed).toHaveLength(1);
    expect(result.removed[0].reason).toBe(AttachmentRemovalReason.UnsupportedMediaType);
  });

  it('removes pdf attachments for text-only models', () => {
    const result = filterAttachmentsForModel([userMessageWithFile('application/pdf')], textOnlyModel());
    expect(result.removed).toHaveLength(1);
    expect(result.removed[0].modality).toBe(ModelModality.Pdf);
  });

  it('leaves textual file parts in place', () => {
    const result = filterAttachmentsForModel([userMessageWithFile('text/csv')], textOnlyModel());
    expect(result.removed).toHaveLength(0);
    expect(result.messages[0].content as Array<{ type: string }>).toHaveLength(2);
  });

  it('replaces a removed tool-result attachment with an in-conversation note and patches the placeholder', () => {
    const messages = toolResultWithInjectedImageMessage();
    const result = filterAttachmentsForModel(messages, textOnlyModel());

    expect(result.removed).toHaveLength(1);
    expect(result.removed[0].origin).toBe('tool result "extensions/read_binary_file"');

    const toolMessage = result.messages[0] as { content: Array<{ type: string; output: { type: string; value: string } }> };
    expect(toolMessage.content[0].output.value).toContain('omitted');

    const injectedMessage = result.messages[1] as { content: Array<{ type: string; text?: string }> };
    expect(injectedMessage.content.find((part) => part.type === 'file')).toBeUndefined();
    expect(injectedMessage.content.some((part) => part.type === 'text' && part.text?.includes('tool result'))).toBe(true);
  });

  it('identifies context-file images by filename from the text part', () => {
    const messages: ModelMessage[] = [
      {
        role: 'user',
        content: [{ type: 'text', text: 'Here is content of image file diagram.png' }, { type: 'image', image: 'base64', mediaType: 'image/jpeg' } as never],
      },
    ];
    const result = filterAttachmentsForModel(messages, textOnlyModel());
    expect(result.removed).toHaveLength(1);
    expect(result.removed[0].origin).toBe('context file "diagram.png"');
  });

  it('keeps a directive note when all parts of the message were attachments', () => {
    const messages: ModelMessage[] = [
      {
        role: 'user',
        content: [{ type: 'file', data: 'data', mediaType: 'image/png' } as never],
      },
    ];
    const result = filterAttachmentsForModel(messages, textOnlyModel());
    expect(result.removed).toHaveLength(1);
    const content = result.messages[0].content as Array<{ type: string }>;
    expect(content).toHaveLength(1);
    expect(content[0].type).toBe('text');
    expect((content[0] as unknown as { text: string }).text).toContain('Attachment omitted');
  });
});

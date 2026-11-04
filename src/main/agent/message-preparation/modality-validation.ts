import { ModelModality } from '@common/types';

import type { ModelModalities } from '@common/types';
import type { ModelMessage, ToolResultPart } from 'ai';

export type ResolveModelModalities = (providerId: string, modelName: string) => ModelModalities | undefined;

export interface AttachmentFilterContext {
  providerId: string;
  modelName: string;
  resolveModalities: ResolveModelModalities;
}

const MIME_TO_MODALITY: Array<{ test: (mediaType: string) => boolean; modality: ModelModality }> = [
  { test: (mediaType) => mediaType.startsWith('image/'), modality: ModelModality.Image },
  { test: (mediaType) => mediaType.startsWith('audio/'), modality: ModelModality.Audio },
  { test: (mediaType) => mediaType.startsWith('video/'), modality: ModelModality.Video },
  { test: (mediaType) => mediaType === 'application/pdf', modality: ModelModality.Pdf },
];

const TEXTUAL_MEDIA_TYPES = new Set([
  'application/json',
  'application/xml',
  'application/javascript',
  'application/typescript',
  'application/ecmascript',
  'application/yaml',
  'application/x-yaml',
  'application/toml',
  'application/sql',
  'application/graphql',
  'application/x-sh',
  'application/xhtml+xml',
]);

const isTextualMediaType = (mediaType: string): boolean =>
  mediaType.startsWith('text/') || TEXTUAL_MEDIA_TYPES.has(mediaType) || mediaType.endsWith('+json') || mediaType.endsWith('+xml');

export interface AttachmentClassification {
  modality?: ModelModality;
  binaryUnsupported: boolean;
  isAttachment: boolean;
}

export const classifyAttachmentMediaType = (mediaType: string | undefined): AttachmentClassification => {
  if (!mediaType) {
    return { binaryUnsupported: false, isAttachment: false };
  }

  const normalized = mediaType.toLowerCase();
  for (const mapping of MIME_TO_MODALITY) {
    if (mapping.test(normalized)) {
      return { modality: mapping.modality, binaryUnsupported: false, isAttachment: true };
    }
  }

  if (isTextualMediaType(normalized)) {
    return { binaryUnsupported: false, isAttachment: false };
  }

  return { binaryUnsupported: true, isAttachment: true };
};

export enum AttachmentRemovalReason {
  UnsupportedModality = 'unsupported-modality',
  UnsupportedMediaType = 'unsupported-media-type',
}

export interface FilteredAttachment {
  mediaType: string;
  modality?: ModelModality;
  origin: string;
  reason: AttachmentRemovalReason;
}

export interface AttachmentFilterResult {
  messages: ModelMessage[];
  removed: FilteredAttachment[];
}

const IMAGE_RENDERED_PLACEHOLDER = 'Image rendered.';

const CONTEXT_FILE_IMAGE_TEXT_PATTERN = /Here is content of image file (.+)$/m;

const removalNote = (attachment: FilteredAttachment, modelLabel: string): string => {
  const capability = attachment.modality ? attachment.modality : 'binary';
  return `[Attachment omitted] ${attachment.mediaType} (${attachment.origin}) was removed from this request because model ${modelLabel} does not support ${capability} input. Inform the user that the attachment could not be processed with the current model.`;
};

type MessageContentPart = {
  type: string;
  mediaType?: string;
  text?: string;
  [key: string]: unknown;
};

const extractToolNameFromToolMessage = (message: ModelMessage): string | undefined => {
  if (message.role !== 'tool' || !Array.isArray(message.content)) {
    return undefined;
  }
  const toolPart = (message.content as ToolResultPart[]).find((part) => part.type === 'tool-result');
  return toolPart?.toolName;
};

const findContextFileReference = (parts: MessageContentPart[]): string | undefined => {
  const text = parts
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text as string)
    .join('\n');
  const match = text.match(CONTEXT_FILE_IMAGE_TEXT_PATTERN);
  return match ? match[1].trim() : undefined;
};

const patchImageRenderedPlaceholder = (toolMessage: ModelMessage, modelLabel: string): void => {
  if (!Array.isArray(toolMessage.content)) {
    return;
  }
  const toolContent = toolMessage.content as ToolResultPart[];
  const index = toolContent.findIndex((part) => part.type === 'tool-result' && part.output.type === 'text' && part.output.value === IMAGE_RENDERED_PLACEHOLDER);
  if (index < 0) {
    return;
  }
  const toolPart = toolContent[index];
  toolContent[index] = {
    ...toolPart,
    output: {
      ...toolPart.output,
      type: 'text',
      value: `[Media attachment was omitted because model ${modelLabel} does not support the required input modality]`,
    },
  } as ToolResultPart;
};

export const filterAttachmentsForModel = (messages: ModelMessage[], context: AttachmentFilterContext): AttachmentFilterResult => {
  const { providerId, modelName, resolveModalities } = context;
  const modelLabel = `${providerId}/${modelName}`;

  const modalities = resolveModalities(providerId, modelName);
  if (modalities === undefined) {
    return { messages, removed: [] };
  }
  const supportedInput = modalities.input;

  const removed: FilteredAttachment[] = [];
  const outputMessages: ModelMessage[] = [];
  let previousToolName: string | undefined;

  for (const message of messages) {
    const toolName = extractToolNameFromToolMessage(message);
    if (toolName !== undefined) {
      previousToolName = toolName;
    }

    const parts = Array.isArray(message.content) ? (message.content as MessageContentPart[]) : undefined;
    if (message.role !== 'user' || !parts) {
      outputMessages.push(message);
      continue;
    }

    // The user message injected by convertImageToolResults follows the tool
    // message whose result contained the media.
    const sourceToolName = previousToolName;
    const isToolResultMessage = sourceToolName !== undefined;

    const keptParts: ModelMessage['content'] = [];
    const removals: FilteredAttachment[] = [];

    for (const part of parts) {
      const isAttachmentPart = part.type === 'image' || part.type === 'file';
      if (!isAttachmentPart) {
        keptParts.push(part as never);
        continue;
      }

      const mediaType = part.type === 'image' ? (part.mediaType ?? 'image/*') : part.mediaType;
      const classification = classifyAttachmentMediaType(mediaType);

      const shouldRemove = classification.binaryUnsupported || (classification.modality ? !supportedInput.includes(classification.modality) : false);

      if (!shouldRemove) {
        keptParts.push(part as never);
        continue;
      }

      const normalizedMediaType = mediaType ?? 'application/octet-stream';
      const reason = classification.binaryUnsupported ? AttachmentRemovalReason.UnsupportedMediaType : AttachmentRemovalReason.UnsupportedModality;
      const fileReference = isToolResultMessage ? undefined : findContextFileReference(parts);
      const origin = isToolResultMessage ? `tool result "${sourceToolName}"` : fileReference ? `context file "${fileReference}"` : 'user request';

      removals.push({ mediaType: normalizedMediaType, modality: classification.modality, origin, reason });
      removed.push(removals[removals.length - 1]);
    }

    if (removals.length === 0) {
      outputMessages.push(message);
      continue;
    }

    const lastOutputMessage = outputMessages[outputMessages.length - 1];
    if (isToolResultMessage) {
      patchImageRenderedPlaceholder(lastOutputMessage, modelLabel);
    }

    // Preserve a trace in the conversation so the model does not assume it
    // received the attachment, even when every part of the message was removed.
    const noteParts = removals.map((attachment) => ({ type: 'text', text: removalNote(attachment, modelLabel) }));

    outputMessages.push({
      ...message,
      content: keptParts.length === 0 ? noteParts : [...keptParts, ...(noteParts as never[])],
    } as ModelMessage);
  }

  if (removed.length === 0) {
    return { messages, removed: [] };
  }

  return { messages: outputMessages, removed };
};

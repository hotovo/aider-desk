import { cloneDeep } from 'lodash';

import { addImportantReminders } from './reminders';
import { transformMessages } from './transformations';
import { optimizeMessages } from './optimizations';
import { convertImageToolResults } from './provider-compatibility';
import { applyCacheControl } from './cache-control';
import { filterAttachmentsForModel, type AttachmentFilterContext, type FilteredAttachment } from './modality-validation';

import type { ModelMessage } from 'ai';
import type { CacheControl as ExtensionCacheControl } from '@common/extensions';
import type { AgentProfile, ContextMessage } from '@common/types';
import type { CacheControl } from '@/models';
import type { Task } from '@/task';
import type { ExtensionManager } from '@/extensions';

export interface PreparedMessagesOptions extends AttachmentFilterContext {
  allowWarnings?: boolean;
}

const reportRemovedAttachments = (task: Task, modelLabel: string, removed: FilteredAttachment[]): void => {
  const summary = removed.map((attachment) => `${attachment.mediaType} (${attachment.origin})`).join(', ');
  task.addLogMessage(
    'warning',
    `Removed attachment(s) not supported by model ${modelLabel}: ${summary}. Switch to a model with the required input modality or update the model capabilities in the Model Library.`,
  );
};

export const prepareMessagesForModel = async (
  messages: ModelMessage[],
  cacheControl?: CacheControl,
  task: Task | null = null,
  profile: AgentProfile | null = null,
  projectProfiles: AgentProfile[] = [],
  userRequestMessageIndex: number = -1,
  extensionManager?: ExtensionManager,
  options?: PreparedMessagesOptions,
): Promise<ModelMessage[]> => {
  let preparedMessages = cloneDeep(messages);
  if (task && profile && preparedMessages.length > 0) {
    preparedMessages = await addImportantReminders(task, profile, projectProfiles, userRequestMessageIndex, preparedMessages, extensionManager);
  }

  const transformationInput = cloneDeep(preparedMessages);
  preparedMessages = transformMessages(preparedMessages);
  if (extensionManager && task) {
    const result = await extensionManager.dispatchEvent(
      'onTransformMessages',
      { originalMessages: transformationInput as ContextMessage[], transformedMessages: preparedMessages as ContextMessage[] },
      task.project,
      task,
    );
    preparedMessages = (result.transformedMessages as ModelMessage[]) ?? preparedMessages;
  }

  const optimizationInput = cloneDeep(preparedMessages);
  preparedMessages = optimizeMessages(cloneDeep(preparedMessages));
  if (extensionManager && task) {
    const result = await extensionManager.dispatchEvent(
      'onOptimizeMessages',
      { originalMessages: optimizationInput as ContextMessage[], optimizedMessages: preparedMessages as ContextMessage[] },
      task.project,
      task,
    );
    preparedMessages = (result.optimizedMessages as ModelMessage[]) ?? preparedMessages;
  }

  preparedMessages = convertImageToolResults(preparedMessages);
  const cacheInput = cloneDeep(preparedMessages);
  preparedMessages = applyCacheControl(preparedMessages, cacheControl);
  if (extensionManager && task) {
    const result = await extensionManager.dispatchEvent(
      'onApplyCacheControl',
      {
        originalMessages: cacheInput as ContextMessage[],
        messages: preparedMessages as ContextMessage[],
        cacheControl: cacheControl as ExtensionCacheControl | undefined,
      },
      task.project,
      task,
    );
    preparedMessages = (result.messages as ModelMessage[]) ?? preparedMessages;
  }
  if (options) {
    const modelLabel = `${options.providerId}/${options.modelName}`;
    const filterResult = filterAttachmentsForModel(preparedMessages, {
      providerId: options.providerId,
      modelName: options.modelName,
      resolveModalities: options.resolveModalities,
    });
    preparedMessages = filterResult.messages;
    if (options.allowWarnings && task && filterResult.removed.length > 0) {
      reportRemovedAttachments(task, modelLabel, filterResult.removed);
    }
  }
  return preparedMessages;
};

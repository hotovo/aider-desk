import { useCallback, useEffect } from 'react';

import type {
  AutocompletionData,
  ContextFilesUpdatedData,
  ContextInfoData,
  ModelsData,
  QuestionData,
  QueuedPromptsUpdatedData,
  TokensInfoData,
} from '@common/types';

import { useApi } from '@/contexts/ApiContext';
import { useProjectStore } from '@/stores/projectStore';
import { setTaskAllFiles, setTaskAutocompletionWords } from '@/stores/taskFilesStore';
import { updateTaskState, setQuestion, setTokensInfo, setAiderModelsData, setQueuedPrompts, touchTaskActivity } from '@/stores/taskStore';
import { getTaskDir } from '@/utils/task-utils';

const getTaskDirById = (baseDir: string, taskId: string) => {
  const tasks = useProjectStore.getState().projectTasksMap.get(baseDir) || [];
  const task = tasks.find((t) => t.id === taskId);
  return task ? getTaskDir(task) : baseDir;
};

export const useTaskDataHandlers = (baseDir: string, taskId: string) => {
  const api = useApi();

  const handleUpdateAutocompletion = useCallback(
    ({ allFiles, words }: AutocompletionData) => {
      const taskDir = getTaskDirById(baseDir, taskId);
      if (allFiles) {
        setTaskAllFiles(taskId, taskDir, allFiles);
      }
      if (words) {
        setTaskAutocompletionWords(taskId, taskDir, words);
      }
    },
    [baseDir, taskId],
  );

  const handleTokensInfo = useCallback(
    (data: TokensInfoData) => {
      setTokensInfo(taskId, data);
    },
    [taskId],
  );

  const handleQuestion = useCallback(
    (data: QuestionData) => {
      setQuestion(taskId, data);
    },
    [taskId],
  );

  const handleQuestionAnswered = useCallback(() => {
    setQuestion(taskId, null);
  }, [taskId]);

  const handleContextFilesUpdated = useCallback(
    ({ files }: ContextFilesUpdatedData) => {
      touchTaskActivity(taskId);
      updateTaskState(taskId, { contextFiles: files });
    },
    [taskId],
  );

  const handleUpdateAiderModels = useCallback(
    (data: ModelsData) => {
      touchTaskActivity(taskId);
      setAiderModelsData(taskId, data);
    },
    [taskId],
  );

  const handleQueuedPromptsUpdated = useCallback(
    ({ queuedPrompts }: QueuedPromptsUpdatedData) => {
      touchTaskActivity(taskId);
      setQueuedPrompts(taskId, queuedPrompts);
    },
    [taskId],
  );

  const handleContextInfoUpdated = useCallback(
    ({ canUndoContextChange }: ContextInfoData) => {
      updateTaskState(taskId, { canUndoContextChange });
    },
    [taskId],
  );

  useEffect(() => {
    const removeAutocompletion = api.addUpdateAutocompletionListener(baseDir, taskId, handleUpdateAutocompletion);
    const removeTokensInfo = api.addTokensInfoListener(baseDir, taskId, handleTokensInfo);
    const removeAskQuestion = api.addAskQuestionListener(baseDir, taskId, handleQuestion);
    const removeQuestionAnswered = api.addQuestionAnsweredListener(baseDir, taskId, handleQuestionAnswered);
    const removeContextFiles = api.addContextFilesUpdatedListener(baseDir, taskId, handleContextFilesUpdated);
    const removeUpdateAiderModels = api.addUpdateAiderModelsListener(baseDir, taskId, handleUpdateAiderModels);
    const removeQueuedPrompts = api.addQueuedPromptsUpdatedListener(baseDir, taskId, handleQueuedPromptsUpdated);
    const removeContextInfoUpdated = api.addContextInfoUpdatedListener(baseDir, taskId, handleContextInfoUpdated);

    return () => {
      removeAutocompletion();
      removeTokensInfo();
      removeAskQuestion();
      removeQuestionAnswered();
      removeContextFiles();
      removeUpdateAiderModels();
      removeQueuedPrompts();
      removeContextInfoUpdated();
    };
  }, [
    api,
    baseDir,
    taskId,
    handleUpdateAutocompletion,
    handleTokensInfo,
    handleQuestion,
    handleQuestionAnswered,
    handleContextFilesUpdated,
    handleUpdateAiderModels,
    handleQueuedPromptsUpdated,
    handleContextInfoUpdated,
  ]);
};

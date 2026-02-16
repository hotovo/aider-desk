import { useCallback, useEffect } from 'react';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/vanilla/shallow';

import type { AutocompletionData, ContextFilesUpdatedData, ModelsData, QuestionData, QueuedPromptsUpdatedData, TokensInfoData } from '@common/types';

import { useApi } from '@/contexts/ApiContext';
import { useTaskStore } from '@/stores/taskStore';

export const useTaskDataHandlers = (baseDir: string, taskId: string) => {
  const api = useApi();
  const updateTaskState = useStoreWithEqualityFn(useTaskStore, (storeState) => storeState.updateTaskState, shallow);
  const setQuestion = useStoreWithEqualityFn(useTaskStore, (storeState) => storeState.setQuestion, shallow);
  const setAllFiles = useStoreWithEqualityFn(useTaskStore, (storeState) => storeState.setAllFiles, shallow);
  const setAutocompletionWords = useStoreWithEqualityFn(useTaskStore, (storeState) => storeState.setAutocompletionWords, shallow);
  const setTokensInfo = useStoreWithEqualityFn(useTaskStore, (storeState) => storeState.setTokensInfo, shallow);
  const setAiderModelsData = useStoreWithEqualityFn(useTaskStore, (storeState) => storeState.setAiderModelsData, shallow);
  const setQueuedPrompts = useStoreWithEqualityFn(useTaskStore, (storeState) => storeState.setQueuedPrompts, shallow);

  const handleUpdateAutocompletion = useCallback(
    ({ allFiles, words }: AutocompletionData) => {
      if (allFiles) {
        setAllFiles(taskId, allFiles);
      }
      if (words) {
        setAutocompletionWords(taskId, words);
      }
    },
    [taskId, setAllFiles, setAutocompletionWords],
  );

  const handleTokensInfo = useCallback(
    (data: TokensInfoData) => {
      setTokensInfo(taskId, data);
    },
    [taskId, setTokensInfo],
  );

  const handleQuestion = useCallback(
    (data: QuestionData) => {
      setQuestion(taskId, data);
    },
    [taskId, setQuestion],
  );

  const handleQuestionAnswered = useCallback(() => {
    setQuestion(taskId, null);
  }, [taskId, setQuestion]);

  const handleContextFilesUpdated = useCallback(
    ({ files }: ContextFilesUpdatedData) => {
      updateTaskState(taskId, { contextFiles: files });
    },
    [taskId, updateTaskState],
  );

  const handleUpdateAiderModels = useCallback(
    (data: ModelsData) => {
      setAiderModelsData(taskId, data);
    },
    [taskId, setAiderModelsData],
  );

  const handleQueuedPromptsUpdated = useCallback(
    ({ queuedPrompts }: QueuedPromptsUpdatedData) => {
      setQueuedPrompts(taskId, queuedPrompts);
    },
    [taskId, setQueuedPrompts],
  );

  useEffect(() => {
    const removeAutocompletion = api.addUpdateAutocompletionListener(baseDir, taskId, handleUpdateAutocompletion);
    const removeTokensInfo = api.addTokensInfoListener(baseDir, taskId, handleTokensInfo);
    const removeAskQuestion = api.addAskQuestionListener(baseDir, taskId, handleQuestion);
    const removeQuestionAnswered = api.addQuestionAnsweredListener(baseDir, taskId, handleQuestionAnswered);
    const removeContextFiles = api.addContextFilesUpdatedListener(baseDir, taskId, handleContextFilesUpdated);
    const removeUpdateAiderModels = api.addUpdateAiderModelsListener(baseDir, taskId, handleUpdateAiderModels);
    const removeQueuedPrompts = api.addQueuedPromptsUpdatedListener(baseDir, taskId, handleQueuedPromptsUpdated);

    return () => {
      removeAutocompletion();
      removeTokensInfo();
      removeAskQuestion();
      removeQuestionAnswered();
      removeContextFiles();
      removeUpdateAiderModels();
      removeQueuedPrompts();
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
  ]);
};

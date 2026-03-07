import { AgentProfile, AIDER_MODES, EditFormat, Mode, Model, ModelsData, RawModelInfo, TaskData } from '@common/types';
import React, { ReactNode, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { BsCodeSlash, BsFilter, BsLayoutSidebar } from 'react-icons/bs';
import { CgTerminal } from 'react-icons/cg';
import { GoProjectRoadmap } from 'react-icons/go';
import { IoMdClose } from 'react-icons/io';
import { VscLock, VscUnlock } from 'react-icons/vsc';
import { RiRobot2Line, RiMenuUnfold4Line } from 'react-icons/ri';
import { useTranslation } from 'react-i18next';
import { getProviderModelId, AVAILABLE_PROVIDERS } from '@common/agent';
import { clsx } from 'clsx';
import { extractProviderModel } from '@common/utils';

import { IconButton } from '@/components/common/IconButton';
import { ModelSelector, ModelSelectorRef } from '@/components/ModelSelector';
import { showErrorNotification } from '@/utils/notifications';
import { EditFormatSelector } from '@/components/PromptField/EditFormatSelector';
import { TaskWorkingMode } from '@/components/PromptField/TaskWorkingMode';
import { Tooltip } from '@/components/ui/Tooltip';
import { useSettings } from '@/contexts/SettingsContext';
import { useApi } from '@/contexts/ApiContext';
import { useResponsive } from '@/hooks/useResponsive';
import { useModelProviders } from '@/contexts/ModelProviderContext';

export type TaskBarRef = {
  openMainModelSelector: (model?: string) => void;
  openAgentModelSelector: (model?: string) => void;
};

type Props = {
  baseDir: string;
  task: TaskData;
  modelsData: ModelsData | null;
  mode: Mode;
  activeAgentProfile: AgentProfile | null;
  onModelsChange?: (modelsData: ModelsData | null) => void;
  runCommand: (command: string) => void;
  onToggleSidebar: () => void;
  onToggleTaskSidebar?: () => void;
  updateTask: (taskId: string, updates: Partial<TaskData>, useOptimistic?: boolean) => void;
};

export const TaskBar = React.forwardRef<TaskBarRef, Props>(
  ({ baseDir, task, modelsData, mode, activeAgentProfile, onModelsChange, runCommand, onToggleSidebar, onToggleTaskSidebar, updateTask }, ref) => {
    const { t } = useTranslation();
    const { settings, saveSettings } = useSettings();
    const { models, providers } = useModelProviders();
    const api = useApi();
    const { isMobile } = useResponsive();
    const [isMerging, setIsMerging] = useState(false);

    const updatePreferredModels = useCallback(
      (model: string) => {
        if (!settings) {
          return;
        }
        const updatedSettings = {
          ...settings,
          preferredModels: [...new Set([model, ...settings.preferredModels])],
        };
        void saveSettings(updatedSettings);
      },
      [saveSettings, settings],
    );

    const aiderModels = useMemo(() => {
      const aiderModels: Model[] = [...models];
      aiderModels.sort((model, otherModel) => {
        const modelId = getProviderModelId(model);
        const otherModelId = getProviderModelId(otherModel);
        return modelId.localeCompare(otherModelId);
      });

      return aiderModels;
    }, [models]);
    const agentModelSelectorRef = useRef<ModelSelectorRef>(null);
    const mainModelSelectorRef = useRef<ModelSelectorRef>(null);
    const architectModelSelectorRef = useRef<ModelSelectorRef>(null);

    const showAiderInfo = AIDER_MODES.includes(mode) || activeAgentProfile?.useAiderTools || false;

    // Use task provider/model first, fallback to active agent profile
    const effectiveAgentProvider = task.provider || activeAgentProfile?.provider;
    const effectiveAgentModel = task.model || activeAgentProfile?.model;
    const currentTaskModelId = effectiveAgentProvider && effectiveAgentModel ? `${effectiveAgentProvider}/${effectiveAgentModel}` : undefined;

    const taskModels = useMemo(() => {
      const taskModels: Model[] = [...models];

      // Add the currently selected model if it's not in the known list (custom model)
      if (currentTaskModelId) {
        const existingModel = taskModels.find((model) => getProviderModelId(model) === currentTaskModelId);
        if (!existingModel) {
          // Create a custom model object for the current model
          const [providerId, modelId] = extractProviderModel(currentTaskModelId);
          if (providerId && modelId) {
            const customModel: Model = {
              id: modelId,
              providerId: providerId,
            };
            taskModels.unshift(customModel); // Add to the beginning for visibility
          }
        }
      }
      return taskModels;
    }, [currentTaskModelId, models]);

    const handleTaskModelChange = useCallback(
      (selectedModel: Model) => {
        const selectedModelId = getProviderModelId(selectedModel);
        const providerId = selectedModel.providerId;
        const modelId = selectedModel.id;

        if (!providerId || !modelId) {
          showErrorNotification(
            t('modelSelector.invalidModelSelection', {
              model: selectedModelId,
            }),
          );
          return;
        }

        const provider = providers.find((provider) => provider.id === providerId);
        if (!provider) {
          showErrorNotification(
            t('modelSelector.providerNotSupported', {
              provider: providerId,
              providers: AVAILABLE_PROVIDERS.join(', '),
            }),
          );
          return;
        }

        updateTask(task.id, {
          provider: provider.id,
          model: modelId,
        });

        updatePreferredModels(selectedModelId);
      },
      [providers, updateTask, task.id, updatePreferredModels, t],
    );

    useImperativeHandle(ref, () => ({
      openMainModelSelector: (model) => {
        if (mode === 'architect') {
          architectModelSelectorRef.current?.open(model);
        } else {
          mainModelSelectorRef.current?.open(model);
        }
      },
      openAgentModelSelector: (model) => {
        agentModelSelectorRef.current?.open(model);
      },
    }));

    const renderModelInfo = useCallback(
      (modelName: string, info: RawModelInfo | undefined): ReactNode => {
        if (!info) {
          return <div className="text-xs text-text-primary">{modelName}</div>;
        }

        return (
          <div className="text-2xs text-text-secondary">
            <div className="flex items-center font-semibold text-xs text-text-primary mb-0.5">{modelName}</div>
            <div className="flex items-center">
              <span className="flex-1 mr-2">{t('modelInfo.maxInputTokens')}:</span> {info.max_input_tokens}
            </div>
            <div className="flex items-center">
              <span className="flex-1 mr-2">{t('modelInfo.maxOutputTokens')}:</span> {info.max_output_tokens}
            </div>
            <div className="flex items-center">
              <span className="flex-1 mr-2">{t('modelInfo.inputCostPerMillion')}:</span> ${((info.input_cost_per_token ?? 0) * 1_000_000).toFixed(2)}
            </div>
            <div className="flex items-center">
              <span className="flex-1 mr-2">{t('modelInfo.outputCostPerMillion')}:</span> ${((info.output_cost_per_token ?? 0) * 1_000_000).toFixed(2)}
            </div>
          </div>
        );
      },
      [t],
    );

    const updateEditFormat = useCallback(
      (format: EditFormat, modelToUpdate?: string) => {
        const targetModel = modelToUpdate || modelsData?.mainModel;
        if (!targetModel) {
          return;
        }

        api.updateEditFormats(baseDir, { [targetModel]: format });

        if (modelsData && onModelsChange) {
          // optimistic update
          onModelsChange({
            ...modelsData,
            editFormat: format,
          });
        }
      },
      [baseDir, modelsData, onModelsChange, api],
    );

    const updateMainModel = useCallback(
      (mainModel: Model) => {
        const modelId = getProviderModelId(mainModel);
        api.updateMainModel(baseDir, task.id, modelId);
        updatePreferredModels(modelId);

        if (modelsData && onModelsChange) {
          onModelsChange(null);
        }
      },
      [api, baseDir, task.id, modelsData, onModelsChange, updatePreferredModels],
    );

    const updateWeakModel = useCallback(
      (weakModel: Model) => {
        const modelId = getProviderModelId(weakModel);
        api.updateWeakModel(baseDir, task.id, modelId);
        updatePreferredModels(modelId);
        if (modelsData && onModelsChange) {
          onModelsChange({
            ...modelsData,
            weakModel: modelId,
          });
        }
      },
      [api, baseDir, task.id, updatePreferredModels, modelsData, onModelsChange],
    );

    const toggleWeakModelLock = useCallback(() => {
      updateTask(task.id, {
        weakModelLocked: !task.weakModelLocked,
      });
    }, [task.id, task.weakModelLocked, updateTask]);

    const updateArchitectModel = useCallback(
      (architectModel: Model) => {
        const modelId = getProviderModelId(architectModel);
        api.updateArchitectModel(baseDir, task.id, modelId);
        updatePreferredModels(modelId);
        if (modelsData && onModelsChange) {
          onModelsChange({
            ...modelsData,
            architectModel: modelId,
          });
        }
      },
      [api, baseDir, task.id, modelsData, onModelsChange, updatePreferredModels],
    );

    const handleRemovePreferredModel = (model: string) => {
      if (!settings) {
        return;
      }
      const updatedSettings = {
        ...settings,
        preferredModels: settings.preferredModels.filter((preferred) => preferred !== model),
      };
      void saveSettings(updatedSettings);
    };

    const handleMerge = useCallback(
      async (squash: boolean, targetBranch?: string, commitMessage?: string) => {
        if (!task.worktree) {
          return;
        }

        setIsMerging(true);
        try {
          await api.mergeWorktreeToMain(baseDir, task.id, squash, targetBranch, commitMessage);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Failed to merge worktree:', error);
        } finally {
          setIsMerging(false);
        }
      },
      [api, baseDir, task.id, task.worktree],
    );

    const handleRebaseFromBranch = useCallback(
      async (fromBranch?: string) => {
        if (!task.worktree) {
          return;
        }

        setIsMerging(true);
        try {
          await api.rebaseWorktreeFromBranch(baseDir, task.id, fromBranch);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Failed to rebase worktree:', error);
        } finally {
          setIsMerging(false);
        }
      },
      [api, baseDir, task.id, task.worktree],
    );

    const handleAbortRebase = useCallback(async () => {
      if (!task.worktree) {
        return;
      }

      setIsMerging(true);
      try {
        await api.abortWorktreeRebase(baseDir, task.id);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to abort rebase:', error);
      } finally {
        setIsMerging(false);
      }
    }, [api, baseDir, task.id, task.worktree]);

    const handleContinueRebase = useCallback(async () => {
      if (!task.worktree) {
        return;
      }

      setIsMerging(true);
      try {
        await api.continueWorktreeRebase(baseDir, task.id);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to continue rebase:', error);
      } finally {
        setIsMerging(false);
      }
    }, [api, baseDir, task.id, task.worktree]);

    const handleResolveConflictsWithAgent = useCallback(async () => {
      if (!task.worktree) {
        return;
      }

      setIsMerging(true);
      try {
        await api.resolveWorktreeConflictsWithAgent(baseDir, task.id);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to resolve conflicts with agent:', error);
      } finally {
        setIsMerging(false);
      }
    }, [api, baseDir, task.id, task.worktree]);

    const handleOnlyUncommitted = useCallback(
      async (targetBranch?: string) => {
        if (!task.worktree) {
          return;
        }

        setIsMerging(true);
        try {
          await api.applyUncommittedChanges(baseDir, task.id, targetBranch);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Failed to apply uncommitted changes:', error);
        } finally {
          setIsMerging(false);
        }
      },
      [api, baseDir, task.id, task.worktree],
    );

    const handleRevert = useCallback(async () => {
      setIsMerging(true);
      try {
        await api.revertLastMerge(baseDir, task.id);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to revert merge:', error);
      } finally {
        setIsMerging(false);
      }
    }, [api, baseDir, task.id]);

    const isTwoRowLayout = !AIDER_MODES.includes(mode) && showAiderInfo;
    const renderAiderInfo = (showLabel = false) => {
      return (
        <div className={clsx('flex flex-wrap gap-x-2 flex-shrink-0', isMobile ? 'flex-col items-start gap-y-1' : 'flex-row items-center gap-y-0.5')}>
          {showLabel && <span className="text-2xs font-semibold text-text-primary uppercase whitespace-nowrap">{t('projectBar.aider')}:</span>}
          <div className="flex items-center space-x-2 flex-shrink-0">
            <Tooltip content={renderModelInfo(t('modelSelector.mainModel'), modelsData?.info)}>
              <CgTerminal className="w-4 h-4 text-text-primary mr-1" />
            </Tooltip>
            <ModelSelector
              ref={mainModelSelectorRef}
              models={aiderModels}
              selectedModelId={modelsData?.mainModel}
              onChange={updateMainModel}
              preferredModelIds={settings?.preferredModels || []}
              removePreferredModel={handleRemovePreferredModel}
              providers={providers}
            />
          </div>
          {!isMobile && <div className="h-3 w-px bg-bg-fourth flex-shrink-0"></div>}
          <div className="flex items-center space-x-2 flex-shrink-0">
            <Tooltip content={t('modelSelector.weakModel')}>
              <BsFilter className="w-4 h-4 text-text-primary mr-1" />
            </Tooltip>
            <ModelSelector
              models={aiderModels}
              selectedModelId={modelsData?.weakModel || modelsData?.mainModel}
              onChange={updateWeakModel}
              preferredModelIds={settings?.preferredModels || []}
              removePreferredModel={handleRemovePreferredModel}
              providers={providers}
            />
            {task.weakModel && (
              <IconButton
                icon={task.weakModelLocked ? <VscLock className="w-4 h-4" /> : <VscUnlock className="w-4 h-4" />}
                onClick={toggleWeakModelLock}
                tooltip={task.weakModelLocked ? t('modelSelector.weakModelUnlock') : t('modelSelector.weakModelLock')}
              />
            )}
          </div>
          {modelsData?.editFormat && (
            <>
              {!isMobile && <div className="h-3 w-px bg-bg-fourth flex-shrink-0"></div>}
              <div className="flex items-center space-x-1 flex-shrink-0">
                <Tooltip content={t('projectBar.editFormatTooltip')}>
                  <BsCodeSlash className="w-4 h-4 text-text-primary mr-1" />
                </Tooltip>
                <EditFormatSelector currentFormat={modelsData.editFormat} onFormatChange={updateEditFormat} />
              </div>
            </>
          )}
          {modelsData?.reasoningEffort && modelsData.reasoningEffort !== 'none' && (
            <>
              {!isMobile && <div className="h-3 w-px bg-bg-fourth flex-shrink-0"></div>}
              <div className="flex items-center space-x-1 group/reasoning flex-shrink-0">
                <span className="text-2xs text-text-muted-light whitespace-nowrap">{t('modelSelector.reasoning')}:</span>
                <span className="text-text-primary text-2xs whitespace-nowrap">{modelsData.reasoningEffort}</span>
                <IconButton icon={<IoMdClose className="w-3 h-3" />} onClick={() => runCommand('reasoning-effort none')} className="ml-0.5" />
              </div>
            </>
          )}
          {modelsData?.thinkingTokens && modelsData?.thinkingTokens !== '0' && (
            <>
              {!isMobile && <div className="h-3 w-px bg-bg-fourth flex-shrink-0"></div>}
              <div className="flex items-center space-x-1 group/thinking flex-shrink-0">
                <span className="text-2xs text-text-muted-light whitespace-nowrap">{t('modelSelector.thinkingTokens')}:</span>
                <span className="text-text-primary text-2xs whitespace-nowrap">{modelsData.thinkingTokens}</span>
                <IconButton icon={<IoMdClose className="w-3 h-3" />} onClick={() => runCommand('think-tokens 0')} className="ml-0.5" />
              </div>
            </>
          )}
        </div>
      );
    };

    return (
      <div className="relative group px-2 py-2 pr-1 border-b border-border-dark-light bg-bg-primary-light">
        <div className="flex items-center h-full">
          {/* Task sidebar toggle for mobile */}
          {isMobile && onToggleTaskSidebar && (
            <IconButton icon={<RiMenuUnfold4Line className="w-5 h-5" />} onClick={onToggleTaskSidebar} className="p-1 hover:bg-bg-tertiary rounded-md mr-3" />
          )}
          <div className="flex-grow">
            {isTwoRowLayout ? (
              // Two-row layout for Agent mode with Aider tools
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {/* Row 1: AGENT */}
                <div className="flex items-center space-x-2 flex-shrink-0">
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <Tooltip content={t('modelSelector.agentModel')}>
                      <RiRobot2Line className="w-4 h-4 text-text-primary mr-1" />
                    </Tooltip>
                    {!currentTaskModelId ? (
                      <div className="text-xs text-text-muted-light whitespace-nowrap">{t('modelSelector.noModelSelected')}</div>
                    ) : (
                      <ModelSelector
                        ref={agentModelSelectorRef}
                        models={taskModels}
                        selectedModelId={currentTaskModelId}
                        onChange={handleTaskModelChange}
                        preferredModelIds={settings?.preferredModels || []}
                        removePreferredModel={handleRemovePreferredModel}
                        providers={providers}
                      />
                    )}
                  </div>
                </div>

                {/* Row 2: AIDER */}
                {renderAiderInfo(true)}
              </div>
            ) : (
              // Original horizontal layout for other modes
              <div className="flex items-center space-x-3 flex-wrap">
                {!AIDER_MODES.includes(mode) ? (
                  <>
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <Tooltip content={t('modelSelector.agentModel')}>
                        <RiRobot2Line className="w-4 h-4 text-text-primary mr-1" />
                      </Tooltip>
                      {!currentTaskModelId ? (
                        <div className="text-xs text-text-muted-light whitespace-nowrap">{t('modelSelector.noModelSelected')}</div>
                      ) : (
                        <ModelSelector
                          ref={agentModelSelectorRef}
                          models={taskModels}
                          selectedModelId={currentTaskModelId}
                          onChange={handleTaskModelChange}
                          preferredModelIds={settings?.preferredModels || []}
                          removePreferredModel={handleRemovePreferredModel}
                          providers={providers}
                        />
                      )}
                    </div>
                    {showAiderInfo && <div className="h-3 w-px bg-bg-fourth flex-shrink-0"></div>}
                  </>
                ) : (
                  <>
                    {mode === 'architect' && (
                      <>
                        <div className="flex items-center space-x-2 flex-shrink-0">
                          <Tooltip content={t('modelSelector.architectModel')}>
                            <GoProjectRoadmap className="w-4 h-4 text-text-primary mr-1" />
                          </Tooltip>
                          <ModelSelector
                            ref={architectModelSelectorRef}
                            models={aiderModels}
                            selectedModelId={modelsData?.architectModel || modelsData?.mainModel}
                            onChange={updateArchitectModel}
                            preferredModelIds={settings?.preferredModels || []}
                            removePreferredModel={handleRemovePreferredModel}
                            providers={providers}
                          />
                        </div>
                        <div className="h-3 w-px bg-bg-fourth"></div>
                      </>
                    )}
                  </>
                )}
                {showAiderInfo && renderAiderInfo()}
              </div>
            )}
          </div>
          <div className="flex items-center space-x-1 mr-2">
            <TaskWorkingMode
              task={task}
              onMerge={(branch) => handleMerge(false, branch)}
              onSquash={(branch, commitMessage) => handleMerge(true, branch, commitMessage)}
              onOnlyUncommitted={handleOnlyUncommitted}
              onRebaseFromBranch={handleRebaseFromBranch}
              onAbortRebase={handleAbortRebase}
              onContinueRebase={handleContinueRebase}
              onResolveConflictsWithAgent={handleResolveConflictsWithAgent}
              onRevert={handleRevert}
              isMerging={isMerging}
            />
            {isMobile && (
              <IconButton
                icon={<BsLayoutSidebar className="w-4 h-4" />}
                onClick={onToggleSidebar}
                tooltip={t('projectBar.toggleSidebar')}
                className="p-1 hover:bg-bg-tertiary rounded-md"
              />
            )}
          </div>
        </div>
      </div>
    );
  },
);

TaskBar.displayName = 'ProjectTopBar';

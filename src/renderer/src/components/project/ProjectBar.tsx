import { ModelsData, SessionData, RawModelInfo, Mode } from '@common/types';
import React, { ReactNode, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { BsFilter } from 'react-icons/bs';
import { CgSpinner, CgTerminal } from 'react-icons/cg';
import { GoProjectRoadmap } from 'react-icons/go';
import { MdHistory } from 'react-icons/md';
import { RiRobot2Line } from 'react-icons/ri';
import { useTranslation } from 'react-i18next';
import { getActiveProvider } from '@common/llm-providers';

import { AgentModelSelector } from '@/components/AgentModelSelector';
import { ModelSelector, ModelSelectorRef } from '@/components/ModelSelector';
import { SessionsPopup } from '@/components/SessionsPopup';
import { StyledTooltip } from '@/components/common/StyledTooltip';
import { useSettings } from '@/context/SettingsContext';
import { useClickOutside } from '@/hooks/useClickOutside';
import { useBooleanState } from '@/hooks/useBooleanState';

export type ProjectTopBarRef = {
  openMainModelSelector: () => void;
};

type Props = {
  baseDir: string;
  allModels?: string[];
  modelsData: ModelsData | null;
  mode: Mode;
  onModelChange?: () => void;
  onExportSessionToImage: () => void;
};

export const ProjectBar = React.forwardRef<ProjectTopBarRef, Props>(
  ({ baseDir, allModels = [], modelsData, mode, onModelChange, onExportSessionToImage }, ref) => {
    const { t } = useTranslation();
    const { settings, saveSettings } = useSettings();
    const mainModelSelectorRef = useRef<ModelSelectorRef>(null);
    const architectModelSelectorRef = useRef<ModelSelectorRef>(null);
    const [sessions, setSessions] = useState<SessionData[]>([]);
    const [sessionPopupVisible, showSessionPopup, hideSessionPopup] = useBooleanState(false);
    const sessionPopupRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      openMainModelSelector: () => {
        if (mode === 'architect') {
          architectModelSelectorRef.current?.open();
        } else {
          mainModelSelectorRef.current?.open();
        }
      },
    }));

    useClickOutside(sessionPopupRef, hideSessionPopup);

    const renderModelInfo = useCallback(
      (modelName: string, info: RawModelInfo | undefined): ReactNode => {
        if (!info) {
          return <div className="text-xs text-neutral-100">{modelName}</div>;
        }

        return (
          <div className="text-xxs text-neutral-200">
            <div className="flex items-center font-semibold text-xs text-neutral-100 mb-0.5">{modelName}</div>
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

    const updatePreferredModels = useCallback(
      (model: string) => {
        if (!settings) {
          return;
        }
        const updatedSettings = {
          ...settings,
          models: {
            ...settings.models,
            preferred: [model, ...settings.models.preferred.filter((m) => m !== model)],
          },
        };
        void saveSettings(updatedSettings);
      },
      [saveSettings, settings],
    );

    const updateMainModel = useCallback(
      (mainModel: string) => {
        window.api.updateMainModel(baseDir, mainModel);
        updatePreferredModels(mainModel);
        onModelChange?.();
      },
      [baseDir, onModelChange, updatePreferredModels],
    );

    const updateWeakModel = useCallback(
      (weakModel: string) => {
        window.api.updateWeakModel(baseDir, weakModel);
        updatePreferredModels(weakModel);
        onModelChange?.();
      },
      [baseDir, onModelChange, updatePreferredModels],
    );

    const updateArchitectModel = useCallback(
      (architectModel: string) => {
        window.api.updateArchitectModel(baseDir, architectModel);
        updatePreferredModels(architectModel);
        onModelChange?.();
      },
      [baseDir, onModelChange, updatePreferredModels],
    );

    const loadSessions = useCallback(async () => {
      try {
        const sessionsList = await window.api.listSessions(baseDir);
        setSessions(sessionsList);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to load sessions:', error);
        setSessions([]);
      }
    }, [baseDir]);

    const saveSession = useCallback(
      async (name: string) => {
        try {
          await window.api.saveSession(baseDir, name);
          await loadSessions();
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Failed to save session:', error);
        }
      },
      [baseDir, loadSessions],
    );

    const loadSessionMessages = useCallback(
      async (name: string) => {
        try {
          await window.api.loadSessionMessages(baseDir, name);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Failed to load session messages:', error);
        }
      },
      [baseDir],
    );

    const loadSessionFiles = useCallback(
      async (name: string) => {
        try {
          await window.api.loadSessionFiles(baseDir, name);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Failed to load session files:', error);
        }
      },
      [baseDir],
    );

    const deleteSession = useCallback(
      async (name: string) => {
        try {
          await window.api.deleteSession(baseDir, name);
          await loadSessions();
        } catch (error) {
          console.error('Failed to delete session:', error);
        }
      },
      [baseDir, loadSessions],
    );

    const exportSessionToMarkdown = useCallback(async () => {
      try {
        const result = await window.api.exportSessionToMarkdown(baseDir);
        console.log(result);
      } catch (error) {
        console.error('Failed to export session:', error);
      }
    }, [baseDir]);

    useEffect(() => {
      if (sessionPopupVisible) {
        void loadSessions();
      }
    }, [sessionPopupVisible, loadSessions]);

    return (
      <div className="relative group h-[24px]">
        {!modelsData ? (
          <div className="text-xs h-full flex items-center">
            <CgSpinner className="w-4 h-4 text-neutral-100 mr-2 animate-spin" />
            {t('modelSelector.loadingModel')}
          </div>
        ) : (
          <div className="flex items-center h-full">
            <div className="flex-grow flex items-center space-x-3">
              {mode === 'agent' && settings?.agentConfig ? (
                getActiveProvider(settings.agentConfig.providers) ? (
                  <>
                    <div className="flex items-center space-x-1">
                      <RiRobot2Line className="w-4 h-4 text-neutral-100 mr-1" data-tooltip-id="agent-tooltip" />
                      <StyledTooltip id="agent-tooltip" content={t('modelSelector.agentModel')} />
                      <AgentModelSelector />
                    </div>
                    <div className="h-3 w-px bg-neutral-600/50"></div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center space-x-1 text-xs text-neutral-400">
                      <RiRobot2Line className="w-4 h-4 text-neutral-100 mr-1" />
                      <span>{t('modelSelector.noActiveAgentProvider')}</span>
                    </div>
                    <div className="h-3 w-px bg-neutral-600/50"></div>
                  </>
                )
              ) : (
                <>
                  {mode === 'architect' && (
                    <>
                      <div className="flex items-center space-x-1">
                        <GoProjectRoadmap
                          className="w-4 h-4 text-neutral-100 mr-1"
                          data-tooltip-id="architect-model-tooltip"
                          data-tooltip-content={t('modelSelector.architectModel')}
                        />
                        <StyledTooltip id="architect-model-tooltip" />
                        <ModelSelector
                          ref={architectModelSelectorRef}
                          models={allModels}
                          selectedModel={modelsData.architectModel || modelsData.mainModel}
                          onChange={updateArchitectModel}
                        />
                      </div>
                      <div className="h-3 w-px bg-neutral-600/50"></div>
                    </>
                  )}
                </>
              )}
              <div className="flex items-center space-x-1">
                <CgTerminal className="w-4 h-4 text-neutral-100 mr-1" data-tooltip-id="main-model-tooltip" />
                <StyledTooltip
                  id="main-model-tooltip"
                  content={renderModelInfo(t(mode === 'architect' ? 'modelSelector.editorModel' : 'modelSelector.mainModel'), modelsData.info)}
                />
                <ModelSelector ref={mainModelSelectorRef} models={allModels} selectedModel={modelsData.mainModel} onChange={updateMainModel} />
              </div>
              <div className="h-3 w-px bg-neutral-600/50"></div>
              <div className="flex items-center space-x-1">
                <BsFilter className="w-4 h-4 text-neutral-100 mr-1" data-tooltip-id="weak-model-tooltip" data-tooltip-content={t('modelSelector.weakModel')} />
                <StyledTooltip id="weak-model-tooltip" />
                <ModelSelector models={allModels} selectedModel={modelsData.weakModel || modelsData.mainModel} onChange={updateWeakModel} />
              </div>
              {modelsData.reasoningEffort && (
                <>
                  <div className="h-3 w-px bg-neutral-600/50"></div>
                  <div className="flex items-center space-x-1">
                    <span className="text-xs">{t('modelSelector.reasoning')}:</span>
                    <span className="text-neutral-400 text-xs">{modelsData.reasoningEffort}</span>
                  </div>
                </>
              )}
              {modelsData.thinkingTokens && (
                <>
                  <div className="h-3 w-px bg-neutral-600/50"></div>
                  <div className="flex items-center space-x-1">
                    <span className="text-xs">{t('modelSelector.thinkingTokens')}:</span>
                    <span className="text-neutral-400 text-xs">{modelsData.thinkingTokens}</span>
                  </div>
                </>
              )}
            </div>
            <div className="relative">
              <button
                onClick={showSessionPopup}
                className="p-1 hover:bg-neutral-700 rounded-md flex text-neutral-200"
                data-tooltip-id="session-history-tooltip"
                data-tooltip-content={t('sessions.title')}
              >
                <MdHistory className="w-4 h-4" />
              </button>
              <StyledTooltip id="session-history-tooltip" />
              {sessionPopupVisible && (
                <div ref={sessionPopupRef}>
                  <SessionsPopup
                    sessions={sessions}
                    onLoadSessionMessages={loadSessionMessages}
                    onLoadSessionFiles={loadSessionFiles}
                    onSaveSession={saveSession}
                    onDeleteSession={deleteSession}
                    onExportSessionToMarkdown={exportSessionToMarkdown}
                    onExportSessionToImage={onExportSessionToImage}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  },
);

ProjectBar.displayName = 'ProjectTopBar';

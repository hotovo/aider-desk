import { EditFormat, Mode, ModelsData, RawModelInfo, SessionData } from '@common/types';
import React, { ReactNode, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { BsCodeSlash, BsFilter } from 'react-icons/bs';
import { CgTerminal } from 'react-icons/cg';
import { GoProjectRoadmap } from 'react-icons/go';
import { IoMdClose } from 'react-icons/io';
import { MdHistory } from 'react-icons/md';
import { IoLogoMarkdown } from 'react-icons/io5';
import { RiRobot2Line } from 'react-icons/ri';
import { useTranslation } from 'react-i18next';

import { IconButton } from '@/components/common/IconButton';
import { AgentModelSelector } from '@/components/AgentModelSelector';
import { ModelSelector, ModelSelectorRef } from '@/components/ModelSelector';
import { EditFormatSelector } from '@/components/PromptField/EditFormatSelector';
import { SessionsPopup } from '@/components/SessionsPopup';
import { StyledTooltip } from '@/components/common/StyledTooltip';
import { useSettings } from '@/context/SettingsContext';
import { useClickOutside } from '@/hooks/useClickOutside';
import { useBooleanState } from '@/hooks/useBooleanState';
import { showSuccessNotification } from '@/utils/notifications';

export type ProjectTopBarRef = {
  openMainModelSelector: (model?: string) => void;
  openAgentModelSelector: (model?: string) => void;
};

type Props = {
  baseDir: string;
  allModels?: string[];
  modelsData: ModelsData | null;
  mode: Mode;
  renderMarkdown: boolean;
  onModelsChange?: (modelsData: ModelsData | null) => void;
  onRenderMarkdownChanged: (value: boolean) => void;
  onExportSessionToImage: () => void;
  runCommand: (command: string) => void;
};

export const ProjectBar = React.forwardRef<ProjectTopBarRef, Props>(
  ({ baseDir, allModels = [], modelsData, mode, renderMarkdown, onModelsChange, onRenderMarkdownChanged, onExportSessionToImage, runCommand }, ref) => {
    const { t } = useTranslation();
    const { settings, saveSettings } = useSettings();
    const agentModelSelectorRef = useRef<ModelSelectorRef>(null);
    const mainModelSelectorRef = useRef<ModelSelectorRef>(null);
    const architectModelSelectorRef = useRef<ModelSelectorRef>(null);
    const [sessions, setSessions] = useState<SessionData[]>([]);
    const [sessionPopupVisible, showSessionPopup, hideSessionPopup] = useBooleanState(false);
    const sessionPopupRef = useRef<HTMLDivElement>(null);

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

    useClickOutside(sessionPopupRef, hideSessionPopup);

    const toggleSessionPopupVisible = useCallback(() => {
      if (sessionPopupVisible) {
        hideSessionPopup();
      } else {
        showSessionPopup();
      }
    }, [sessionPopupVisible, hideSessionPopup, showSessionPopup]);

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

    const updatePreferredModels = useCallback(
      (model: string) => {
        if (!settings) {
          return;
        }
        const updatedSettings = {
          ...settings,
          models: {
            ...settings.models,
            aiderPreferred: [...new Set([model, ...settings.models.aiderPreferred])],
          },
        };
        void saveSettings(updatedSettings);
      },
      [saveSettings, settings],
    );

    const updateEditFormat = useCallback(
      (format: EditFormat, modelToUpdate?: string) => {
        const targetModel = modelToUpdate || modelsData?.mainModel;
        if (!targetModel) {
          return;
        }

        window.api.updateEditFormats(baseDir, { [targetModel]: format });

        if (modelsData && onModelsChange) {
          // optimistic update
          onModelsChange({
            ...modelsData,
            editFormat: format,
          });
        }
      },
      [baseDir, modelsData, onModelsChange],
    );

    const updateMainModel = useCallback(
      (mainModel: string) => {
        window.api.updateMainModel(baseDir, mainModel);
        updatePreferredModels(mainModel);

        if (modelsData && onModelsChange) {
          onModelsChange(null);
        }
      },
      [baseDir, modelsData, onModelsChange, updatePreferredModels],
    );

    const updateWeakModel = useCallback(
      (weakModel: string) => {
        window.api.updateWeakModel(baseDir, weakModel);
        updatePreferredModels(weakModel);
        if (modelsData && onModelsChange) {
          onModelsChange({
            ...modelsData,
            weakModel,
          });
        }
      },
      [baseDir, modelsData, onModelsChange, updatePreferredModels],
    );

    const updateArchitectModel = useCallback(
      (architectModel: string) => {
        window.api.updateArchitectModel(baseDir, architectModel);
        updatePreferredModels(architectModel);
        if (modelsData && onModelsChange) {
          onModelsChange({
            ...modelsData,
            architectModel,
          });
        }
      },
      [baseDir, modelsData, onModelsChange, updatePreferredModels],
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
          hideSessionPopup();
          showSuccessNotification(t('sessions.sessionSaved'));
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Failed to save session:', error);
        }
      },
      [baseDir, hideSessionPopup, loadSessions, t],
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
          // eslint-disable-next-line no-console
          console.error('Failed to delete session:', error);
        }
      },
      [baseDir, loadSessions],
    );

    const exportSessionToMarkdown = useCallback(async () => {
      try {
        await window.api.exportSessionToMarkdown(baseDir);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to export session:', error);
      }
    }, [baseDir]);

    useEffect(() => {
      if (sessionPopupVisible) {
        void loadSessions();
      }
    }, [sessionPopupVisible, loadSessions]);

    const handleRemovePreferredModel = (model: string) => {
      if (!settings) {
        return;
      }
      const updatedSettings = {
        ...settings,
        models: {
          ...settings.models,
          aiderPreferred: settings.models.aiderPreferred.filter((preferred) => preferred !== model),
        },
      };
      void saveSettings(updatedSettings);
    };

    return (
      <div className="relative group h-[40px] px-4 py-2 pr-1 border-b border-border-dark-light bg-bg-primary-light">
        <div className="flex items-center h-full">
          <div className="flex-grow flex items-center space-x-3">
            {mode === 'agent' ? (
              <>
                <div className="flex items-center space-x-1">
                  <RiRobot2Line className="w-4 h-4 text-text-primary mr-1" data-tooltip-id="agent-tooltip" />
                  <StyledTooltip id="agent-tooltip" content={t('modelSelector.agentModel')} />
                  <AgentModelSelector ref={agentModelSelectorRef} />
                </div>
                <div className="h-3 w-px bg-bg-fourth"></div>
              </>
            ) : (
              <>
                {mode === 'architect' && (
                  <>
                    <div className="flex items-center space-x-1">
                      <GoProjectRoadmap
                        className="w-4 h-4 text-text-primary mr-1"
                        data-tooltip-id="architect-model-tooltip"
                        data-tooltip-content={t('modelSelector.architectModel')}
                      />
                      <StyledTooltip id="architect-model-tooltip" />
                      <ModelSelector
                        ref={architectModelSelectorRef}
                        models={allModels}
                        selectedModel={modelsData?.architectModel || modelsData?.mainModel}
                        onChange={updateArchitectModel}
                        preferredModels={settings?.models.aiderPreferred || []}
                        removePreferredModel={handleRemovePreferredModel}
                      />
                    </div>
                    <div className="h-3 w-px bg-bg-fourth"></div>
                  </>
                )}
              </>
            )}
            <div className="flex items-center space-x-1">
              <CgTerminal className="w-4 h-4 text-text-primary mr-1" data-tooltip-id="main-model-tooltip" />
              <StyledTooltip
                id="main-model-tooltip"
                content={renderModelInfo(t(mode === 'architect' ? 'modelSelector.editorModel' : 'modelSelector.mainModel'), modelsData?.info)}
              />
              <ModelSelector
                ref={mainModelSelectorRef}
                models={allModels}
                selectedModel={modelsData?.mainModel}
                onChange={updateMainModel}
                preferredModels={settings?.models.aiderPreferred || []}
                removePreferredModel={handleRemovePreferredModel}
              />
            </div>
            <div className="h-3 w-px bg-bg-fourth"></div>
            <div className="flex items-center space-x-1">
              <BsFilter className="w-4 h-4 text-text-primary mr-1" data-tooltip-id="weak-model-tooltip" data-tooltip-content={t('modelSelector.weakModel')} />
              <StyledTooltip id="weak-model-tooltip" />
              <ModelSelector
                models={allModels}
                selectedModel={modelsData?.weakModel || modelsData?.mainModel}
                onChange={updateWeakModel}
                preferredModels={settings?.models.aiderPreferred || []}
                removePreferredModel={handleRemovePreferredModel}
              />
            </div>
            {modelsData?.editFormat && (
              <>
                <div className="h-3 w-px bg-bg-fourth"></div>
                <div className="flex items-center space-x-1">
                  <BsCodeSlash className="w-4 h-4 text-text-primary mr-1" data-tooltip-id="edit-format-tooltip" />
                  <StyledTooltip id="edit-format-tooltip" content={t('projectBar.editFormatTooltip')} />
                  <EditFormatSelector currentFormat={modelsData.editFormat} onFormatChange={updateEditFormat} />
                </div>
              </>
            )}
            {modelsData?.reasoningEffort && modelsData.reasoningEffort !== 'none' && (
              <>
                <div className="h-3 w-px bg-bg-fourth"></div>
                <div className="flex items-center space-x-1 group/reasoning">
                  <span className="text-xs text-text-muted-light">{t('modelSelector.reasoning')}:</span>
                  <span className="text-text-primary text-xs">{modelsData.reasoningEffort}</span>
                  <IconButton icon={<IoMdClose className="w-3 h-3" />} onClick={() => runCommand('reasoning-effort none')} className="ml-0.5" />
                </div>
              </>
            )}
            {modelsData?.thinkingTokens && modelsData?.thinkingTokens !== '0' && (
              <>
                <div className="h-3 w-px bg-bg-fourth"></div>
                <div className="flex items-center space-x-1 group/thinking">
                  <span className="text-xs text-text-muted-light">{t('modelSelector.thinkingTokens')}:</span>
                  <span className="text-text-primary text-xs">{modelsData.thinkingTokens}</span>
                  <IconButton icon={<IoMdClose className="w-3 h-3" />} onClick={() => runCommand('think-tokens 0')} className="ml-0.5" />
                </div>
              </>
            )}
          </div>
          <div className="flex items-center space-x-1 mr-2">
            <IconButton
              icon={<IoLogoMarkdown className={`w-4 h-4 ${renderMarkdown ? 'text-text-secondary' : 'text-text-muted-dark'}`} />}
              onClick={() => onRenderMarkdownChanged(!renderMarkdown)}
              tooltip={t('projectBar.toggleMarkdown')}
              className="p-1 hover:bg-bg-tertiary rounded-md"
            />
            <div className="relative" ref={sessionPopupRef}>
              <IconButton
                icon={<MdHistory className="w-4 h-4" />}
                onClick={toggleSessionPopupVisible}
                className="p-1 hover:bg-bg-tertiary rounded-md"
                tooltip={t('sessions.title')}
              />
              {sessionPopupVisible && (
                <SessionsPopup
                  sessions={sessions}
                  onLoadSessionMessages={loadSessionMessages}
                  onLoadSessionFiles={loadSessionFiles}
                  onSaveSession={saveSession}
                  onDeleteSession={deleteSession}
                  onExportSessionToMarkdown={exportSessionToMarkdown}
                  onExportSessionToImage={onExportSessionToImage}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  },
);

ProjectBar.displayName = 'ProjectTopBar';

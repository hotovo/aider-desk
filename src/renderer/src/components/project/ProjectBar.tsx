import { EditFormat, Mode, Model, ModelsData, RawModelInfo } from '@common/types';
import React, { ReactNode, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import { BsCodeSlash, BsFilter, BsLayoutSidebar } from 'react-icons/bs';
import { CgTerminal } from 'react-icons/cg';
import { GoProjectRoadmap } from 'react-icons/go';
import { IoMdClose } from 'react-icons/io';
import { RiRobot2Line } from 'react-icons/ri';
import { useTranslation } from 'react-i18next';
import { getProviderModelId } from '@common/agent';

import { IconButton } from '@/components/common/IconButton';
import { AgentModelSelector } from '@/components/AgentModelSelector';
import { ModelSelector, ModelSelectorRef } from '@/components/ModelSelector';
import { EditFormatSelector } from '@/components/PromptField/EditFormatSelector';
import { StyledTooltip } from '@/components/common/StyledTooltip';
import { useSettings } from '@/contexts/SettingsContext';
import { useProjectSettings } from '@/contexts/ProjectSettingsContext';
import { useApi } from '@/contexts/ApiContext';
import { useResponsive } from '@/hooks/useResponsive';
import { useModelProviders } from '@/contexts/ModelProviderContext';

export type ProjectTopBarRef = {
  openMainModelSelector: (model?: string) => void;
  openAgentModelSelector: (model?: string) => void;
};

type Props = {
  baseDir: string;
  taskId: string;
  modelsData: ModelsData | null;
  mode: Mode;
  onModelsChange?: (modelsData: ModelsData | null) => void;
  onExportSessionToImage: () => void;
  runCommand: (command: string) => void;
  onToggleSidebar: () => void;
};

export const ProjectBar = React.forwardRef<ProjectTopBarRef, Props>(({ baseDir, modelsData, mode, onModelsChange, runCommand, onToggleSidebar }, ref) => {
  const { t } = useTranslation();
  const { settings, saveSettings } = useSettings();
  const { projectSettings } = useProjectSettings();
  const { models, providers } = useModelProviders();
  const api = useApi();
  const { isMobile } = useResponsive();

  const aiderModels = useMemo(() => {
    const aiderModels: Model[] = [...models];
    aiderModels.sort((a, b) => {
      const aId = getProviderModelId(a);
      const bId = getProviderModelId(b);
      return aId.localeCompare(bId);
    });

    return aiderModels;
  }, [models]);
  const agentModelSelectorRef = useRef<ModelSelectorRef>(null);
  const mainModelSelectorRef = useRef<ModelSelectorRef>(null);
  const architectModelSelectorRef = useRef<ModelSelectorRef>(null);

  const activeAgentProfile = useMemo(() => {
    return settings?.agentProfiles.find((profile) => profile.id === projectSettings?.agentProfileId);
  }, [projectSettings?.agentProfileId, settings?.agentProfiles]);
  const showAiderInfo = mode !== 'agent' || activeAgentProfile?.useAiderTools === true;

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
      api.updateMainModel(baseDir, modelId);
      updatePreferredModels(modelId);

      if (modelsData && onModelsChange) {
        onModelsChange(null);
      }
    },
    [api, baseDir, modelsData, onModelsChange, updatePreferredModels],
  );

  const updateWeakModel = useCallback(
    (weakModel: Model) => {
      const modelId = getProviderModelId(weakModel);
      api.updateWeakModel(baseDir, modelId);
      updatePreferredModels(modelId);
      if (modelsData && onModelsChange) {
        onModelsChange({
          ...modelsData,
          weakModel: modelId,
        });
      }
    },
    [baseDir, modelsData, onModelsChange, updatePreferredModels, api],
  );

  const updateArchitectModel = useCallback(
    (architectModel: Model) => {
      const modelId = getProviderModelId(architectModel);
      api.updateArchitectModel(baseDir, modelId);
      updatePreferredModels(modelId);
      if (modelsData && onModelsChange) {
        onModelsChange({
          ...modelsData,
          architectModel: modelId,
        });
      }
    },
    [api, baseDir, modelsData, onModelsChange, updatePreferredModels],
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

  const isTwoRowLayout = mode === 'agent' && showAiderInfo;
  const renderAiderInfo = (showLabel = false) => {
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        {showLabel && <span className="text-2xs font-semibold text-text-primary uppercase">{t('projectBar.aider')}:</span>}
        <div className="flex items-center space-x-1">
          <CgTerminal className="w-4 h-4 text-text-primary mr-1" data-tooltip-id="main-model-tooltip" />
          <StyledTooltip id="main-model-tooltip" content={renderModelInfo(t('modelSelector.mainModel'), modelsData?.info)} />
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
        <div className="h-3 w-px bg-bg-fourth"></div>
        <div className="flex items-center space-x-1">
          <BsFilter className="w-4 h-4 text-text-primary mr-1" data-tooltip-id="weak-model-tooltip" data-tooltip-content={t('modelSelector.weakModel')} />
          <StyledTooltip id="weak-model-tooltip" />
          <ModelSelector
            models={aiderModels}
            selectedModelId={modelsData?.weakModel || modelsData?.mainModel}
            onChange={updateWeakModel}
            preferredModelIds={settings?.preferredModels || []}
            removePreferredModel={handleRemovePreferredModel}
            providers={providers}
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
    );
  };

  return (
    <div className="relative group px-4 py-2 pr-1 border-b border-border-dark-light bg-bg-primary-light min-h-10">
      <div className="flex items-center h-full">
        <div className="flex-grow">
          {isTwoRowLayout ? (
            // Two-row layout for Agent mode with Aider tools
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {/* Row 1: AGENT */}
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1">
                  <RiRobot2Line className="w-4 h-4 text-text-primary mr-1" data-tooltip-id="agent-tooltip" />
                  <StyledTooltip id="agent-tooltip" content={t('modelSelector.agentModel')} />
                  <AgentModelSelector ref={agentModelSelectorRef} settings={settings} agentProfile={activeAgentProfile} saveSettings={saveSettings} />
                </div>
              </div>

              {/* Row 2: AIDER */}
              {renderAiderInfo(true)}
            </div>
          ) : (
            // Original horizontal layout for other modes
            <div className="flex items-center space-x-3">
              {mode === 'agent' ? (
                <>
                  <div className="flex items-center space-x-1">
                    <RiRobot2Line className="w-4 h-4 text-text-primary mr-1" data-tooltip-id="agent-tooltip" />
                    <StyledTooltip id="agent-tooltip" content={t('modelSelector.agentModel')} />
                    <AgentModelSelector ref={agentModelSelectorRef} settings={settings} agentProfile={activeAgentProfile} saveSettings={saveSettings} />
                  </div>
                  {showAiderInfo && <div className="h-3 w-px bg-bg-fourth"></div>}
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
});

ProjectBar.displayName = 'ProjectTopBar';

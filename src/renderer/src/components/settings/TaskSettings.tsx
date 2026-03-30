import { SettingsData, ContextCompactionType, Model, WorkingMode } from '@common/types';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AiFillFolderOpen } from 'react-icons/ai';
import { IoGitBranch } from 'react-icons/io5';
import { getProviderModelId } from '@common/agent';

import { Chip } from '../common/Chip';
import { Checkbox } from '../common/Checkbox';
import { Section } from '../common/Section';
import { InfoIcon } from '../common/InfoIcon';
import { Button } from '../common/Button';
import { Slider } from '../common/Slider';
import { ModelSelectorWrapper } from '../common/ModelSelectorWrapper';
import { ItemConfig, ItemSelector } from '../common/ItemSelector';

const WORKING_MODE_ITEMS: ItemConfig<WorkingMode>[] = [
  {
    value: 'local',
    icon: AiFillFolderOpen,
    labelKey: 'workingMode.local',
    tooltipKey: 'workingModeTooltip.local',
  },
  {
    value: 'worktree',
    icon: IoGitBranch,
    labelKey: 'workingMode.worktree',
    tooltipKey: 'workingModeTooltip.worktree',
  },
];

type Props = {
  settings: SettingsData;
  setSettings: (settings: SettingsData) => void;
};

export const TaskSettings = ({ settings, setSettings }: Props) => {
  const { t } = useTranslation();
  const [newFolder, setNewFolder] = useState('');

  const handleSmartTaskStateChange = (checked: boolean) => {
    setSettings({
      ...settings,
      taskSettings: {
        ...settings.taskSettings,
        smartTaskState: checked,
      },
    });
  };

  const handleAutoGenerateTaskNameChange = (checked: boolean) => {
    setSettings({
      ...settings,
      taskSettings: {
        ...settings.taskSettings,
        autoGenerateTaskName: checked,
      },
    });
  };

  const handleShowTaskStateActionsChange = (checked: boolean) => {
    setSettings({
      ...settings,
      taskSettings: {
        ...settings.taskSettings,
        showTaskStateActions: checked,
      },
    });
  };

  const handleAddSymlinkFolder = () => {
    const trimmedFolder = newFolder.trim();
    if (!trimmedFolder) {
      return;
    }

    const currentFolders = settings.taskSettings.worktreeSymlinkFolders || [];
    if (!currentFolders.includes(trimmedFolder)) {
      setSettings({
        ...settings,
        taskSettings: {
          ...settings.taskSettings,
          worktreeSymlinkFolders: [...currentFolders, trimmedFolder],
        },
      });
    }

    setNewFolder('');
  };

  const handleRemoveSymlinkFolder = (folder: string) => {
    const currentFolders = settings.taskSettings.worktreeSymlinkFolders || [];
    setSettings({
      ...settings,
      taskSettings: {
        ...settings.taskSettings,
        worktreeSymlinkFolders: currentFolders.filter((f) => f !== folder),
      },
    });
  };

  const handleCompactingThresholdChange = (value: number) => {
    setSettings({
      ...settings,
      taskSettings: {
        ...settings.taskSettings,
        contextCompactingThreshold: Math.round(value),
      },
    });
  };

  const handleCompactionTypeChange = (value: ContextCompactionType) => {
    setSettings({
      ...settings,
      taskSettings: {
        ...settings.taskSettings,
        contextCompactionType: value,
      },
    });
  };

  const handleTaskNameModelChange = (model: Model | null) => {
    const modelId = model ? getProviderModelId(model) : null;
    setSettings({
      ...settings,
      taskSettings: {
        ...settings.taskSettings,
        taskNameModel: modelId,
      },
    });
  };

  const handleTaskStateModelChange = (model: Model | null) => {
    const modelId = model ? getProviderModelId(model) : null;
    setSettings({
      ...settings,
      taskSettings: {
        ...settings.taskSettings,
        taskStateModel: modelId,
      },
    });
  };

  const handleCommitMessageModelChange = (model: Model | null) => {
    const modelId = model ? getProviderModelId(model) : null;
    setSettings({
      ...settings,
      taskSettings: {
        ...settings.taskSettings,
        commitMessageModel: modelId,
      },
    });
  };

  const handleDefaultWorkingModeChange = (mode: WorkingMode) => {
    setSettings({
      ...settings,
      taskSettings: {
        ...settings.taskSettings,
        defaultWorkingMode: mode,
      },
    });
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <Section title={t('settings.tasks.title')} className="px-4 py-5">
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-start gap-1">
              <Checkbox
                id="smart-task-state"
                checked={settings.taskSettings.smartTaskState}
                onChange={handleSmartTaskStateChange}
                label={t('settings.tasks.smartTaskState')}
              />
              <InfoIcon tooltip={t('settings.tasks.smartTaskStateTooltip')} />
            </div>
            {settings.taskSettings.smartTaskState && (
              <div className="ml-6 flex items-center gap-1">
                <div className="w-64 p-2 bg-bg-secondary-light border-2 border-border-default rounded focus-within:outline-none focus-within:border-border-light">
                  <ModelSelectorWrapper
                    className="w-full justify-between"
                    selectedModelId={settings.taskSettings.taskStateModel || null}
                    onChange={handleTaskStateModelChange}
                    labelOnNull={t('settings.tasks.inheritModel')}
                    skipPreferredModelsUpdate
                  />
                </div>
                <InfoIcon tooltip={t('settings.tasks.taskStateModelTooltip')} />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-start gap-1">
              <Checkbox
                id="auto-generate-task-name"
                checked={settings.taskSettings?.autoGenerateTaskName ?? true}
                onChange={handleAutoGenerateTaskNameChange}
                label={t('settings.tasks.autoGenerateTaskName')}
              />
              <InfoIcon tooltip={t('settings.tasks.autoGenerateTaskNameTooltip')} />
            </div>
            {settings.taskSettings?.autoGenerateTaskName && (
              <div className="ml-6 flex items-center gap-1">
                <div className="w-64 p-2 bg-bg-secondary-light border-2 border-border-default rounded focus-within:outline-none focus-within:border-border-light">
                  <ModelSelectorWrapper
                    className="w-full justify-between"
                    selectedModelId={settings.taskSettings.taskNameModel || null}
                    onChange={handleTaskNameModelChange}
                    labelOnNull={t('settings.tasks.inheritModel')}
                    skipPreferredModelsUpdate
                  />
                </div>
                <InfoIcon tooltip={t('settings.tasks.taskNameModelTooltip')} />
              </div>
            )}
          </div>

          <div className="flex items-start gap-1">
            <Checkbox
              id="show-task-state-actions"
              checked={settings.taskSettings?.showTaskStateActions ?? true}
              onChange={handleShowTaskStateActionsChange}
              label={t('settings.tasks.showTaskStateActions')}
            />
            <InfoIcon tooltip={t('settings.tasks.showTaskStateActionsTooltip')} />
          </div>
        </div>
      </Section>

      <Section title={t('settings.tasks.auxiliaryModelsTitle')}>
        <div className="px-4 py-3 pt-4">
          <div className="text-2xs text-text-muted mb-4">{t('settings.tasks.auxiliaryModelsDescription')}</div>
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <label className="text-xs text-text-primary font-medium">{t('settings.tasks.commitMessageModel')}</label>
              <InfoIcon tooltip={t('settings.tasks.commitMessageModelTooltip')} />
            </div>
            <div className="w-64 p-2 bg-bg-secondary-light border-2 border-border-default rounded focus-within:outline-none focus-within:border-border-light">
              <ModelSelectorWrapper
                className="w-full justify-between"
                selectedModelId={settings.taskSettings.commitMessageModel || null}
                onChange={handleCommitMessageModelChange}
                labelOnNull={t('settings.tasks.inheritModel')}
                skipPreferredModelsUpdate
              />
            </div>
          </div>
        </div>
      </Section>

      <Section id="worktree" title={t('settings.tasks.worktree')}>
        <div className="px-4 py-3 pt-4 space-y-3">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <label className="text-xs text-text-primary font-medium">{t('settings.tasks.defaultWorkingMode')}</label>
                <InfoIcon tooltip={t('settings.tasks.defaultWorkingModeTooltip')} />
              </div>
              <ItemSelector
                items={WORKING_MODE_ITEMS}
                selectedValue={settings.taskSettings.defaultWorkingMode || 'local'}
                onChange={handleDefaultWorkingModeChange}
                minWidth={120}
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <label className="text-xs text-text-primary font-medium">{t('settings.tasks.worktreeSymlinkFoldersLabel')}</label>
                <InfoIcon tooltip={t('settings.tasks.worktreeSymlinkFoldersTooltip')} />
              </div>

              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={newFolder}
                  onChange={(e) => setNewFolder(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSymlinkFolder();
                    }
                  }}
                  placeholder={t('settings.tasks.symlinkFolderPlaceholder')}
                  className="w-64 bg-bg-secondary border border-border-default rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-border-light"
                />
                <Button variant="outline" size="xs" onClick={handleAddSymlinkFolder}>
                  {t('settings.tasks.addSymlinkFolder')}
                </Button>
              </div>
            </div>

            {settings.taskSettings.worktreeSymlinkFolders && settings.taskSettings.worktreeSymlinkFolders.length > 0 ? (
              <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto p-0.5 scrollbar-thin scrollbar-track-bg-secondary-light scrollbar-thumb-bg-tertiary hover:scrollbar-thumb-bg-fourth w-full">
                {settings.taskSettings.worktreeSymlinkFolders.map((folder) => (
                  <Chip
                    key={folder}
                    label={folder}
                    onRemove={() => handleRemoveSymlinkFolder(folder)}
                    removeTooltip={t('settings.tasks.removeSymlinkFolder')}
                    className="bg-bg-secondary"
                  />
                ))}
              </div>
            ) : (
              <div className="text-2xs text-text-muted">{t('settings.tasks.noSymlinkFolders')}</div>
            )}
          </div>
        </div>
      </Section>

      <Section id="context" title={t('settings.tasks.contextManagement')}>
        <div className="px-4 py-3 pt-4">
          <div className="flex gap-16 items-start">
            <div className="flex-1">
              <div className="flex items-center gap-1 mb-2">
                <label className="text-xs text-text-primary font-medium">{t('settings.tasks.contextCompactingThreshold')}</label>
                <InfoIcon tooltip={t('settings.tasks.contextCompactingThresholdTooltip')} />
              </div>

              <div className="flex items-center gap-3">
                <Slider
                  min={0}
                  max={100}
                  step={1}
                  value={settings.taskSettings.contextCompactingThreshold ?? 0}
                  onChange={handleCompactingThresholdChange}
                  showValue={false}
                  size="sm"
                  className="flex-1"
                />
                <span className="text-xs text-text-primary font-medium text-right">
                  {settings.taskSettings.contextCompactingThreshold === 0 ? 'Off' : `${settings.taskSettings.contextCompactingThreshold}%`}
                </span>
              </div>
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-1 mb-2">
                <label className="text-xs text-text-primary font-medium">{t('settings.tasks.contextCompactionType')}</label>
                <InfoIcon tooltip={t('settings.tasks.contextCompactionTypeTooltip')} />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleCompactionTypeChange(ContextCompactionType.Compact)}
                  className={`flex-1 px-3 py-1.5 text-xs rounded border transition-colors ${
                    settings.taskSettings.contextCompactionType === ContextCompactionType.Compact
                      ? 'bg-bg-primary border-border-light text-text-primary'
                      : 'bg-bg-secondary border-border-default text-text-muted hover:border-border-light hover:text-text-primary'
                  }`}
                >
                  {t('settings.tasks.contextCompactionTypeCompact')}
                </button>
                <button
                  onClick={() => handleCompactionTypeChange(ContextCompactionType.Handoff)}
                  className={`flex-1 px-3 py-1.5 text-xs rounded border transition-colors ${
                    settings.taskSettings.contextCompactionType === ContextCompactionType.Handoff
                      ? 'bg-bg-primary border-border-light text-text-primary'
                      : 'bg-bg-secondary border-border-default text-text-muted hover:border-border-light hover:text-text-primary'
                  }`}
                >
                  {t('settings.tasks.contextCompactionTypeHandoff')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
};

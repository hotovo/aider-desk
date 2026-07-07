import { useState } from 'react';
import { AgentProfile, ContextMemoryMode, InvocationMode } from '@common/types';
import { useTranslation } from 'react-i18next';
import Sketch from '@uiw/react-color-sketch';

import { Checkbox } from '@/components/common/Checkbox';
import { Select } from '@/components/common/Select';
import { TextArea } from '@/components/common/TextArea';
import { InfoIcon } from '@/components/common/InfoIcon';

type Props = {
  profile: AgentProfile;
  availableSubagents: AgentProfile[];
  onSettingChange: <K extends keyof AgentProfile>(field: K, value: AgentProfile[K]) => void;
};

export const ProfileSubagentsSection = ({ profile, availableSubagents, onSettingChange }: Props) => {
  const { t } = useTranslation();
  const [showColorPicker, setShowColorPicker] = useState(false);

  const allSubagentsAllowed = profile.enabledSubagentIds === undefined;

  const handleAllowAllSubagentsChange = (checked: boolean) => {
    onSettingChange('enabledSubagentIds', checked ? undefined : availableSubagents.map((subagent) => subagent.id));
  };

  const handleSubagentAllowedChange = (subagentId: string, checked: boolean) => {
    const current = profile.enabledSubagentIds ?? availableSubagents.map((subagent) => subagent.id);
    const updated = checked ? [...new Set([...current, subagentId])] : current.filter((id) => id !== subagentId);
    onSettingChange('enabledSubagentIds', updated);
  };

  const handleToggleColorPicker = () => {
    setShowColorPicker(!showColorPicker);
  };

  return (
    <div className="space-y-6">
      {/* Using subagents */}
      <div>
        <div className="text-sm font-medium text-text-primary mb-3">{t('settings.agent.subagent.usingSubagents')}</div>
        <Checkbox
          label={
            <div className="flex items-center">
              <span>{t('settings.agent.subagent.canUseSubagents')}</span>
              <InfoIcon className="ml-2" tooltip={t('settings.agent.subagent.canUseSubagentsInformation')} />
            </div>
          }
          checked={profile.useSubagents}
          onChange={(checked) => onSettingChange('useSubagents', checked)}
        />

        {profile.useSubagents && (
          <div className="mt-3 pl-6 space-y-2">
            <Checkbox
              label={
                <div className="flex items-center">
                  <span>{t('settings.agent.subagent.allowAllSubagents')}</span>
                  <InfoIcon className="ml-2" tooltip={t('settings.agent.subagent.allowAllSubagentsInformation')} />
                </div>
              }
              checked={allSubagentsAllowed}
              onChange={handleAllowAllSubagentsChange}
            />
            {!allSubagentsAllowed &&
              (availableSubagents.length === 0 ? (
                <div className="text-xs text-text-muted-light py-2">{t('settings.agent.subagent.noSubagentsAvailable')}</div>
              ) : (
                <div className="space-y-1 border border-border-default-dark rounded-md p-3">
                  {availableSubagents.map((subagent) => (
                    <Checkbox
                      key={subagent.id}
                      label={
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded border border-border-default" style={{ backgroundColor: subagent.subagent.color }} />
                          <span>{subagent.name}</span>
                          <span className="text-2xs text-text-muted-light">
                            {subagent.subagent.invocationMode === InvocationMode.Automatic
                              ? t('settings.agent.subagent.statusAutomatic')
                              : t('settings.agent.subagent.statusOnDemand')}
                          </span>
                        </div>
                      }
                      checked={(profile.enabledSubagentIds ?? []).includes(subagent.id)}
                      onChange={(checked) => handleSubagentAllowedChange(subagent.id, checked)}
                    />
                  ))}
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Acting as subagent */}
      <div className="border-t border-border-default-dark pt-4">
        <div className="text-sm font-medium text-text-primary mb-3">{t('settings.agent.subagent.actingAsSubagent')}</div>
        <div className="flex items-center justify-between">
          <Checkbox
            label={
              <div className="flex items-center">
                <span>{t('settings.agent.subagent.enableAsSubagent')}</span>
                <InfoIcon className="ml-2" tooltip={t('settings.agent.subagent.enableAsSubagentInformation')} />
              </div>
            }
            checked={profile.subagent.enabled}
            onChange={(checked) => onSettingChange('subagent', { ...profile.subagent, enabled: checked })}
          />
          {profile.subagent.enabled && (
            <div
              className="w-6 h-6 rounded border border-border-default cursor-pointer"
              style={{ backgroundColor: profile.subagent.color }}
              onClick={handleToggleColorPicker}
            />
          )}
        </div>

        {profile.subagent.enabled && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-x-6">
              <Select
                label={
                  <div className="flex items-center">
                    <span>{t('settings.agent.subagent.invocationMode')}</span>
                  </div>
                }
                options={[
                  { label: t('settings.agent.subagent.invocationModeOnDemand'), value: InvocationMode.OnDemand },
                  { label: t('settings.agent.subagent.invocationModeAutomatic'), value: InvocationMode.Automatic },
                ]}
                value={profile.subagent.invocationMode}
                onChange={(value) => onSettingChange('subagent', { ...profile.subagent, invocationMode: value as InvocationMode })}
                size="sm"
              />
              <Select
                label={
                  <div className="flex items-center">
                    <span>{t('settings.agent.subagent.contextMemory')}</span>
                    <InfoIcon className="ml-2" tooltip={t('settings.agent.subagent.contextMemoryTooltip')} />
                  </div>
                }
                options={[
                  { label: t('settings.agent.subagent.contextMemory.off'), value: ContextMemoryMode.Off },
                  { label: t('settings.agent.subagent.contextMemory.fullContext'), value: ContextMemoryMode.FullContext },
                  { label: t('settings.agent.subagent.contextMemory.lastMessage'), value: ContextMemoryMode.LastMessage },
                ]}
                value={profile.subagent.contextMemory}
                onChange={(value) => onSettingChange('subagent', { ...profile.subagent, contextMemory: value as ContextMemoryMode })}
                size="sm"
              />
            </div>

            <TextArea
              label={<label className="text-xs font-medium text-text-primary">{t('settings.agent.subagent.systemPrompt')}</label>}
              className="min-h-[160px]"
              value={profile.subagent.systemPrompt}
              onChange={(e) => onSettingChange('subagent', { ...profile.subagent, systemPrompt: e.target.value })}
              placeholder={t('settings.agent.subagent.systemPromptPlaceholder')}
            />

            {profile.subagent.invocationMode === InvocationMode.Automatic && (
              <TextArea
                label={<label className="text-xs font-medium text-text-primary">{t('settings.agent.subagent.description')}</label>}
                className="min-h-[100px]"
                value={profile.subagent.description}
                onChange={(e) => onSettingChange('subagent', { ...profile.subagent, description: e.target.value })}
                placeholder={t('settings.agent.subagent.descriptionPlaceholder')}
              />
            )}
            <div className="text-2xs text-text-muted-light">
              {profile.subagent.invocationMode === InvocationMode.Automatic
                ? !profile.subagent.description.trim()
                  ? t('settings.agent.subagent.descriptionRequiredForAutomatic')
                  : t('settings.agent.subagent.invocationModeAutomaticInformation')
                : t('settings.agent.subagent.invocationModeOnDemandInformation')}
            </div>
          </div>
        )}
      </div>

      {showColorPicker && profile.subagent.enabled && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setShowColorPicker(false)}>
          <div className="relative bg-bg-secondary border border-border-default rounded-lg shadow-lg p-4">
            <Sketch
              color={profile.subagent.color}
              onChange={(color) => {
                onSettingChange('subagent', {
                  ...profile.subagent,
                  color: color.hex,
                });
              }}
              onClick={(e) => {
                e.stopPropagation();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

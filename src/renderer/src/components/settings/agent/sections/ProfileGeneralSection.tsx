import { AgentProfile, ContextCompactionType, SettingsData } from '@common/types';
import { useTranslation } from 'react-i18next';
import { FaTimes } from 'react-icons/fa';
import { clsx } from 'clsx';

import { Slider } from '@/components/common/Slider';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { InfoIcon } from '@/components/common/InfoIcon';
import { Checkbox } from '@/components/common/Checkbox';
import { Tooltip } from '@/components/ui/Tooltip';

type Props = {
  profile: AgentProfile;
  settings: SettingsData;
  onSettingChange: <K extends keyof AgentProfile>(field: K, value: AgentProfile[K]) => void;
};

export const ProfileGeneralSection = ({ profile, settings, onSettingChange }: Props) => {
  const { t } = useTranslation();

  const renderCompactionTypeButton = (type: ContextCompactionType, label: string, tooltip: string) => {
    const handleClick = () => {
      onSettingChange('autoCompactionType', type);
    };

    return (
      <Tooltip content={tooltip}>
        <button
          onClick={handleClick}
          className={clsx(
            'w-[100px] px-3 py-1.5 text-xs rounded border transition-colors',
            profile.autoCompactionType === type
              ? 'bg-bg-primary border-border-light text-text-primary'
              : 'bg-bg-secondary border-border-default text-text-muted hover:border-border-light hover:text-text-primary',
          )}
        >
          {label}
        </button>
      </Tooltip>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm font-medium text-text-primary mb-3">{t('settings.agent.runSettings')}</div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <Slider
            label={
              <div className="flex items-center text-xs">
                <span>{t('settings.agent.maxIterations')}</span>
                <InfoIcon tooltip={t('settings.agent.computationalResources')} className="ml-1" />
              </div>
            }
            min={0}
            max={200}
            value={profile.maxIterations}
            onChange={(value) => onSettingChange('maxIterations', value)}
            formatValue={(v) => (v === 0 ? t('settings.agent.infinite') : String(v))}
          />

          <Input
            label={
              <div className="flex items-center text-xs">
                <span>{t('settings.agent.minTimeBetweenToolCalls')}</span>
                <InfoIcon tooltip={t('settings.agent.rateLimiting')} className="ml-1" />
              </div>
            }
            type="number"
            min={0}
            max={60000}
            step={100}
            value={profile.minTimeBetweenToolCalls.toString()}
            onChange={(e) => onSettingChange('minTimeBetweenToolCalls', Number(e.target.value))}
          />

          {/* Temperature Column */}
          {profile.temperature === undefined ? (
            <div className="space-y-2">
              <div className="flex items-center text-xs">
                <span>{t('settings.agent.temperature')}</span>
                <InfoIcon tooltip={t('settings.agent.temperatureTooltip')} className="ml-1" />
                <div className="flex items-center justify-end w-full">
                  <Button variant="text" size="xs" onClick={() => onSettingChange('temperature', 0.0)}>
                    {t('settings.agent.override')}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Slider
                  label={
                    <div className="flex items-center text-xs">
                      <span>{t('settings.agent.temperature')}</span>
                      <InfoIcon tooltip={t('settings.agent.temperatureTooltip')} className="ml-2" />
                    </div>
                  }
                  min={0}
                  max={2}
                  step={0.05}
                  value={profile.temperature}
                  className="flex-1"
                  onChange={(value) => onSettingChange('temperature', value)}
                />
                <IconButton
                  icon={<FaTimes className="w-3 h-3" />}
                  onClick={() => onSettingChange('temperature', undefined)}
                  tooltip={t('settings.agent.clearOverride')}
                  className="p-1 hover:bg-bg-tertiary-emphasis hover:text-text-error rounded-sm mt-8"
                />
              </div>
            </div>
          )}

          {/* Max Tokens Column */}
          <div className="space-y-2">
            <div className="flex items-center text-xs">
              <span className="flex-shrink-0">{t('settings.agent.maxTokens')}</span>
              <InfoIcon tooltip={t('settings.agent.tokensPerResponse')} className="ml-1" />
              {profile.maxTokens === undefined && (
                <div className="flex items-center justify-end w-full">
                  <Button variant="text" size="xs" onClick={() => onSettingChange('maxTokens', 32000)} className="justify-center">
                    {t('settings.agent.override')}
                  </Button>
                </div>
              )}
            </div>
            {profile.maxTokens !== undefined && (
              <div className="flex items-center gap-2 w-full">
                <div className="flex-1">
                  <Input
                    type="number"
                    min={0}
                    max={60000}
                    step={100}
                    value={profile.maxTokens.toString()}
                    onChange={(e) => onSettingChange('maxTokens', Number(e.target.value))}
                  />
                </div>
                <IconButton
                  icon={<FaTimes className="w-3 h-3" />}
                  onClick={() => onSettingChange('maxTokens', undefined)}
                  tooltip={t('settings.agent.clearOverride')}
                  className="p-1 hover:bg-bg-tertiary-emphasis hover:text-text-error rounded-sm"
                />
              </div>
            )}
          </div>

          {/* Auto-compact Threshold Percentage */}
          {profile.autoCompactThresholdPercentage === undefined ? (
            <div className="space-y-2">
              <div className="flex items-center text-xs">
                <span className="whitespace-nowrap">{t('settings.agent.autoCompactThresholdPercentage')}</span>
                <InfoIcon tooltip={t('settings.agent.autoCompactThresholdPercentageTooltip')} className="ml-1" />
                <div className="flex items-center justify-end w-full">
                  <Button
                    variant="text"
                    size="xs"
                    onClick={() => onSettingChange('autoCompactThresholdPercentage', settings.taskSettings.contextCompactingThreshold.percentage)}
                  >
                    {t('settings.agent.override')}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Slider
                  label={
                    <div className="flex items-center text-xs">
                      <span className="whitespace-nowrap">{t('settings.agent.autoCompactThresholdPercentage')}</span>
                      <InfoIcon tooltip={t('settings.agent.autoCompactThresholdPercentageTooltip')} className="ml-1" />
                    </div>
                  }
                  min={0}
                  max={100}
                  step={1}
                  value={profile.autoCompactThresholdPercentage}
                  className="flex-1"
                  onChange={(value) => onSettingChange('autoCompactThresholdPercentage', value)}
                />
                <IconButton
                  icon={<FaTimes className="w-3 h-3" />}
                  onClick={() => onSettingChange('autoCompactThresholdPercentage', undefined)}
                  tooltip={t('settings.agent.clearOverride')}
                  className="p-1 hover:bg-bg-tertiary-emphasis hover:text-text-error rounded-sm mt-8"
                />
              </div>
            </div>
          )}

          {/* Auto-compact Threshold Tokens */}
          <div className="space-y-2">
            <div className="flex items-center text-xs">
              <span className="flex-shrink-0 whitespace-nowrap">{t('settings.agent.autoCompactThresholdTokens')}</span>
              <InfoIcon tooltip={t('settings.agent.autoCompactThresholdTokensTooltip')} className="ml-1" />
              {profile.autoCompactThresholdTokens === undefined && (
                <div className="flex items-center justify-end w-full">
                  <Button
                    variant="text"
                    size="xs"
                    onClick={() => onSettingChange('autoCompactThresholdTokens', settings.taskSettings.contextCompactingThreshold.tokens)}
                  >
                    {t('settings.agent.override')}
                  </Button>
                </div>
              )}
            </div>
            {profile.autoCompactThresholdTokens !== undefined && (
              <div className="flex items-center gap-2 w-full">
                <div className="flex-1">
                  <Input
                    type="number"
                    min={0}
                    step={10000}
                    value={profile.autoCompactThresholdTokens.toString()}
                    onChange={(e) => onSettingChange('autoCompactThresholdTokens', Number(e.target.value))}
                  />
                </div>
                <IconButton
                  icon={<FaTimes className="w-3 h-3" />}
                  onClick={() => onSettingChange('autoCompactThresholdTokens', undefined)}
                  tooltip={t('settings.agent.clearOverride')}
                  className="p-1 hover:bg-bg-tertiary-emphasis hover:text-text-error rounded-sm"
                />
              </div>
            )}
          </div>

          {/* Compaction Type */}
          <div className="space-y-2">
            <div className="flex items-center text-xs">
              <span className="whitespace-nowrap">{t('settings.agent.autoCompactionType')}</span>
              <InfoIcon tooltip={t('settings.agent.autoCompactionTypeTooltip')} className="ml-1" />
              {profile.autoCompactionType === undefined && (
                <div className="flex items-center justify-end w-full">
                  <Button
                    variant="text"
                    size="xs"
                    onClick={() => onSettingChange('autoCompactionType', settings.taskSettings.contextCompactionType ?? ContextCompactionType.Compact)}
                  >
                    {t('settings.agent.override')}
                  </Button>
                </div>
              )}
            </div>
            {profile.autoCompactionType !== undefined && (
              <div className="flex items-center gap-2">
                <div className="flex gap-2">
                  {renderCompactionTypeButton(
                    ContextCompactionType.Compact,
                    t('settings.tasks.contextCompactionTypeCompact'),
                    t('settings.tasks.contextCompactionTypeCompactTooltip'),
                  )}
                  {renderCompactionTypeButton(
                    ContextCompactionType.Smart,
                    t('settings.tasks.contextCompactionTypeSmart'),
                    t('settings.tasks.contextCompactionTypeSmartTooltip'),
                  )}
                  {renderCompactionTypeButton(
                    ContextCompactionType.Handoff,
                    t('settings.tasks.contextCompactionTypeHandoff'),
                    t('settings.tasks.contextCompactionTypeHandoffTooltip'),
                  )}
                </div>
                <IconButton
                  icon={<FaTimes className="w-3 h-3" />}
                  onClick={() => onSettingChange('autoCompactionType', undefined)}
                  tooltip={t('settings.agent.clearOverride')}
                  className="p-1 hover:bg-bg-tertiary-emphasis hover:text-text-error rounded-sm"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-border-default-dark pt-4">
        <div className="text-sm font-medium text-text-primary mb-3">{t('settings.agent.context')}</div>
        <div className="space-y-2">
          <Checkbox
            label={
              <div className="flex items-center">
                <span>{t('settings.agent.includeContextFiles')}</span>
                <InfoIcon className="ml-1" tooltip={t('settings.agent.includeFilesTooltip')} />
              </div>
            }
            checked={profile.includeContextFiles}
            onChange={(checked) => onSettingChange('includeContextFiles', checked)}
          />
          <Checkbox
            label={
              <div className="flex items-center">
                <span>{t('settings.agent.includeRepoMap')}</span>
                <InfoIcon className="ml-1" tooltip={t('settings.agent.includeRepoMapTooltip')} />
              </div>
            }
            checked={profile.includeRepoMap}
            onChange={(checked) => onSettingChange('includeRepoMap', checked)}
          />
        </div>
      </div>
    </div>
  );
};

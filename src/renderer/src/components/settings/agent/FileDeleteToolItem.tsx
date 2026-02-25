import { useTranslation } from 'react-i18next';
import { AgentProfile, FileDeleteToolSettings, GenericTool, ToolApprovalState } from '@common/types';
import { POWER_TOOL_FILE_DELETE, POWER_TOOL_GROUP_NAME, TOOL_GROUP_NAME_SEPARATOR } from '@common/tools';

import { GenericToolItem } from './GenericToolItem';

import { Input } from '@/components/common/Input';
import { InfoIcon } from '@/components/common/InfoIcon';
import { Checkbox } from '@/components/common/Checkbox';

type Props = {
  tool: GenericTool;
  profile: AgentProfile;
  onApprovalChange?: (toolId: string, approval: ToolApprovalState) => void;
  onProfileChange: (field: keyof AgentProfile, value: AgentProfile[keyof AgentProfile]) => void;
};

export const FileDeleteToolItem = ({ tool, profile, onApprovalChange, onProfileChange }: Props) => {
  const { t } = useTranslation();

  if (tool.groupName !== POWER_TOOL_GROUP_NAME || tool.name !== POWER_TOOL_FILE_DELETE) {
    return null;
  }

  const toolId = `${tool.groupName}${TOOL_GROUP_NAME_SEPARATOR}${tool.name}`;
  const deleteSettings = profile.toolSettings?.[toolId] as FileDeleteToolSettings;

  // Helper to update a specific setting within the tool's settings object
  const updateSetting = <K extends keyof FileDeleteToolSettings>(key: K, value: FileDeleteToolSettings[K]) => {
    const currentSettings = profile.toolSettings || {};
    const updatedSettings = {
      ...currentSettings,
      [toolId]: {
        ...(currentSettings[toolId] as FileDeleteToolSettings),
        [key]: value,
      },
    };
    onProfileChange('toolSettings', updatedSettings);
  };

  // Convert string array to semicolon-separated string for input display
  const arrayToString = (arr?: string[]) => (arr ? arr.join(';') : '');
  // Convert input string to array of trimmed non-empty strings
  const stringToArray = (str: string) =>
    str
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);

  const renderToolSettings = () => (
    <div className="grid grid-cols-2 gap-x-6 gap-y-4 pl-6">
      <Input
        label={
          <div className="flex items-center">
            <span className="text-xs">{t('settings.agent.fileDeleteToolAllowedPatterns')}</span>
            <InfoIcon className="ml-2" tooltip={t('settings.agent.fileDeleteToolAllowedPatternsTooltip')} tooltipId="global-tooltip-md" />
          </div>
        }
        value={arrayToString(deleteSettings?.allowedPatterns)}
        onChange={(e) => updateSetting('allowedPatterns', stringToArray(e.target.value))}
        size="sm"
        placeholder={t('settings.agent.fileDeleteToolAllowedPatternsPlaceholder')}
      />
      <Input
        label={
          <div className="flex items-center">
            <span className="text-xs">{t('settings.agent.fileDeleteToolDeniedPatterns')}</span>
            <InfoIcon className="ml-2" tooltip={t('settings.agent.fileDeleteToolDeniedPatternsTooltip')} tooltipId="global-tooltip-md" />
          </div>
        }
        value={arrayToString(deleteSettings?.deniedPatterns)}
        onChange={(e) => updateSetting('deniedPatterns', stringToArray(e.target.value))}
        size="sm"
        placeholder={t('settings.agent.fileDeleteToolDeniedPatternsPlaceholder')}
      />
      <Input
        label={
          <div className="flex items-center">
            <span className="text-xs">{t('settings.agent.fileDeleteToolAllowedDirectoryPatterns')}</span>
            <InfoIcon className="ml-2" tooltip={t('settings.agent.fileDeleteToolAllowedDirectoryPatternsTooltip')} tooltipId="global-tooltip-md" />
          </div>
        }
        value={arrayToString(deleteSettings?.allowedDirectoryPatterns)}
        onChange={(e) => updateSetting('allowedDirectoryPatterns', stringToArray(e.target.value))}
        size="sm"
        placeholder={t('settings.agent.fileDeleteToolAllowedDirectoryPatternsPlaceholder')}
      />
      <Input
        label={
          <div className="flex items-center">
            <span className="text-xs">{t('settings.agent.fileDeleteToolDeniedDirectoryPatterns')}</span>
            <InfoIcon className="ml-2" tooltip={t('settings.agent.fileDeleteToolDeniedDirectoryPatternsTooltip')} tooltipId="global-tooltip-md" />
          </div>
        }
        value={arrayToString(deleteSettings?.deniedDirectoryPatterns)}
        onChange={(e) => updateSetting('deniedDirectoryPatterns', stringToArray(e.target.value))}
        size="sm"
        placeholder={t('settings.agent.fileDeleteToolDeniedDirectoryPatternsPlaceholder')}
      />
      <Input
        type="number"
        label={
          <div className="flex items-center">
            <span className="text-xs">{t('settings.agent.fileDeleteToolMaxFileSize')}</span>
            <InfoIcon className="ml-2" tooltip={t('settings.agent.fileDeleteToolMaxFileSizeTooltip')} tooltipId="global-tooltip-md" />
          </div>
        }
        value={deleteSettings?.maxFileSizeBytes?.toString() || ''}
        onChange={(e) => updateSetting('maxFileSizeBytes', e.target.value ? parseInt(e.target.value, 10) : undefined)}
        size="sm"
        placeholder={t('settings.agent.fileDeleteToolMaxFileSizePlaceholder')}
      />
      <div className="flex items-center pb-1.5">
        <Checkbox
          label={t('settings.agent.fileDeleteToolAllowRecursive')}
          checked={deleteSettings?.allowRecursiveDirectoryDeletion || false}
          onChange={(checked) => updateSetting('allowRecursiveDirectoryDeletion', checked)}
          size="sm"
          tooltip={t('settings.agent.fileDeleteToolAllowRecursiveTooltip')}
          tooltipId="global-tooltip-md"
        />
      </div>
    </div>
  );

  return <GenericToolItem tool={tool} profile={profile} onApprovalChange={onApprovalChange} renderToolSettings={renderToolSettings} />;
};

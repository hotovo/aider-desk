import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MdCheck, MdFlashOn, MdOutlineFileCopy, MdOutlineHdrAuto, MdOutlineMap } from 'react-icons/md';
import { RiToolsFill } from 'react-icons/ri';
import clsx from 'clsx';
import { AgentProfile, ToolApprovalState } from '@common/types';
import { getActiveAgentProfile } from '@common/utils';
import { BiCog } from 'react-icons/bi';
import { TOOL_GROUP_NAME_SEPARATOR } from '@common/tools';

import { McpServerSelectorItem } from './McpServerSelectorItem';

import { useClickOutside } from '@/hooks/useClickOutside';
import { IconButton } from '@/components/common/IconButton';
import { StyledTooltip } from '@/components/common/StyledTooltip';
import { Accordion } from '@/components/common/Accordion';
import { useSettings } from '@/context/SettingsContext';
import { useProjectSettings } from '@/context/ProjectSettingsContext';
import { Checkbox } from '@/components/common/Checkbox';
import { SettingsDialog } from '@/components/settings/SettingsDialog';

export const AgentSelector = () => {
  const { t } = useTranslation();
  const { settings, saveSettings } = useSettings();
  const { projectSettings, saveProjectSettings } = useProjectSettings();
  const [selectorVisible, setSelectorVisible] = useState(false);
  const [showAgentProfilesDialog, setShowAgentProfilesDialog] = useState(false);
  const [enabledToolsCount, setEnabledToolsCount] = useState<number | null>(null);
  const selectorRef = useRef<HTMLDivElement>(null);

  const activeProfile = getActiveAgentProfile(settings, projectSettings);
  const { agentProfiles = [], mcpServers = {} } = settings || {};
  const { enabledServers = [], toolApprovals = {} } = activeProfile || {};

  useClickOutside(selectorRef, () => setSelectorVisible(false));

  useEffect(() => {
    const calculateEnabledTools = async () => {
      if (enabledServers.length === 0) {
        setEnabledToolsCount(0);
        return;
      }

      const timeoutId = setTimeout(() => setEnabledToolsCount(null), 1000);

      try {
        const toolCounts = await Promise.all(
          enabledServers.map(async (serverName) => {
            if (!mcpServers[serverName]) {
              return 0;
            }
            try {
              const tools = await window.api.loadMcpServerTools(serverName, mcpServers[serverName]);
              const serverTotalTools = tools?.length ?? 0;
              const serverDisabledTools =
                tools?.filter((tool) => toolApprovals[`${serverName}${TOOL_GROUP_NAME_SEPARATOR}${tool.name}`] === ToolApprovalState.Never).length ?? 0;
              return Math.max(0, serverTotalTools - serverDisabledTools);
            } catch (error) {
              // eslint-disable-next-line no-console
              console.error(`Failed to load tools for server ${serverName}:`, error);
              return 0;
            }
          }),
        );
        const totalEnabledTools = toolCounts.reduce((sum, count) => sum + count, 0);
        setEnabledToolsCount(totalEnabledTools);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to calculate total enabled tools:', error);
        setEnabledToolsCount(0);
      }
      clearTimeout(timeoutId);
    };

    void calculateEnabledTools();
  }, [enabledServers, mcpServers, toolApprovals]);

  if (!activeProfile) {
    return <div className="text-xs text-neutral-400">{t('common.loading')}</div>;
  }

  const toggleSelectorVisible = () => {
    setSelectorVisible((prev) => !prev);
  };

  const handleSwitchProfile = (profileId: string) => {
    const newActiveProfile = settings!.agentProfiles.find((p) => p.id === profileId);
    if (newActiveProfile && projectSettings) {
      void saveProjectSettings({
        agentProfileId: newActiveProfile.id,
      });
      setSelectorVisible(false);
    }
  };

  const handleToggleProfileSetting = (setting: keyof AgentProfile, value: boolean) => {
    if (activeProfile && settings) {
      const updatedProfile = { ...activeProfile, [setting]: value };
      void saveSettings({
        ...settings,
        agentProfiles: settings.agentProfiles.map((profile) => (profile.id === activeProfile.id ? updatedProfile : profile)),
      });
    }
  };

  const handleToggleServer = (serverName: string) => {
    if (activeProfile && settings) {
      const currentEnabledServers = activeProfile.enabledServers || [];
      const isEnabled = currentEnabledServers.includes(serverName);

      let newEnabledServers: string[];
      const newToolApprovals = { ...activeProfile.toolApprovals };

      if (isEnabled) {
        newEnabledServers = currentEnabledServers.filter((s) => s !== serverName);
        // Remove tool approvals for this server
        Object.keys(newToolApprovals).forEach((toolId) => {
          if (toolId.startsWith(`${serverName}:`)) {
            delete newToolApprovals[toolId];
          }
        });
      } else {
        newEnabledServers = [...currentEnabledServers, serverName];
      }

      const updatedProfile = {
        ...activeProfile,
        enabledServers: newEnabledServers,
        toolApprovals: newToolApprovals,
      };
      void saveSettings({
        ...settings,
        agentProfiles: settings.agentProfiles.map((profile) => (profile.id === activeProfile.id ? updatedProfile : profile)),
      });
    }
  };

  const handleOpenAgentProfiles = () => {
    setShowAgentProfilesDialog(true);
    setSelectorVisible(false);
  };

  return (
    <div className="relative" ref={selectorRef}>
      <button
        onClick={toggleSelectorVisible}
        className="flex items-center gap-1.5 px-2 focus:outline-none transition-colors duration-200 text-xs border rounded-md min-h-[26px]"
        style={{
          backgroundColor: 'var(--theme-background-input)',
          color: 'var(--theme-foreground-secondary)',
          borderColor: 'var(--theme-border-primary)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--theme-background-tertiary)';
          e.currentTarget.style.color = 'var(--theme-foreground-primary)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--theme-background-input)';
          e.currentTarget.style.color = 'var(--theme-foreground-secondary)';
        }}
      >
        <RiToolsFill className="w-3.5 h-3.5" />
        <span className="text-2xs truncate max-w-[250px] -mb-0.5">{activeProfile.name}</span>
        <span className="text-2xs font-mono" style={{ color: 'var(--theme-foreground-tertiary)' }}>({enabledToolsCount ?? '...'})</span>
        {activeProfile.useAiderTools && <MdOutlineHdrAuto className="w-3.5 h-3.5 text-green-400 opacity-70" />}
        {activeProfile.usePowerTools && <MdFlashOn className="w-3.5 h-3.5 text-purple-400 opacity-70" />}
        {activeProfile.includeContextFiles && <MdOutlineFileCopy className="w-3 h-3 text-yellow-400 opacity-70" />}
        {activeProfile.includeRepoMap && <MdOutlineMap className="w-3 h-3 text-blue-400 opacity-70" />}
      </button>

      {selectorVisible && (
        <div className="absolute bottom-full left-0 mb-1 rounded-md shadow-lg z-10 min-w-[280px] max-w-[380px]" style={{ backgroundColor: 'var(--theme-background-secondary)', borderColor: 'var(--theme-border-primary)', border: '1px solid' }}>
          {/* Profiles List */}
          <div className="py-2 border-b" style={{ borderColor: 'var(--theme-border-primary)' }}>
            <div className="flex items-center justify-between mb-2 pl-3 pr-2">
              <span className="text-xs font-medium uppercase" style={{ color: 'var(--theme-foreground-primary)' }}>{t('agentProfiles.profiles')}</span>
              <IconButton
                icon={<BiCog className="w-4 h-4" />}
                onClick={handleOpenAgentProfiles}
                className="opacity-60 hover:opacity-100 p-1 rounded-md"
                tooltip={t('agentProfiles.manageProfiles')}
                tooltipId="agent-selector-tooltip"
              />
            </div>
            <div className="max-h-[250px] overflow-y-auto">
              {agentProfiles.map((profile) => (
                <div
                  key={profile.id}
                  className="pl-6 pr-2 py-1 cursor-pointer transition-colors text-2xs relative"
                  style={{
                    backgroundColor: profile.id === activeProfile.id ? 'var(--theme-background-tertiary)' : 'transparent',
                    color: profile.id === activeProfile.id ? 'var(--theme-foreground-primary)' : 'var(--theme-foreground-secondary)'
                  }}
                  onMouseEnter={(e) => {
                    if (profile.id !== activeProfile.id) {
                      e.currentTarget.style.backgroundColor = 'var(--theme-background-tertiary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (profile.id !== activeProfile.id) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                  onClick={() => handleSwitchProfile(profile.id)}
                >
                  {profile.id === activeProfile.id && <MdCheck className="w-3 h-3 absolute left-1.5 top-1/2 transform -translate-y-1/2 text-green-400" />}
                  <span className="truncate block">{profile.name}&nbsp;</span>
                </div>
              ))}
            </div>
          </div>

          {/* MCP Servers */}
          <div className="border-b" style={{ borderColor: 'var(--theme-border-primary)' }}>
            <Accordion
              title={
                <div className="flex items-center w-full">
                  <span className="text-xs flex-1 font-medium text-left px-1 uppercase" style={{ color: 'var(--theme-foreground-primary)' }}>{t('mcp.servers')}</span>
                  <span className="text-2xs px-1.5 py-0.5 rounded" style={{ color: 'var(--theme-foreground-secondary)', backgroundColor: 'var(--theme-background-tertiary)' }}>
                    {enabledServers.length}/{Object.keys(mcpServers).length}
                  </span>
                </div>
              }
              chevronPosition="right"
            >
              <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-track-[var(--scrollbar-track)] scrollbar-thumb-[var(--scrollbar-thumb)] pb-2">
                {Object.keys(mcpServers).length === 0 ? (
                  <div className="py-2 text-xs italic" style={{ color: 'var(--theme-foreground-tertiary)' }}>{t('settings.agent.noServersConfiguredGlobal')}</div>
                ) : (
                  Object.keys(mcpServers).map((serverName) => (
                    <McpServerSelectorItem
                      key={serverName}
                      serverName={serverName}
                      disabled={!enabledServers.includes(serverName)}
                      toolApprovals={activeProfile.toolApprovals || {}}
                      onToggle={handleToggleServer}
                    />
                  ))
                )}
              </div>
            </Accordion>
          </div>

          {/* Quick Settings */}
          <div className="px-3 py-2">
            <div className="flex items-center justify-between gap-1">
              <Checkbox
                label={t('settings.agent.autoApprove')}
                checked={activeProfile.autoApprove ?? false}
                onChange={(isChecked) => handleToggleProfileSetting('autoApprove', isChecked)}
                size="sm"
              />
              <div className="flex items-center gap-1">
                <IconButton
                  icon={<MdOutlineHdrAuto className={clsx('w-3.5 h-3.5', activeProfile.useAiderTools ? 'text-green-400' : 'text-neutral-500 opacity-50')} />}
                  onClick={() => handleToggleProfileSetting('useAiderTools', !activeProfile.useAiderTools)}
                  className="p-1.5 hover:bg-neutral-850 rounded-md"
                  tooltip={t('settings.agent.useAiderTools')}
                  tooltipId="agent-selector-tooltip"
                />
                <IconButton
                  icon={<MdFlashOn className={clsx('w-3.5 h-3.5', activeProfile.usePowerTools ? 'text-purple-400' : 'text-neutral-500 opacity-50')} />}
                  onClick={() => handleToggleProfileSetting('usePowerTools', !activeProfile.usePowerTools)}
                  className="p-1.5 hover:bg-neutral-850 rounded-md"
                  tooltip={t('settings.agent.usePowerTools')}
                  tooltipId="agent-selector-tooltip"
                />
                <IconButton
                  icon={
                    <MdOutlineFileCopy className={clsx('w-3.5 h-3.5', activeProfile.includeContextFiles ? 'text-yellow-400' : 'text-neutral-500 opacity-50')} />
                  }
                  onClick={() => handleToggleProfileSetting('includeContextFiles', !activeProfile.includeContextFiles)}
                  className="p-1.5 hover:bg-neutral-850 rounded-md"
                  tooltip={t('settings.agent.includeContextFiles')}
                  tooltipId="agent-selector-tooltip"
                />
                <IconButton
                  icon={<MdOutlineMap className={clsx('w-3.5 h-3.5', activeProfile.includeRepoMap ? 'text-blue-400' : 'text-neutral-500 opacity-50')} />}
                  onClick={() => handleToggleProfileSetting('includeRepoMap', !activeProfile.includeRepoMap)}
                  className="p-1.5 hover:bg-neutral-850 rounded-md"
                  tooltip={t('settings.agent.includeRepoMap')}
                  tooltipId="agent-selector-tooltip"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <StyledTooltip id="agent-selector-tooltip" />

      {showAgentProfilesDialog && (
        <SettingsDialog onClose={() => setShowAgentProfilesDialog(false)} initialTab={2} initialAgentProfileId={projectSettings?.agentProfileId} />
      )}
    </div>
  );
};

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MdCheck, MdDoneAll, MdFlashOn, MdOutlineChecklist, MdOutlineFileCopy, MdOutlineHdrAuto, MdOutlineMap } from 'react-icons/md';
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
      const activeServers = enabledServers.filter((serverName) => mcpServers[serverName]);

      if (activeServers.length === 0) {
        setEnabledToolsCount(0);
        return;
      }

      const timeoutId = setTimeout(() => setEnabledToolsCount(null), 1000);

      try {
        const toolCounts = await Promise.all(
          activeServers.map(async (serverName) => {
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
    return <div className="text-xs text-[var(--color-text-muted-light)]">{t('common.loading')}</div>;
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
        className={clsx(
          'flex items-center gap-1.5 px-2',
          'bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)]',
          'hover:bg-[var(--color-bg-secondary-light)] hover:text-[var(--color-text-primary)]',
          'focus:outline-none transition-colors duration-200',
          'text-xs border-[var(--color-border-default)]  border rounded-md min-h-[26px]',
        )}
      >
        <RiToolsFill className="w-3.5 h-3.5" />
        <span className="text-2xs truncate max-w-[250px] -mb-0.5">{activeProfile.name}</span>
        <span className="text-2xs font-mono text-[var(--color-text-muted)]">({enabledToolsCount ?? '...'})</span>
        {activeProfile.autoApprove && <MdDoneAll className="w-3.5 h-3.5 text-[var(--color-agent-autoapprove)] opacity-70" />}
        {activeProfile.useAiderTools && <MdOutlineHdrAuto className="w-3.5 h-3.5 text-[var(--color-agent-aidertools)] opacity-90" />}
        {activeProfile.usePowerTools && <MdFlashOn className="w-3.5 h-3.5 text-[var(--color-agent-powertools)] opacity-70" />}
        {activeProfile.useTodoTools && <MdOutlineChecklist className="w-3.5 h-3.5 text-[var(--color-agent-todotools)] opacity-70" />}
        {activeProfile.includeContextFiles && <MdOutlineFileCopy className="w-3 h-3 text-[var(--color-agent-contextfiles)] opacity-70" />}
        {activeProfile.includeRepoMap && <MdOutlineMap className="w-3 h-3 text-[var(--color-agent-repomap)] opacity-70" />}
      </button>

      {selectorVisible && (
        <div className="absolute bottom-full left-0 mb-1 bg-[var(--color-bg-primary-light)] border border-[var(--color-border-default-dark)] rounded-md shadow-lg z-10 min-w-[290px] max-w-[380px]">
          {/* Profiles List */}
          <div className="py-2 border-b border-[var(--color-border-dafault-dark)]">
            <div className="flex items-center justify-between mb-2 pl-3 pr-2">
              <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase">{t('agentProfiles.profiles')}</span>
              <IconButton
                icon={<BiCog className="w-4 h-4" />}
                onClick={handleOpenAgentProfiles}
                className="opacity-60 hover:opacity-100 p-1 hover:bg-[var(--color-bg-secondary)]  rounded-md"
                tooltip={t('agentProfiles.manageProfiles')}
                tooltipId="agent-selector-tooltip"
              />
            </div>
            <div className="max-h-[250px] overflow-y-auto">
              {agentProfiles.map((profile) => (
                <div
                  key={profile.id}
                  className={clsx(
                    'pl-6 pr-2 py-1 cursor-pointer transition-colors text-2xs relative',
                    profile.id === activeProfile.id
                      ? 'bg-[var(--color-bg-secondary-light)] text-[var(--color-text-primary)]'
                      : 'hover:bg-[var(--color-secondary-light)]  text-[var(--color-text-tertiary)] ',
                  )}
                  onClick={() => handleSwitchProfile(profile.id)}
                >
                  {profile.id === activeProfile.id && (
                    <MdCheck className="w-3 h-3 absolute left-1.5 top-1/2 transform -translate-y-1/2 text-[var(--color-agent-autoapprove)]" />
                  )}
                  <span className="truncate block">{profile.name}&nbsp;</span>
                </div>
              ))}
            </div>
          </div>

          {/* MCP Servers */}
          <div className="border-b border-[var(--color-border-default-dark)]">
            <Accordion
              title={
                <div className="flex items-center w-full">
                  <span className="text-xs flex-1 font-medium text-[var(--color-text-secondary)] text-left px-1 uppercase">{t('mcp.servers')}</span>
                  <span className="text-2xs text-[var(--color-text-tertiary)] bg-[var(--color-secondary-light)] px-1.5 py-0.5 rounded">
                    {enabledServers.filter((serverName) => mcpServers[serverName]).length}/{Object.keys(mcpServers).length}
                  </span>
                </div>
              }
              chevronPosition="right"
            >
              <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--color-secondary-light)] scrollbar-track-[var(--color-bg-primary-light)] pb-2">
                {Object.keys(mcpServers).length === 0 ? (
                  <div className="py-2 text-xs text-[var(--color-text-muted)] italic">{t('settings.agent.noServersConfiguredGlobal')}</div>
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
              <div className="flex items-center">
                <IconButton
                  icon={
                    <MdOutlineHdrAuto
                      className={clsx(
                        'w-3.5 h-3.5',
                        activeProfile.useAiderTools ? 'text-[var(--color-agent-autoapprove)]' : 'text-[var(--color-text-muted)] opacity-50',
                      )}
                    />
                  }
                  onClick={() => handleToggleProfileSetting('useAiderTools', !activeProfile.useAiderTools)}
                  className="p-1.5 hover:bg-[var(--color-bg-secondary)] rounded-md"
                  tooltip={t('settings.agent.useAiderTools')}
                  tooltipId="agent-selector-tooltip"
                />
                <IconButton
                  icon={
                    <MdFlashOn
                      className={clsx(
                        'w-3.5 h-3.5',
                        activeProfile.usePowerTools ? 'text-[var(--color-agent-powertools)]' : 'text-[var(--color-text-muted)] opacity-50',
                      )}
                    />
                  }
                  onClick={() => handleToggleProfileSetting('usePowerTools', !activeProfile.usePowerTools)}
                  className="p-1.5 hover:bg-[var(--color-bg-secondary)] rounded-md"
                  tooltip={t('settings.agent.usePowerTools')}
                  tooltipId="agent-selector-tooltip"
                />
                <IconButton
                  icon={
                    <MdOutlineChecklist
                      className={clsx(
                        'w-3.5 h-3.5',
                        activeProfile.useTodoTools ? 'text-[var(--color-agent-todotools)]' : 'text-[var(--color-text-muted)] opacity-50',
                      )}
                    />
                  }
                  onClick={() => handleToggleProfileSetting('useTodoTools', !activeProfile.useTodoTools)}
                  className="p-1.5 hover:bg-[var(--color-bg-secondary)] rounded-md"
                  tooltip={t('settings.agent.useTodoTools')}
                  tooltipId="agent-selector-tooltip"
                />
                <IconButton
                  icon={
                    <MdOutlineFileCopy
                      className={clsx(
                        'w-3.5 h-3.5',
                        activeProfile.includeContextFiles ? 'text-[var(--color-agent-contextfiles)]' : 'text-[var(--color-text-muted)] opacity-50',
                      )}
                    />
                  }
                  onClick={() => handleToggleProfileSetting('includeContextFiles', !activeProfile.includeContextFiles)}
                  className="p-1.5 hover:bg-[var(--color-bg-secondary)] rounded-md"
                  tooltip={t('settings.agent.includeContextFiles')}
                  tooltipId="agent-selector-tooltip"
                />
                <IconButton
                  icon={
                    <MdOutlineMap
                      className={clsx(
                        'w-3.5 h-3.5',
                        activeProfile.includeRepoMap ? 'text-[var(--color-agent-repomap)]' : 'text-[var(--color-text-muted)] opacity-50',
                      )}
                    />
                  }
                  onClick={() => handleToggleProfileSetting('includeRepoMap', !activeProfile.includeRepoMap)}
                  className="p-1.5 hover:bg-[var(--color-bg-secondary)] rounded-md"
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
        <SettingsDialog onClose={() => setShowAgentProfilesDialog(false)} initialTab={3} initialAgentProfileId={projectSettings?.agentProfileId} />
      )}
    </div>
  );
};

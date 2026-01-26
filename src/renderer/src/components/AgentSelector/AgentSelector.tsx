import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MdCheck, MdFlashOn, MdOutlineChecklist, MdOutlineFileCopy, MdOutlineHdrAuto, MdOutlineMap, MdPsychology, MdSave } from 'react-icons/md';
import { RiToolsFill } from 'react-icons/ri';
import { clsx } from 'clsx';
import { AgentProfile, TaskData, ToolApprovalState } from '@common/types';
import { BiCog } from 'react-icons/bi';
import { TOOL_GROUP_NAME_SEPARATOR } from '@common/tools';
import { useHotkeys } from 'react-hotkeys-hook';
import { LuBrain, LuClipboardList } from 'react-icons/lu';

import { McpServerSelectorItem } from './McpServerSelectorItem';

import { useClickOutside } from '@/hooks/useClickOutside';
import { IconButton } from '@/components/common/IconButton';
import { StyledTooltip } from '@/components/common/StyledTooltip';
import { Accordion } from '@/components/common/Accordion';
import { useSettings } from '@/contexts/SettingsContext';
import { useProjectSettings } from '@/contexts/ProjectSettingsContext';
import { useApi } from '@/contexts/ApiContext';
import { useAgents } from '@/contexts/AgentsContext';
import { useTask } from '@/contexts/TaskContext';
import { resolveAgentProfile } from '@/utils/agents';

type Props = {
  projectDir: string;
  task: TaskData;
  isActive: boolean;
  showSettingsPage?: (pageId?: string, options?: Record<string, unknown>) => void;
};

export const AgentSelector = memo(
  ({ projectDir, task, isActive, showSettingsPage }: Props) => {
    const { t } = useTranslation();
    const { settings } = useSettings();
    const { projectSettings, saveProjectSettings } = useProjectSettings();
    const { getProfiles, updateProfile } = useAgents();
    const [selectorVisible, setSelectorVisible] = useState(false);
    const [enabledToolsCount, setEnabledToolsCount] = useState<number | null>(null);
    const selectorRef = useRef<HTMLDivElement>(null);
    const api = useApi();
    const { updateTaskAgentProfile } = useTask();

    const profiles = useMemo(() => getProfiles(projectDir), [getProfiles, projectDir]);

    const activeTaskProfile = useMemo(() => {
      return resolveAgentProfile(task, projectSettings?.agentProfileId, profiles);
    }, [task, projectSettings?.agentProfileId, profiles]);
    const activeGlobalProfile = useMemo(() => {
      return profiles.find((p) => p.id === (task.agentProfileId || projectSettings?.agentProfileId));
    }, [profiles, projectSettings?.agentProfileId, task.agentProfileId]);
    const { mcpServers = {} } = settings || {};
    const { enabledServers = [], toolApprovals = {} } = activeTaskProfile || {};
    const handleToggleProfileSetting = useCallback(
      (setting: keyof AgentProfile, value: boolean) => {
        if (activeGlobalProfile) {
          const updatedProfile = { ...activeGlobalProfile, [setting]: value };
          void updateProfile(updatedProfile);
        }
      },
      [activeGlobalProfile, updateProfile],
    );

    useClickOutside(selectorRef, () => setSelectorVisible(false));

    useHotkeys(
      'alt+t',
      () => handleToggleProfileSetting('useTodoTools', !activeTaskProfile?.useTodoTools),
      {
        enabled: isActive,
        enableOnContentEditable: true,
      },
      [handleToggleProfileSetting],
    );
    useHotkeys(
      'alt+f',
      () => handleToggleProfileSetting('includeContextFiles', !activeTaskProfile?.includeContextFiles),
      {
        enabled: isActive,
        enableOnContentEditable: true,
      },
      [handleToggleProfileSetting],
    );
    useHotkeys(
      'alt+r',
      () => handleToggleProfileSetting('includeRepoMap', !activeTaskProfile?.includeRepoMap),
      {
        enabled: isActive,
        enableOnContentEditable: true,
      },
      [handleToggleProfileSetting],
    );

    useHotkeys(
      'alt+m',
      () => handleToggleProfileSetting('useMemoryTools', !activeTaskProfile?.useMemoryTools),
      {
        enabled: isActive,
        enableOnContentEditable: true,
      },
      [handleToggleProfileSetting],
    );

    useHotkeys(
      'alt+s',
      () => handleToggleProfileSetting('useSkillsTools', !activeTaskProfile?.useSkillsTools),
      {
        enabled: isActive,
        enableOnContentEditable: true,
      },
      [handleToggleProfileSetting],
    );

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
                const tools = await api.loadMcpServerTools(serverName, mcpServers[serverName]);
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
    }, [enabledServers, mcpServers, toolApprovals, api]);

    if (!activeTaskProfile && profiles.length === 0) {
      return <div className="text-xs text-text-muted-light">{t('common.loading')}</div>;
    }

    const handleSwitchProfile = (profileId: string) => {
      const newActiveProfile = profiles.find((p) => p.id === profileId);
      if (newActiveProfile) {
        updateTaskAgentProfile(task.id, newActiveProfile.id, newActiveProfile.provider, newActiveProfile.model);
        setSelectorVisible(false);
      }
    };

    const handleSaveAsProjectDefault = async () => {
      if (activeTaskProfile) {
        setSelectorVisible(false);
        await saveProjectSettings({
          agentProfileId: activeTaskProfile.id,
        });

        AgentSelector.displayName = 'AgentSelector';
      }
    };

    const handleToggleServer = (serverName: string) => {
      if (activeGlobalProfile) {
        const currentEnabledServers = activeGlobalProfile.enabledServers || [];
        const isEnabled = currentEnabledServers.includes(serverName);

        let newEnabledServers: string[];
        const newToolApprovals = { ...activeGlobalProfile.toolApprovals };

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
          ...activeGlobalProfile,
          enabledServers: newEnabledServers,
          toolApprovals: newToolApprovals,
        };
        void updateProfile(updatedProfile);
      }
    };

    const toggleSelectorVisible = () => {
      setSelectorVisible((prev) => !prev);
    };

    const handleOpenAgentProfiles = () => {
      showSettingsPage?.('agents', activeTaskProfile ? { agentProfileId: activeTaskProfile.id } : undefined);
      setSelectorVisible(false);
    };

    return (
      <div className="relative" ref={selectorRef}>
        <button
          onClick={toggleSelectorVisible}
          className={clsx(
            'flex items-center gap-1.5 px-2',
            'bg-bg-secondary text-text-tertiary',
            'hover:bg-bg-secondary-light hover:text-text-primary',
            'focus:outline-none transition-colors duration-200',
            'text-xs border-border-default border rounded-md min-h-[26px]',
          )}
        >
          <RiToolsFill className="w-3.5 h-3.5" />
          {activeTaskProfile ? (
            <>
              <span className="text-2xs truncate max-w-[250px] -mb-0.5">{activeTaskProfile.name}</span>
              <span className="text-2xs font-mono text-text-muted">({enabledToolsCount ?? '...'})</span>

              {activeTaskProfile.useAiderTools && <MdOutlineHdrAuto className="w-3.5 h-3.5 text-agent-aider-tools opacity-90" />}
              {activeTaskProfile.usePowerTools && <MdFlashOn className="w-3.5 h-3.5 text-agent-power-tools opacity-70" />}
              {activeTaskProfile.useTodoTools && <MdOutlineChecklist className="w-3.5 h-3.5 text-agent-todo-tools opacity-70" />}
              {activeTaskProfile.useTaskTools && <LuClipboardList className="w-3.5 h-3.5 text-agent-tasks-tools opacity-70" />}
              {activeTaskProfile.useMemoryTools && <LuBrain className="w-3 h-3 text-agent-memory-tools opacity-70" />}
              {activeTaskProfile.useSkillsTools && <MdPsychology className="w-3.5 h-3.5 text-agent-skills-tools opacity-70" />}
              {activeTaskProfile.includeContextFiles && <MdOutlineFileCopy className="w-3 h-3 text-agent-context-files opacity-70" />}
              {activeTaskProfile.includeRepoMap && <MdOutlineMap className="w-3 h-3 text-agent-repo-map opacity-70" />}
            </>
          ) : (
            <span className="text-2xs truncate max-w-[250px] -mb-0.5">{t('agentProfiles.selectProfile')}</span>
          )}
        </button>

        {selectorVisible && (
          <div className="absolute bottom-full left-0 mb-1 bg-bg-primary-light border border-border-default-dark rounded-md shadow-lg z-50 min-w-[290px] max-w-[380px] max-w-[calc(100vw-20px)]">
            {/* Profiles List */}
            <div className="py-2 border-b border-border-default-dark">
              <div className="flex items-center justify-between mb-2 pl-3 pr-2">
                <span className="text-xs font-medium text-text-secondary uppercase">{t('agentProfiles.title')}</span>
                <div className="flex items-center gap-1">
                  {activeTaskProfile && (
                    <IconButton
                      icon={<MdSave className="w-4 h-4" />}
                      onClick={handleSaveAsProjectDefault}
                      className="opacity-60 hover:opacity-100 p-1 hover:bg-bg-secondary rounded-md"
                      tooltip={t('agentProfiles.saveAsProjectDefault')}
                      tooltipId="agent-selector-tooltip"
                    />
                  )}
                  <IconButton
                    icon={<BiCog className="w-4 h-4" />}
                    onClick={handleOpenAgentProfiles}
                    className="opacity-60 hover:opacity-100 p-1 hover:bg-bg-secondary  rounded-md"
                    tooltip={t('agentProfiles.manageProfiles')}
                    tooltipId="agent-selector-tooltip"
                  />
                </div>
              </div>
              <div className="max-h-[250px] overflow-y-auto scrollbar-thin scrollbar-thumb-bg-secondary-light scrollbar-track-bg-primary-light">
                {profiles.map((profile) => (
                  <div
                    key={profile.id}
                    className={clsx(
                      'pl-6 pr-2 py-1 cursor-pointer transition-colors text-2xs relative',
                      profile.id === activeTaskProfile?.id ? 'bg-bg-secondary-light text-text-primary' : 'hover:bg-bg-secondary-light text-text-tertiary ',
                    )}
                    onClick={() => handleSwitchProfile(profile.id)}
                  >
                    {profile.id === activeTaskProfile?.id && (
                      <MdCheck className="w-3 h-3 absolute left-1.5 top-1/2 transform -translate-y-1/2 text-agent-auto-approve" />
                    )}
                    <span className="truncate block">{profile.name}&nbsp;</span>
                  </div>
                ))}
              </div>
            </div>

            {/* MCP Servers */}
            {activeTaskProfile && (
              <div className="border-b border-border-default-dark">
                <Accordion
                  title={
                    <div className="flex items-center w-full">
                      <span className="text-xs flex-1 font-medium text-text-secondary text-left px-1 uppercase">{t('mcp.servers')}</span>
                      <span className="text-2xs text-text-tertiary bg-secondary-light px-1.5 py-0.5 rounded">
                        {enabledServers.filter((serverName) => mcpServers[serverName]).length}/{Object.keys(mcpServers).length}
                      </span>
                    </div>
                  }
                  chevronPosition="right"
                >
                  <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-bg-secondary-light scrollbar-track-bg-primary-light pb-2">
                    {Object.keys(mcpServers).length === 0 ? (
                      <div className="py-2 text-xs text-text-muted italic">{t('settings.agent.noServersConfiguredGlobal')}</div>
                    ) : (
                      Object.keys(mcpServers).map((serverName) => (
                        <McpServerSelectorItem
                          key={serverName}
                          serverName={serverName}
                          disabled={!enabledServers.includes(serverName)}
                          toolApprovals={activeTaskProfile?.toolApprovals || {}}
                          onToggle={handleToggleServer}
                        />
                      ))
                    )}
                  </div>
                </Accordion>
              </div>
            )}

            {/* Quick Settings */}
            {activeTaskProfile && (
              <div className="px-3 py-2">
                <div className="flex items-center justify-end">
                  <IconButton
                    icon={
                      <MdOutlineHdrAuto
                        className={clsx('w-3.5 h-3.5', activeTaskProfile.useAiderTools ? 'text-agent-aider-tools' : 'text-text-muted opacity-50')}
                      />
                    }
                    onClick={() => handleToggleProfileSetting('useAiderTools', !activeTaskProfile.useAiderTools)}
                    className="p-1.5 hover:bg-bg-secondary rounded-md"
                    tooltip={t('settings.agent.useAiderTools')}
                    tooltipId="agent-selector-tooltip"
                  />
                  <IconButton
                    icon={
                      <MdFlashOn className={clsx('w-3.5 h-3.5', activeTaskProfile.usePowerTools ? 'text-agent-power-tools' : 'text-text-muted opacity-50')} />
                    }
                    onClick={() => handleToggleProfileSetting('usePowerTools', !activeTaskProfile.usePowerTools)}
                    className="p-1.5 hover:bg-bg-secondary rounded-md"
                    tooltip={t('settings.agent.usePowerTools')}
                    tooltipId="agent-selector-tooltip"
                  />
                  <IconButton
                    icon={
                      <MdOutlineChecklist
                        className={clsx('w-3.5 h-3.5', activeTaskProfile.useTodoTools ? 'text-agent-todo-tools' : 'text-text-muted opacity-50')}
                      />
                    }
                    onClick={() => handleToggleProfileSetting('useTodoTools', !activeTaskProfile.useTodoTools)}
                    className="p-1.5 hover:bg-bg-secondary rounded-md"
                    tooltip={`${t('settings.agent.useTodoTools')} (Alt + T)`}
                    tooltipId="agent-selector-tooltip"
                  />
                  <IconButton
                    icon={
                      <LuClipboardList
                        className={clsx('w-3.5 h-3.5', activeTaskProfile.useTaskTools ? 'text-agent-tasks-tools' : 'text-text-muted opacity-50')}
                      />
                    }
                    onClick={() => handleToggleProfileSetting('useTaskTools', !activeTaskProfile.useTaskTools)}
                    className="p-1.5 hover:bg-bg-secondary rounded-md"
                    tooltip={t('settings.agent.useTaskTools')}
                    tooltipId="agent-selector-tooltip"
                  />
                  <IconButton
                    icon={
                      <LuBrain className={clsx('w-3.5 h-3.5', activeTaskProfile.useMemoryTools ? 'text-agent-memory-tools' : 'text-text-muted opacity-50')} />
                    }
                    onClick={() => handleToggleProfileSetting('useMemoryTools', !activeTaskProfile.useMemoryTools)}
                    className="p-1.5 hover:bg-bg-secondary rounded-md"
                    tooltip={`${t('settings.agent.useMemoryTools')} (Alt + M)`}
                    tooltipId="agent-selector-tooltip"
                  />
                  <IconButton
                    icon={
                      <MdPsychology className={clsx('w-4 h-4', activeTaskProfile.useSkillsTools ? 'text-agent-skills-tools' : 'text-text-muted opacity-50')} />
                    }
                    onClick={() => handleToggleProfileSetting('useSkillsTools', !activeTaskProfile.useSkillsTools)}
                    className="p-1.5 hover:bg-bg-secondary rounded-md"
                    tooltip={`${t('settings.agent.useSkillsTools')} (Alt + S)`}
                    tooltipId="agent-selector-tooltip"
                  />
                  <IconButton
                    icon={
                      <MdOutlineFileCopy
                        className={clsx('w-3.5 h-3.5', activeTaskProfile.includeContextFiles ? 'text-agent-context-files' : 'text-text-muted opacity-50')}
                      />
                    }
                    onClick={() => handleToggleProfileSetting('includeContextFiles', !activeTaskProfile.includeContextFiles)}
                    className="p-1.5 hover:bg-bg-secondary rounded-md"
                    tooltip={`${t('settings.agent.includeContextFiles')} (Alt + F)`}
                    tooltipId="agent-selector-tooltip"
                  />
                  <IconButton
                    icon={
                      <MdOutlineMap className={clsx('w-3.5 h-3.5', activeTaskProfile.includeRepoMap ? 'text-agent-repo-map' : 'text-text-muted opacity-50')} />
                    }
                    onClick={() => handleToggleProfileSetting('includeRepoMap', !activeTaskProfile.includeRepoMap)}
                    className="p-1.5 hover:bg-bg-secondary rounded-md"
                    tooltip={`${t('settings.agent.includeRepoMap')} (Alt + R)`}
                    tooltipId="agent-selector-tooltip"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <StyledTooltip id="agent-selector-tooltip" />
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.projectDir === nextProps.projectDir &&
      prevProps.task.id === nextProps.task.id &&
      prevProps.task.agentProfileId === nextProps.task.agentProfileId &&
      prevProps.isActive === nextProps.isActive &&
      prevProps.showSettingsPage === nextProps.showSettingsPage
    );
  },
);

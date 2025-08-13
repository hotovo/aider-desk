import { AgentProfile, GenericTool, McpServerConfig, SettingsData, ToolApprovalState } from '@common/types';
import React, { ReactNode, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FaPencilAlt, FaPlus, FaSyncAlt } from 'react-icons/fa';
import { DEFAULT_AGENT_PROFILE } from '@common/agent';
import { BiTrash } from 'react-icons/bi';
import clsx from 'clsx';
import {
  AIDER_TOOL_ADD_CONTEXT_FILES,
  AIDER_TOOL_DESCRIPTIONS,
  AIDER_TOOL_DROP_CONTEXT_FILES,
  AIDER_TOOL_GET_CONTEXT_FILES,
  AIDER_TOOL_GROUP_NAME,
  AIDER_TOOL_RUN_PROMPT,
  POWER_TOOL_AGENT,
  POWER_TOOL_BASH,
  POWER_TOOL_DESCRIPTIONS,
  POWER_TOOL_FILE_EDIT,
  POWER_TOOL_FILE_READ,
  POWER_TOOL_FILE_WRITE,
  POWER_TOOL_GLOB,
  POWER_TOOL_GREP,
  POWER_TOOL_GROUP_NAME,
  POWER_TOOL_SEMANTIC_SEARCH,
  TODO_TOOL_CLEAR_ITEMS,
  TODO_TOOL_DESCRIPTIONS,
  TODO_TOOL_GET_ITEMS,
  TODO_TOOL_GROUP_NAME,
  TODO_TOOL_SET_ITEMS,
  TODO_TOOL_UPDATE_ITEM_COMPLETION,
} from '@common/tools';
import { useTranslation } from 'react-i18next';
import { MdFlashOn, MdOutlineChecklist, MdOutlineFileCopy, MdOutlineHdrAuto, MdOutlineMap, MdRepeat, MdThermostat } from 'react-icons/md';
import { FaArrowRightFromBracket } from 'react-icons/fa6';

import { McpServer, McpServerForm } from './McpServerForm';
import { McpServerItem } from './McpServerItem';
import { GenericToolGroupItem } from './GenericToolGroupItem';
import { AgentProfileItem } from './AgentProfileItem';
import { AgentRules } from './AgentRules';

import { Button } from '@/components/common/Button';
import { Slider } from '@/components/common/Slider';
import { InfoIcon } from '@/components/common/InfoIcon';
import { Accordion } from '@/components/common/Accordion';
import { Input } from '@/components/common/Input';
import { Checkbox } from '@/components/common/Checkbox';
import { TextArea } from '@/components/common/TextArea';

const tools: Record<string, GenericTool[]> = {
  [AIDER_TOOL_GROUP_NAME]: [
    {
      groupName: AIDER_TOOL_GROUP_NAME,
      name: AIDER_TOOL_GET_CONTEXT_FILES,
      description: AIDER_TOOL_DESCRIPTIONS[AIDER_TOOL_GET_CONTEXT_FILES],
    },
    {
      groupName: AIDER_TOOL_GROUP_NAME,
      name: AIDER_TOOL_ADD_CONTEXT_FILES,
      description: AIDER_TOOL_DESCRIPTIONS[AIDER_TOOL_ADD_CONTEXT_FILES],
    },
    {
      groupName: AIDER_TOOL_GROUP_NAME,
      name: AIDER_TOOL_DROP_CONTEXT_FILES,
      description: AIDER_TOOL_DESCRIPTIONS[AIDER_TOOL_DROP_CONTEXT_FILES],
    },
    {
      groupName: AIDER_TOOL_GROUP_NAME,
      name: AIDER_TOOL_RUN_PROMPT,
      description: AIDER_TOOL_DESCRIPTIONS[AIDER_TOOL_RUN_PROMPT],
    },
  ],
  [POWER_TOOL_GROUP_NAME]: [
    {
      groupName: POWER_TOOL_GROUP_NAME,
      name: POWER_TOOL_FILE_EDIT,
      description: POWER_TOOL_DESCRIPTIONS[POWER_TOOL_FILE_EDIT],
    },
    {
      groupName: POWER_TOOL_GROUP_NAME,
      name: POWER_TOOL_FILE_READ,
      description: POWER_TOOL_DESCRIPTIONS[POWER_TOOL_FILE_READ],
    },
    {
      groupName: POWER_TOOL_GROUP_NAME,
      name: POWER_TOOL_FILE_WRITE,
      description: POWER_TOOL_DESCRIPTIONS[POWER_TOOL_FILE_WRITE],
    },
    {
      groupName: POWER_TOOL_GROUP_NAME,
      name: POWER_TOOL_GLOB,
      description: POWER_TOOL_DESCRIPTIONS[POWER_TOOL_GLOB],
    },
    {
      groupName: POWER_TOOL_GROUP_NAME,
      name: POWER_TOOL_GREP,
      description: POWER_TOOL_DESCRIPTIONS[POWER_TOOL_GREP],
    },
    {
      groupName: POWER_TOOL_GROUP_NAME,
      name: POWER_TOOL_SEMANTIC_SEARCH,
      description: POWER_TOOL_DESCRIPTIONS[POWER_TOOL_SEMANTIC_SEARCH],
    },
    {
      groupName: POWER_TOOL_GROUP_NAME,
      name: POWER_TOOL_BASH,
      description: POWER_TOOL_DESCRIPTIONS[POWER_TOOL_BASH],
    },
    {
      groupName: POWER_TOOL_GROUP_NAME,
      name: POWER_TOOL_AGENT,
      description: POWER_TOOL_DESCRIPTIONS[POWER_TOOL_AGENT],
    },
  ],
  [TODO_TOOL_GROUP_NAME]: [
    {
      groupName: TODO_TOOL_GROUP_NAME,
      name: TODO_TOOL_SET_ITEMS,
      description: TODO_TOOL_DESCRIPTIONS[TODO_TOOL_SET_ITEMS],
    },
    {
      groupName: TODO_TOOL_GROUP_NAME,
      name: TODO_TOOL_GET_ITEMS,
      description: TODO_TOOL_DESCRIPTIONS[TODO_TOOL_GET_ITEMS],
    },
    {
      groupName: TODO_TOOL_GROUP_NAME,
      name: TODO_TOOL_UPDATE_ITEM_COMPLETION,
      description: TODO_TOOL_DESCRIPTIONS[TODO_TOOL_UPDATE_ITEM_COMPLETION],
    },
    {
      groupName: TODO_TOOL_GROUP_NAME,
      name: TODO_TOOL_CLEAR_ITEMS,
      description: TODO_TOOL_DESCRIPTIONS[TODO_TOOL_CLEAR_ITEMS],
    },
  ],
};

// Helper functions for accordion summaries
const getRunSettingsSummary = (profile: AgentProfile) => {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        <MdThermostat className="w-3 h-3 text-text-secondary" />
        <span>{profile.temperature}</span>
      </div>
      <span>|</span>
      <div className="flex items-center gap-1">
        <MdRepeat className="w-3 h-3 text-text-secondary" />
        <span>{profile.maxIterations}</span>
      </div>
      <span>|</span>
      <div className="flex items-center gap-1">
        <FaArrowRightFromBracket className="w-2.5 h-2.5 -rotate-90 text-text-secondary" />
        <span>{profile.maxTokens}</span>
      </div>
    </div>
  );
};

const getContextSummary = (profile: AgentProfile) => {
  const enabled: ReactNode[] = [];
  if (profile.includeContextFiles) {
    enabled.push(<MdOutlineFileCopy key="files" className="w-3 h-3 text-text-secondary" />);
  }
  if (profile.includeRepoMap) {
    enabled.push(<MdOutlineMap key="map" className="w-3 h-3 text-text-secondary" />);
  }
  return enabled.length > 0 ? (
    <div className="flex items-center gap-2">
      {enabled.map((icon, index) => (
        <React.Fragment key={index}>{icon}</React.Fragment>
      ))}
    </div>
  ) : (
    <span className="text-xs text-text-mutedLight">None</span>
  );
};

const getGenericToolsSummary = (profile: AgentProfile) => {
  const enabled: ReactNode[] = [];
  if (profile.useAiderTools) {
    enabled.push(<MdOutlineHdrAuto key="aider" className="w-3 h-3 text-text-secondary" />);
  }
  if (profile.usePowerTools) {
    enabled.push(<MdFlashOn key="power" className="w-3 h-3 text-text-secondary" />);
  }
  if (profile.useTodoTools) {
    enabled.push(<MdOutlineChecklist key="todo" className="w-3 h-3 text-text-secondary" />);
  }
  return enabled.length > 0 ? (
    <div className="flex items-center gap-2">
      {enabled.map((icon, index) => (
        <React.Fragment key={index}>{icon}</React.Fragment>
      ))}
    </div>
  ) : (
    <span className="text-xs text-text-mutedLight">None</span>
  );
};

const getMcpServersSummary = (profile: AgentProfile, mcpServers: Record<string, McpServerConfig>) => {
  const enabledCount = (profile.enabledServers || []).filter((serverName) => mcpServers[serverName]).length;
  const totalCount = Object.keys(mcpServers).length;
  return `${enabledCount}/${totalCount}`;
};

type Props = {
  settings: SettingsData;
  setSettings: (settings: SettingsData) => void;
  initialProfileId?: string;
};

export const AgentSettings = ({ settings, setSettings, initialProfileId }: Props) => {
  const { t } = useTranslation();
  const [isAddingMcpServer, setIsAddingMcpServer] = useState(false);
  const [editingMcpServer, setEditingMcpServer] = useState<McpServer | null>(null);
  const [isEditingMcpServersConfig, setIsEditingMcpServersConfig] = useState(false);
  const [mcpServersReloadTrigger, setMcpServersReloadTrigger] = useState(0);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(initialProfileId || DEFAULT_AGENT_PROFILE.id);

  const [mcpServersExpanded, setMcpServersExpanded] = useState(false);
  const profileNameInputRef = useRef<HTMLInputElement>(null);

  const { agentProfiles, mcpServers } = settings;
  const selectedProfile = agentProfiles.find((profile) => profile.id === selectedProfileId) || null;
  const defaultProfile = agentProfiles.find((profile) => profile.id === DEFAULT_AGENT_PROFILE.id) || DEFAULT_AGENT_PROFILE;

  const handleCreateNewProfile = () => {
    const newProfileId = uuidv4();
    const newProfile: AgentProfile = {
      ...DEFAULT_AGENT_PROFILE,
      id: newProfileId,
      name: t('settings.agent.newProfileName'),
      provider: defaultProfile.provider,
      model: defaultProfile.model,
    };
    setSettings({
      ...settings,
      agentProfiles: [...agentProfiles, newProfile],
    });
    setSelectedProfileId(newProfileId);
    setTimeout(() => {
      const profileNameInput = profileNameInputRef.current;
      if (profileNameInput) {
        profileNameInput.focus();
        profileNameInput.select();
      }
    }, 0); // Focus the input after the state update
  };

  const handleDeleteProfile = () => {
    if (selectedProfileId && selectedProfileId !== DEFAULT_AGENT_PROFILE.id) {
      const updatedProfiles = agentProfiles.filter((profile) => profile.id !== selectedProfileId);

      setSettings({
        ...settings,
        agentProfiles: updatedProfiles,
      });
      setSelectedProfileId(DEFAULT_AGENT_PROFILE.id);
    }
  };

  const handleProfileSettingChange = <K extends keyof AgentProfile>(field: K, value: AgentProfile[K]) => {
    if (selectedProfile) {
      setSettings({
        ...settings,
        agentProfiles: agentProfiles.map((profile) => (profile.id === selectedProfile.id ? { ...profile, [field]: value } : profile)),
      });
    }
  };

  const handleToggleServerEnabled = (serverKey: string, checked: boolean) => {
    if (selectedProfile) {
      const currentEnabledServers = selectedProfile.enabledServers || [];
      let newEnabledServers: string[];
      if (checked) {
        newEnabledServers = [...new Set([...currentEnabledServers, serverKey])];
      } else {
        newEnabledServers = currentEnabledServers.filter((s) => s !== serverKey);
        const newToolApprovals = { ...selectedProfile.toolApprovals };
        Object.keys(newToolApprovals).forEach((toolId) => {
          if (toolId.startsWith(`${serverKey}:`)) {
            delete newToolApprovals[toolId];
          }
        });
        handleProfileSettingChange('toolApprovals', newToolApprovals);
      }
      handleProfileSettingChange('enabledServers', newEnabledServers);
    }
  };

  const handleMcpServersReload = async () => {
    try {
      void window.api.reloadMcpServers(mcpServers, true);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to reload MCP servers:', error);
    }

    setMcpServersReloadTrigger((prev) => prev + 1);
  };

  const handleMcpServerRemove = (serverName: string) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [serverName]: removedServer, ...remainingServers } = settings.mcpServers;
    setSettings({ ...settings, mcpServers: remainingServers });
  };

  const handleServersConfigSave = (servers: Record<string, McpServerConfig>) => {
    let updatedMcpServers = { ...settings.mcpServers };

    if (isAddingMcpServer) {
      // Add new servers to the existing ones
      updatedMcpServers = {
        ...updatedMcpServers,
        ...servers,
      };
    } else if (editingMcpServer) {
      // If editing and the server name did not change, preserve the order
      const oldName = editingMcpServer.name;
      const newNames = Object.keys(servers);
      if (newNames.length === 1 && newNames[0] === oldName) {
        // Replace the server at the same position
        const entries = Object.entries(updatedMcpServers);
        const index = entries.findIndex(([name]) => name === oldName);
        if (index !== -1) {
          entries[index] = [oldName, servers[oldName]];
          updatedMcpServers = Object.fromEntries(entries);
        } else {
          // fallback: just replace as before
          const { [oldName]: _removed, ...rest } = updatedMcpServers;
          updatedMcpServers = {
            ...rest,
            ...servers,
          };
        }
      } else {
        // Remove the old server and add the updated one(s)
        const { [oldName]: _removed, ...rest } = updatedMcpServers;
        updatedMcpServers = {
          ...rest,
          ...servers,
        };
      }
    } else if (isEditingMcpServersConfig) {
      // Replace all servers with the new set
      updatedMcpServers = { ...servers };
    }

    setSettings({ ...settings, mcpServers: updatedMcpServers });
    setIsAddingMcpServer(false);
    setEditingMcpServer(null);
    setIsEditingMcpServersConfig(false);
  };

  const handleToolApprovalChange = (toolId: string, approval: ToolApprovalState) => {
    if (selectedProfile) {
      const newToolApprovals = {
        ...(selectedProfile.toolApprovals || {}),
        [toolId]: approval,
      };
      handleProfileSettingChange('toolApprovals', newToolApprovals);
    }
  };

  const renderSectionAccordion = (title: ReactNode, children: ReactNode, open?: boolean, setOpen?: (open: boolean) => void, summary?: ReactNode) => (
    <Accordion
      title={
        <div className="flex-1 text-left text-sm font-medium px-2 flex items-center justify-between">
          <div>{title}</div>
          {summary && <div className="text-xs text-text-mutedLight ml-2">{summary}</div>}
        </div>
      }
      chevronPosition="right"
      className="mb-2 border rounded-md border-border-default-dark"
      isOpen={open}
      onOpenChange={setOpen}
    >
      <div className="p-4 pt-2">{children}</div>
    </Accordion>
  );

  return isAddingMcpServer || editingMcpServer || isEditingMcpServersConfig ? (
    <McpServerForm
      onSave={handleServersConfigSave}
      onCancel={() => {
        setIsAddingMcpServer(false);
        setEditingMcpServer(null);
        setIsEditingMcpServersConfig(false);
      }}
      servers={
        isEditingMcpServersConfig
          ? Object.entries(settings.mcpServers).map(([name, config]) => ({
              name,
              config,
            }))
          : editingMcpServer
            ? [editingMcpServer]
            : undefined
      }
    />
  ) : (
    <div className="flex h-[600px] max-h-[100%] overflow-hidden -m-6">
      {/* Left sidebar with profiles and providers */}
      <div className="w-[260px] border-r border-bg-tertiary-strong p-4 pb-2 flex flex-col overflow-y-auto scrollbar-thin scrollbar-track-bg-secondary scrollbar-thumb-bg-tertiary">
        <h4 className="text-sm uppercase font-medium">{t('agentProfiles.profiles')}</h4>
        <div className="py-2">
          {agentProfiles.map((profile) => (
            <AgentProfileItem
              key={profile.id}
              profile={profile}
              isSelected={selectedProfileId === profile.id}
              onClick={(id) => {
                setSelectedProfileId(id);
              }}
              isDefault={profile.id === DEFAULT_AGENT_PROFILE.id}
            />
          ))}
          <button
            onClick={handleCreateNewProfile}
            className="w-full text-left px-2 py-1 mt-2 rounded-sm text-sm transition-colors text-text-primary hover:bg-bg-secondary-light flex items-center"
          >
            <FaPlus className="mr-1.5 w-2.5 h-2.5" /> {t('settings.agent.createNewProfile')}
          </button>
        </div>
      </div>

      {/* Center content area for profile settings */}
      <div className="flex-1 px-4 pr-6 pt-4 pb-6 space-y-4 overflow-y-auto scrollbar-thin scrollbar-track-bg-secondary-light scrollbar-thumb-bg-tertiary scrollbar-thumb-rounded-full">
        {selectedProfile ? (
          <div className="space-y-2">
            <Input
              ref={profileNameInputRef}
              label={t('agentProfiles.profileName')}
              value={selectedProfile.name}
              onChange={(e) => handleProfileSettingChange('name', e.target.value)}
              className="mb-2"
            />
            <TextArea
              label={t('agentProfiles.profileDescription')}
              id="agent-profile-description"
              className="mb-2 min-h-[100px]"
              value={selectedProfile.description || ''}
              onChange={(e) => handleProfileSettingChange('description', e.target.value)}
              placeholder={t('agentProfiles.profileDescriptionPlaceholder')}
            />

            {renderSectionAccordion(
              t('settings.agent.runSettings'),
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <Slider
                  label={
                    <div className="flex items-center text-xs">
                      <span>{t('settings.agent.temperature')}</span>
                      <InfoIcon className="ml-1" tooltip={t('settings.agent.temperatureTooltip')} />
                    </div>
                  }
                  min={0}
                  max={1}
                  step={0.1}
                  value={selectedProfile.temperature}
                  onChange={(value) => handleProfileSettingChange('temperature', value)}
                />
                <Slider
                  label={
                    <div className="flex items-center text-xs">
                      <span>{t('settings.agent.maxIterations')}</span>
                      <InfoIcon className="ml-1" tooltip={t('settings.agent.computationalResources')} />
                    </div>
                  }
                  min={1}
                  max={200}
                  value={selectedProfile.maxIterations}
                  onChange={(value) => handleProfileSettingChange('maxIterations', value)}
                />
                <Input
                  label={
                    <div className="flex items-center text-xs">
                      <span>{t('settings.agent.maxTokens')}</span>
                      <InfoIcon className="ml-1" tooltip={t('settings.agent.tokensPerResponse')} />
                    </div>
                  }
                  type="number"
                  min={1}
                  value={selectedProfile.maxTokens.toString()}
                  onChange={(e) => handleProfileSettingChange('maxTokens', Number(e.target.value))}
                />
                <Input
                  label={
                    <div className="flex items-center text-xs">
                      <span>{t('settings.agent.minTimeBetweenToolCalls')}</span>
                      <InfoIcon className="ml-1" tooltip={t('settings.agent.rateLimiting')} />
                    </div>
                  }
                  type="number"
                  min={0}
                  max={60000}
                  step={100}
                  value={selectedProfile.minTimeBetweenToolCalls.toString()}
                  onChange={(e) => handleProfileSettingChange('minTimeBetweenToolCalls', Number(e.target.value))}
                />
              </div>,
              undefined,
              undefined,
              <span className="text-xs text-text-mutedLight">{getRunSettingsSummary(selectedProfile)}</span>,
            )}

            {renderSectionAccordion(
              t('settings.agent.rules'),
              <AgentRules profile={selectedProfile} handleProfileSettingChange={handleProfileSettingChange} />,
            )}

            {renderSectionAccordion(
              t('settings.agent.context'),
              <div className="space-y-2">
                <Checkbox
                  label={
                    <div className="flex items-center">
                      <span>{t('settings.agent.includeContextFiles')}</span>
                      <InfoIcon className="ml-1" tooltip={t('settings.agent.includeFilesTooltip')} />
                    </div>
                  }
                  checked={selectedProfile.includeContextFiles}
                  onChange={(checked) => handleProfileSettingChange('includeContextFiles', checked)}
                />
                <Checkbox
                  label={
                    <div className="flex items-center">
                      <span>{t('settings.agent.includeRepoMap')}</span>
                      <InfoIcon className="ml-1" tooltip={t('settings.agent.includeRepoMapTooltip')} />
                    </div>
                  }
                  checked={selectedProfile.includeRepoMap}
                  onChange={(checked) => handleProfileSettingChange('includeRepoMap', checked)}
                />
              </div>,
              undefined,
              undefined,
              <span className="text-xs text-text-mutedLight">{getContextSummary(selectedProfile)}</span>,
            )}

            {renderSectionAccordion(
              t('settings.agent.genericTools'),
              <div>
                <div className="space-y-1">
                  {Object.entries(tools).map(([groupName, tools]) => {
                    const isGroupEnabled =
                      (selectedProfile.usePowerTools && groupName === POWER_TOOL_GROUP_NAME) ||
                      (selectedProfile.useAiderTools && groupName === AIDER_TOOL_GROUP_NAME) ||
                      (selectedProfile.useTodoTools && groupName === TODO_TOOL_GROUP_NAME);
                    return (
                      <div key={groupName}>
                        <GenericToolGroupItem
                          name={groupName}
                          tools={tools}
                          toolApprovals={selectedProfile.toolApprovals || {}}
                          onApprovalChange={handleToolApprovalChange}
                          enabled={isGroupEnabled}
                          onEnabledChange={(enabled) => {
                            if (groupName === POWER_TOOL_GROUP_NAME) {
                              handleProfileSettingChange('usePowerTools', enabled);
                            } else if (groupName === AIDER_TOOL_GROUP_NAME) {
                              handleProfileSettingChange('useAiderTools', enabled);
                            } else if (groupName === TODO_TOOL_GROUP_NAME) {
                              handleProfileSettingChange('useTodoTools', enabled);
                            }
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
                {Object.keys(tools).length === 0 && (
                  <div className="text-xs text-text-mutedLight my-4 text-center">{t('settings.agent.noGenericToolsConfigured')}</div>
                )}
              </div>,
              undefined,
              undefined,
              <span className="text-xs text-text-mutedLight">{getGenericToolsSummary(selectedProfile)}</span>,
            )}

            {renderSectionAccordion(
              t('settings.agent.mcpServers'),
              <div>
                <div className="space-y-1">
                  {Object.entries(mcpServers).map(([serverName, serverConfig]) => {
                    const isServerEnabled = (selectedProfile.enabledServers || []).includes(serverName);
                    return (
                      <div key={serverName}>
                        <McpServerItem
                          serverName={serverName}
                          config={serverConfig}
                          toolApprovals={selectedProfile.toolApprovals || {}}
                          onApprovalChange={handleToolApprovalChange}
                          enabled={isServerEnabled}
                          onEnabledChange={(checked) => handleToggleServerEnabled(serverName, checked)}
                          onRemove={() => handleMcpServerRemove(serverName)}
                          onEdit={() =>
                            setEditingMcpServer({
                              name: serverName,
                              config: serverConfig,
                            })
                          }
                          reloadTrigger={mcpServersReloadTrigger}
                        />
                      </div>
                    );
                  })}
                </div>
                {Object.keys(mcpServers).length === 0 && (
                  <div className="text-xs text-text-mutedLight my-4 text-center">{t('settings.agent.noServersConfigured')}</div>
                )}
                <div className={clsx('flex flex-1 items-center justify-end mt-4', Object.keys(mcpServers).length === 0 && 'justify-center')}>
                  {Object.keys(mcpServers).length > 0 && (
                    <>
                      <Button variant="text" className="ml-2 text-xs" onClick={() => setIsEditingMcpServersConfig(true)}>
                        <FaPencilAlt className="mr-1.5 w-2.5 h-2.5" /> {t('settings.agent.editConfig')}
                      </Button>
                      <Button variant="text" className="ml-2 text-xs" onClick={handleMcpServersReload}>
                        <FaSyncAlt className="mr-1.5 w-2.5 h-2.5" /> {t('settings.agent.reloadServers')}
                      </Button>
                    </>
                  )}
                  <Button onClick={() => setIsAddingMcpServer(true)} variant="text" className="ml-2 text-xs">
                    <FaPlus className="mr-1.5 w-2.5 h-2.5" /> {t('settings.agent.addMcpServer')}
                  </Button>
                </div>
              </div>,
              mcpServersExpanded,
              setMcpServersExpanded,
              <span className="text-xs text-text-mutedLight">{getMcpServersSummary(selectedProfile, mcpServers)}</span>,
            )}

            <div className="mt-4 pt-2 flex justify-end items-center">
              <Button
                onClick={handleDeleteProfile}
                variant="text"
                size="sm"
                color="danger"
                disabled={!selectedProfileId || selectedProfileId === DEFAULT_AGENT_PROFILE.id || agentProfiles.length <= 1}
              >
                <BiTrash className="w-4 h-4" />
                <span>{t('common.delete')}</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-text-muted">{t('settings.agent.selectOrCreateProfile')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

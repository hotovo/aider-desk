import { AgentProfile, ExtensionToolInfo, McpServerConfig, Model, ProjectData, SettingsData, ToolApprovalState } from '@common/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FaChevronLeft, FaChevronRight, FaPaste, FaPlus } from 'react-icons/fa';
import { DEFAULT_AGENT_PROFILE, getProviderModelId, DEFAULT_AGENT_PROFILES } from '@common/agent';
import { BiReset, BiTrash } from 'react-icons/bi';
import { closestCenter, DndContext, type DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useTranslation } from 'react-i18next';

import { McpServer, McpServerForm } from './McpServerForm';
import { SortableAgentProfileItem } from './SortableAgentProfileItem';
import { ProfileGeneralSection } from './sections/ProfileGeneralSection';
import { ProfilePromptsSection } from './sections/ProfilePromptsSection';
import { ProfileToolsSection } from './sections/ProfileToolsSection';
import { ProfileSubagentsSection } from './sections/ProfileSubagentsSection';

import { useApi } from '@/contexts/ApiContext';
import { getPathBasename } from '@/utils/path-utils';
import { IconButton } from '@/components/common/IconButton';
import { Button } from '@/components/common/Button';
import { ModelSelector } from '@/components/ModelSelector';
import { Input } from '@/components/common/Input';
import { Tabs } from '@/components/common/Tabs';
import { useModelProviders } from '@/contexts/ModelProviderContext';
import { showErrorNotification } from '@/utils/notifications';

enum ProfileTab {
  General = 'general',
  Prompts = 'prompts',
  Tools = 'tools',
  Subagents = 'subagents',
}

type Props = {
  settings: SettingsData;
  setSettings: (settings: SettingsData) => void;
  agentProfiles: AgentProfile[];
  setAgentProfiles: (profiles: AgentProfile[]) => void;
  initialProfileId?: string;
  openProjects?: ProjectData[];
  selectedProfileContext?: 'global' | string;
};

export const AgentSettings = ({
  settings,
  setSettings,
  agentProfiles,
  setAgentProfiles,
  initialProfileId,
  openProjects = [],
  selectedProfileContext,
}: Props) => {
  const { t } = useTranslation();
  const [isAddingMcpServer, setIsAddingMcpServer] = useState(false);
  const [editingMcpServer, setEditingMcpServer] = useState<McpServer | null>(null);
  const [isEditingMcpServersConfig, setIsEditingMcpServersConfig] = useState(false);
  const [mcpServersReloadTrigger, setMcpServersReloadTrigger] = useState(0);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(initialProfileId || DEFAULT_AGENT_PROFILE.id);
  const [activeTab, setActiveTab] = useState<ProfileTab>(ProfileTab.General);

  // Profile context state for project-level profiles
  const contexts = useMemo(() => ['global', ...openProjects.map((p) => p.baseDir)], [openProjects]);
  const [contextIndex, setContextIndex] = useState(0);
  const [profileContext, setProfileContext] = useState<'global' | string>(selectedProfileContext || 'global');

  const api = useApi();
  const { models, providers } = useModelProviders();
  const [extensionToolsInfo, setExtensionToolsInfo] = useState<ExtensionToolInfo[]>([]);

  useEffect(() => {
    api
      .getExtensionToolsInfo(profileContext === 'global' ? undefined : profileContext)
      .then(setExtensionToolsInfo)
      .catch(() => setExtensionToolsInfo([]));
  }, [api, profileContext]);

  // Sync internal profileContext with selectedProfileContext prop
  useEffect(() => {
    if (selectedProfileContext !== undefined) {
      setProfileContext(selectedProfileContext);
      // Update contextIndex to match the selected context
      const newIndex = contexts.indexOf(selectedProfileContext);
      if (newIndex !== -1) {
        setContextIndex(newIndex);
      }
    }
  }, [selectedProfileContext, contexts]);

  // Keep latest values in refs so the effect can read them without depending on them
  const agentProfilesRef = useRef(agentProfiles);
  const contextsRef = useRef(contexts);
  useEffect(() => {
    agentProfilesRef.current = agentProfiles;
    contextsRef.current = contexts;
  });

  // Handle initial profile ID - set context and select profile
  useEffect(() => {
    const profiles = agentProfilesRef.current;
    const contexts = contextsRef.current;
    if (initialProfileId && profiles.length > 0) {
      const initialProfile = profiles.find((p) => p.id === initialProfileId);
      if (initialProfile) {
        // Set the profile context based on the initial profile's projectDir
        const targetContext = initialProfile.projectDir || 'global';
        setProfileContext(targetContext);

        // Update contextIndex to match the target context
        const newIndex = contexts.indexOf(targetContext);
        if (newIndex !== -1) {
          setContextIndex(newIndex);
        }

        // Select the initial profile
        setSelectedProfileId(initialProfileId);
      }
    }
  }, [initialProfileId]);

  const profileNameInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [clipboardProfile, setClipboardProfile] = useState<{ profile: AgentProfile; action: 'copy' | 'cut' } | null>(null);

  const { mcpServers } = settings;
  const selectedProfile = agentProfiles.find((profile) => profile.id === selectedProfileId) || null;
  const defaultProfile = agentProfiles.find((profile) => profile.id === DEFAULT_AGENT_PROFILE.id) || DEFAULT_AGENT_PROFILE;

  // Context navigation logic
  const navigateContext = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'prev' ? (contextIndex - 1 + contexts.length) % contexts.length : (contextIndex + 1) % contexts.length;
    setContextIndex(newIndex);
    setProfileContext(contexts[newIndex]);
  };

  // Filter profiles based on current context
  const filteredProfiles = useMemo(() => {
    if (profileContext === 'global') {
      return agentProfiles.filter((p) => !p.projectDir);
    }
    return agentProfiles.filter((p) => p.projectDir === profileContext);
  }, [agentProfiles, profileContext]);

  // Calculate missing default profiles (only for global context)
  const missingDefaultProfiles = useMemo(() => {
    if (profileContext !== 'global') {
      return [];
    }

    const currentProfileIds = agentProfiles.map((p) => p.id);
    return DEFAULT_AGENT_PROFILES.filter((defaultProfile) => !currentProfileIds.includes(defaultProfile.id));
  }, [agentProfiles, profileContext]);

  // Profiles that can act as subagents for the selected profile
  const availableSubagents = useMemo(() => {
    if (!selectedProfile) {
      return [];
    }
    return agentProfiles.filter((p) => p.id !== selectedProfile.id && p.subagent.enabled && (!p.projectDir || p.projectDir === profileContext));
  }, [agentProfiles, selectedProfile, profileContext]);

  // Get context display name
  const getContextDisplayName = () => {
    if (profileContext === 'global') {
      return 'Global';
    }
    const project = openProjects.find((p) => p.baseDir === profileContext);
    return project ? getPathBasename(project.baseDir) : profileContext;
  };

  // Update filtered profiles when context changes
  useEffect(() => {
    if (filteredProfiles.length > 0 && !filteredProfiles.some((p) => p.id === selectedProfileId)) {
      setSelectedProfileId(filteredProfiles[0].id);
    } else if (filteredProfiles.length === 0) {
      setSelectedProfileId(null);
    }
  }, [filteredProfiles, selectedProfileId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 150,
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = filteredProfiles.findIndex((p) => p.id === active.id);
      const newIndex = filteredProfiles.findIndex((p) => p.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        // Get the actual indices in the full agentProfiles array
        const activeProfile = filteredProfiles[oldIndex];
        const overProfile = filteredProfiles[newIndex];
        const actualOldIndex = agentProfiles.findIndex((p) => p.id === activeProfile.id);
        const actualNewIndex = agentProfiles.findIndex((p) => p.id === overProfile.id);

        if (actualOldIndex !== -1 && actualNewIndex !== -1) {
          const reorderedProfiles = arrayMove(agentProfiles, actualOldIndex, actualNewIndex);
          // Update order using the new API
          setAgentProfiles(reorderedProfiles);
        }
      }
    }
    setTimeout(() => {
      setDragging(false);
    }, 0);
  };

  // useMemo for project IDs to prevent SortableContext from re-rendering unnecessarily
  const agentProfileIds = useMemo(() => filteredProfiles.map((p) => p.id), [filteredProfiles]);

  const handleCreateNewProfile = () => {
    const newProfileId = uuidv4();
    const newProfile: AgentProfile = {
      ...DEFAULT_AGENT_PROFILE,
      id: newProfileId,
      name: t('settings.agent.newProfileName'),
      provider: defaultProfile.provider,
      model: defaultProfile.model,
      projectDir: profileContext === 'global' ? undefined : profileContext,
    };
    setAgentProfiles([...agentProfiles, newProfile]);
    setSelectedProfileId(newProfileId);
    setTimeout(() => {
      const profileNameInput = profileNameInputRef.current;
      if (profileNameInput) {
        profileNameInput.focus();
        profileNameInput.select();
      }
    }, 0); // Focus the input after the state update
  };

  const handleDeleteProfile = (agentProfileId: string | null) => {
    if (agentProfileId && agentProfileId !== DEFAULT_AGENT_PROFILE.id) {
      setAgentProfiles(agentProfiles.filter((p) => p.id !== agentProfileId));
    }
  };

  const isDefaultProfile = (profileId: string | null): boolean => {
    return profileId !== null && DEFAULT_AGENT_PROFILES.some((profile) => profile.id === profileId);
  };

  const handleResetProfile = () => {
    if (selectedProfileId) {
      const defaultProfile = DEFAULT_AGENT_PROFILES.find((profile) => profile.id === selectedProfileId);
      if (defaultProfile) {
        const resetProfile = { ...defaultProfile, id: selectedProfileId };
        setAgentProfiles(agentProfiles.map((p) => (p.id === selectedProfileId ? resetProfile : p)));
      }
    }
  };

  const handleRestoreProfile = (profileId: string) => {
    const defaultProfile = DEFAULT_AGENT_PROFILES.find((profile) => profile.id === profileId);
    if (defaultProfile) {
      setAgentProfiles([...agentProfiles, defaultProfile]);
      setSelectedProfileId(profileId);
    }
  };

  const handleCopyProfile = (profile: AgentProfile) => {
    setClipboardProfile({ profile: { ...profile }, action: 'copy' });
  };

  const handleCutProfile = (profile: AgentProfile) => {
    if (profile.id !== DEFAULT_AGENT_PROFILE.id) {
      setClipboardProfile({ profile: { ...profile }, action: 'cut' });
    }
  };

  const handlePasteProfile = () => {
    if (clipboardProfile) {
      const newProfileId = uuidv4();
      const newProfile: AgentProfile = {
        ...clipboardProfile.profile,
        id: newProfileId,
        name: clipboardProfile.profile.name,
        projectDir: profileContext === 'global' ? undefined : profileContext,
      };

      // If this was a cut operation, remove the original and add new one
      if (clipboardProfile.action === 'cut') {
        setAgentProfiles(agentProfiles.filter((p) => p.id !== clipboardProfile.profile.id).concat(newProfile));
        setClipboardProfile(null);
      } else {
        // For copy operation, just add the new profile
        setAgentProfiles([...agentProfiles, newProfile]);
      }

      setSelectedProfileId(newProfileId);

      setTimeout(() => {
        const profileNameInput = profileNameInputRef.current;
        if (profileNameInput) {
          profileNameInput.focus();
          profileNameInput.select();
        }
      }, 0);
    }
  };

  const handleProfileSettingChange = <K extends keyof AgentProfile>(field: K, value: AgentProfile[K]) => {
    if (selectedProfile) {
      const updatedProfile = { ...selectedProfile, [field]: value };
      setAgentProfiles(agentProfiles.map((p) => (p.id === selectedProfile.id ? updatedProfile : p)));
    }
  };

  const handleProfileChange = (profile: AgentProfile) => {
    setAgentProfiles(agentProfiles.map((p) => (p.id === profile.id ? profile : p)));
  };

  const handleRemovePreferredModel = useCallback(
    (modelId: string) => {
      const updatedSettings = {
        ...settings,
        preferredModels: settings.preferredModels.filter((preferred) => preferred !== modelId),
      };
      setSettings(updatedSettings);
    },
    [settings, setSettings],
  );

  const handleAddPreferredModel = (modelId: string) => {
    const updatedSettings = {
      ...settings,
      preferredModels: [...new Set([modelId, ...settings.preferredModels])],
    };
    setSettings(updatedSettings);
  };

  const handleModelChange = (model: Model | null) => {
    if (!model || !selectedProfile) {
      return;
    }

    const selectedModelId = getProviderModelId(model);
    const providerId = model.providerId;
    const modelId = model.id;

    // Validate provider
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) {
      showErrorNotification(
        t('modelSelector.providerNotConfigured', {
          provider: providerId,
          providers: providers.map((p) => p.id).join(', '),
        }),
      );
      return;
    }

    // Update profile
    const updatedProfile = {
      ...selectedProfile,
      provider: providerId,
      model: modelId,
    };
    handleProfileChange(updatedProfile);

    // Add to preferred models
    handleAddPreferredModel(selectedModelId);
  };

  const currentModelId = selectedProfile ? `${selectedProfile.provider}/${selectedProfile.model}` : undefined;

  const agentModels = useMemo(() => {
    const agentModelsList = [...models];

    // Add custom model if not in list
    if (currentModelId) {
      const existingModel = agentModelsList.find((model) => getProviderModelId(model) === currentModelId);
      if (!existingModel) {
        const [providerId, ...modelNameParts] = currentModelId.split('/');
        const modelId = modelNameParts.join('/');
        if (providerId && modelId) {
          const customModel: Model = {
            id: modelId,
            providerId: providerId,
          };
          agentModelsList.unshift(customModel);
        }
      }
    }
    return agentModelsList;
  }, [currentModelId, models]);

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
      void api.reloadMcpServers(mcpServers, true);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to reload MCP servers:', error);
    }

    setMcpServersReloadTrigger((prev) => prev + 1);
  };

  const handleMcpServerRemove = (serverName: string) => {
    const { [serverName]: removedServer, ...remainingServers } = settings.mcpServers;
    setSettings({ ...settings, mcpServers: remainingServers });
    if (removedServer) {
      void api.reloadMcpServer(serverName, removedServer);
    }
  };

  const handleServersConfigSave = (servers: Record<string, McpServerConfig>) => {
    let updatedMcpServers = { ...settings.mcpServers };
    const serversToReload: Record<string, McpServerConfig> = {};

    if (isAddingMcpServer) {
      // Add new servers to the existing ones
      Object.entries(servers).forEach(([name, config]) => {
        updatedMcpServers[name] = config;
        serversToReload[name] = config;
      });
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
        serversToReload[oldName] = servers[oldName];
      } else {
        // Remove the old server and add the updated one(s)
        const { [oldName]: _removed, ...rest } = updatedMcpServers;
        updatedMcpServers = {
          ...rest,
          ...servers,
        };
        Object.entries(servers).forEach(([name, config]) => {
          serversToReload[name] = config;
        });
      }
    } else if (isEditingMcpServersConfig) {
      // Replace all servers with the new set
      updatedMcpServers = { ...servers };
      Object.entries(servers).forEach(([name, config]) => {
        serversToReload[name] = config;
      });
    }

    setSettings({ ...settings, mcpServers: updatedMcpServers });
    setIsAddingMcpServer(false);
    setEditingMcpServer(null);
    setIsEditingMcpServersConfig(false);

    Object.entries(serversToReload).forEach(([serverName, config]) => {
      void api.reloadMcpServer(serverName, config);
    });
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

  const profileTabs = [
    { id: ProfileTab.General, label: t('settings.agent.tabs.general') },
    { id: ProfileTab.Prompts, label: t('settings.agent.tabs.prompts') },
    { id: ProfileTab.Tools, label: t('settings.agent.tabs.tools') },
    { id: ProfileTab.Subagents, label: t('settings.agent.tabs.subagents') },
  ];

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId as ProfileTab);
  };

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
    <div className="flex h-full w-full overflow-hidden">
      {/* Left List Pane */}
      <div className="w-[260px] flex-shrink-0 border-r border-border-default flex flex-col">
        {/* Profile Context Header */}
        <div className="p-3 border-b border-border-default">
          <div className="flex items-center justify-between">
            <IconButton
              icon={<FaChevronLeft className="w-3 h-3" />}
              onClick={() => navigateContext('prev')}
              tooltip={t('settings.agent.previousContext')}
              disabled={contexts.length <= 1}
              className="p-1"
            />
            <div className="text-xs text-text-secondary truncate flex-1 text-center">{getContextDisplayName()}</div>
            <IconButton
              icon={<FaChevronRight className="w-3 h-3" />}
              onClick={() => navigateContext('next')}
              tooltip={t('settings.agent.nextContext')}
              disabled={contexts.length <= 1}
              className="p-1"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-bg-tertiary">
          {filteredProfiles.length === 0 ? (
            <div className="h-full px-8 text-center flex items-center justify-center py-8 text-text-muted-light text-xs">
              {t('settings.agent.noProfilesInContext')}
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={() => setDragging(true)} onDragEnd={handleDragEnd}>
              <SortableContext items={agentProfileIds} strategy={verticalListSortingStrategy}>
                {filteredProfiles.map((profile) => (
                  <SortableAgentProfileItem
                    key={profile.id}
                    profile={profile}
                    isSelected={selectedProfileId === profile.id}
                    onClick={(id) => {
                      if (!dragging) {
                        setSelectedProfileId(id);
                      }
                    }}
                    onCopy={handleCopyProfile}
                    onCut={handleCutProfile}
                    isCut={clipboardProfile?.action === 'cut' && clipboardProfile.profile.id === profile.id}
                    onDelete={(profile) => handleDeleteProfile(profile.id)}
                    isDefaultProfile={profile.id === DEFAULT_AGENT_PROFILE.id}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
        {/* Missing Default Profiles Section - Only shown in global context */}
        {profileContext === 'global' && missingDefaultProfiles.length > 0 && (
          <div className="py-2 border-t border-border-default-dark">
            {missingDefaultProfiles.map((profile) => (
              <div
                key={profile.id}
                className="px-2 py-1 rounded-sm text-sm transition-colors flex items-center justify-between text-text-muted-light"
                onClick={() => setSelectedProfileId(profile.id)}
              >
                <div className="flex items-center">
                  {profile.subagent.enabled && (
                    <div className="w-3 h-3 rounded-full mr-2 border border-border-muted" style={{ backgroundColor: profile.subagent.color }} />
                  )}
                  <span className="flex-1 text-sm">{profile.name}</span>
                </div>
                <IconButton
                  icon={<FaPlus className="w-3 h-3" />}
                  onClick={() => handleRestoreProfile(profile.id)}
                  tooltip={t('settings.agent.restoreProfileTooltip')}
                  className="p-1 hover:bg-bg-tertiary rounded text-text-muted-light hover:text-text-primary"
                />
              </div>
            ))}
          </div>
        )}
        <div className="p-2 border-t border-border-default flex items-center justify-center gap-2">
          <Button onClick={handleCreateNewProfile} className="" variant="text" size="sm" color="primary">
            <FaPlus className="mr-2 w-3 h-3" /> {t('settings.agent.createNewProfileInContext')}
          </Button>
          {clipboardProfile && (
            <IconButton
              onClick={handlePasteProfile}
              icon={<FaPaste className="w-4 h-4 text-button-primary" />}
              tooltip={t('settings.agent.pasteProfile')}
              className="p-2 rounded hover:bg-button-primary-subtle"
            />
          )}
        </div>
      </div>

      {/* Right Details Pane */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {selectedProfile ? (
          <>
            {/* Profile Header */}
            <div className="px-6 pt-5 pb-1">
              <div className="max-w-3xl mx-auto space-y-3">
                <div className="flex items-end gap-2">
                  <Input
                    ref={profileNameInputRef}
                    label={t('agentProfiles.profileName')}
                    value={selectedProfile.name}
                    onChange={(e) => handleProfileSettingChange('name', e.target.value)}
                    wrapperClassName="flex-1"
                  />
                  {isDefaultProfile(selectedProfileId) && (
                    <IconButton
                      icon={<BiReset className="w-4 h-4" />}
                      onClick={handleResetProfile}
                      tooltip={t('settings.agent.resetProfileToDefaults')}
                      className="p-2 mb-0.5 hover:bg-bg-tertiary rounded text-text-muted-light hover:text-text-primary"
                    />
                  )}
                  <IconButton
                    icon={<BiTrash className="w-4 h-4" />}
                    onClick={() => handleDeleteProfile(selectedProfileId)}
                    tooltip={t('common.delete')}
                    disabled={!selectedProfileId || selectedProfileId === DEFAULT_AGENT_PROFILE.id || agentProfiles.length <= 1}
                    className="p-2 mb-0.5 hover:bg-bg-tertiary rounded text-text-muted-light hover:text-text-error"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">{t('agentProfiles.model')}</label>
                  <div className="w-full p-2 bg-bg-secondary-light border-2 border-border-default rounded focus-within:outline-none focus-within:border-border-light">
                    <ModelSelector
                      className="w-full justify-between"
                      models={agentModels}
                      selectedModelId={currentModelId}
                      onChange={handleModelChange}
                      preferredModelIds={settings.preferredModels || []}
                      removePreferredModel={handleRemovePreferredModel}
                      providers={providers}
                    />
                  </div>
                </div>
                <Tabs tabs={profileTabs} activeTabId={activeTab} onTabChange={handleTabChange} />
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 min-h-0 overflow-hidden px-6 pb-4">
              <div className="max-w-3xl mx-auto p-3 border border-border-dark-light rounded max-h-full overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-bg-tertiary">
                {activeTab === ProfileTab.General && (
                  <ProfileGeneralSection profile={selectedProfile} settings={settings} onSettingChange={handleProfileSettingChange} />
                )}
                {activeTab === ProfileTab.Prompts && <ProfilePromptsSection profile={selectedProfile} onSettingChange={handleProfileSettingChange} />}
                {activeTab === ProfileTab.Tools && (
                  <ProfileToolsSection
                    profile={selectedProfile}
                    mcpServers={mcpServers}
                    extensionToolsInfo={extensionToolsInfo}
                    mcpServersReloadTrigger={mcpServersReloadTrigger}
                    onSettingChange={handleProfileSettingChange}
                    onApprovalChange={handleToolApprovalChange}
                    onToggleServerEnabled={handleToggleServerEnabled}
                    onMcpServerRemove={handleMcpServerRemove}
                    onMcpServerEdit={setEditingMcpServer}
                    onAddMcpServer={() => setIsAddingMcpServer(true)}
                    onEditMcpServersConfig={() => setIsEditingMcpServersConfig(true)}
                    onReloadMcpServers={handleMcpServersReload}
                  />
                )}
                {activeTab === ProfileTab.Subagents && (
                  <ProfileSubagentsSection profile={selectedProfile} availableSubagents={availableSubagents} onSettingChange={handleProfileSettingChange} />
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-xs">
            <p className="text-text-muted">{t('settings.agent.selectOrCreateProfile')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

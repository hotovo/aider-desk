import {
  AgentProfile,
  ContextMemoryMode,
  GenericTool,
  InvocationMode,
  McpServerConfig,
  Model,
  ProjectData,
  SettingsData,
  ToolApprovalState,
} from '@common/types';
import React, { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FaChevronLeft, FaChevronRight, FaList, FaPaste, FaPencilAlt, FaPlus, FaSyncAlt, FaTimes, FaBrain } from 'react-icons/fa';
import { MdFlashOn, MdOutlineChecklist, MdOutlineFileCopy, MdOutlineHdrAuto, MdOutlineMap, MdRepeat, MdThermostat, MdPsychology } from 'react-icons/md';
import { DEFAULT_AGENT_PROFILE, DEFAULT_MODEL_TEMPERATURE, AVAILABLE_PROVIDERS, getProviderModelId, DEFAULT_AGENT_PROFILES } from '@common/agent';
import { BiTrash } from 'react-icons/bi';
import { clsx } from 'clsx';
import Sketch from '@uiw/react-color-sketch';
import { closestCenter, DndContext, type DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import {
  AIDER_TOOL_ADD_CONTEXT_FILES,
  AIDER_TOOL_DESCRIPTIONS,
  AIDER_TOOL_DROP_CONTEXT_FILES,
  AIDER_TOOL_GET_CONTEXT_FILES,
  AIDER_TOOL_GROUP_NAME,
  AIDER_TOOL_RUN_PROMPT,
  POWER_TOOL_BASH,
  POWER_TOOL_DESCRIPTIONS,
  POWER_TOOL_FETCH,
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
  TASKS_TOOL_CREATE_TASK,
  TASKS_TOOL_DELETE_TASK,
  TASKS_TOOL_DESCRIPTIONS,
  TASKS_TOOL_GET_TASK,
  TASKS_TOOL_GET_TASK_MESSAGE,
  TASKS_TOOL_GROUP_NAME,
  TASKS_TOOL_LIST_TASKS,
  TASKS_TOOL_SEARCH_TASK,
  MEMORY_TOOL_DELETE,
  MEMORY_TOOL_DESCRIPTIONS,
  MEMORY_TOOL_GROUP_NAME,
  MEMORY_TOOL_LIST,
  MEMORY_TOOL_UPDATE,
  MEMORY_TOOL_RETRIEVE,
  MEMORY_TOOL_STORE,
  SKILLS_TOOL_GROUP_NAME,
} from '@common/tools';
import { useTranslation } from 'react-i18next';
import { FaArrowRightFromBracket } from 'react-icons/fa6';

import { McpServer, McpServerForm } from './McpServerForm';
import { McpServerItem } from './McpServerItem';
import { GenericToolGroupItem } from './GenericToolGroupItem';
import { AgentRules } from './AgentRules';
import { SortableAgentProfileItem } from './SortableAgentProfileItem';

import { useApi } from '@/contexts/ApiContext';
import { getPathBasename } from '@/utils/path-utils';
import { IconButton } from '@/components/common/IconButton';
import { Button } from '@/components/common/Button';
import { ModelSelector } from '@/components/ModelSelector';
import { Slider } from '@/components/common/Slider';
import { InfoIcon } from '@/components/common/InfoIcon';
import { Accordion } from '@/components/common/Accordion';
import { Input } from '@/components/common/Input';
import { Checkbox } from '@/components/common/Checkbox';
import { Select } from '@/components/common/Select';
import { TextArea } from '@/components/common/TextArea';
import { useModelProviders } from '@/contexts/ModelProviderContext';
import { showErrorNotification } from '@/utils/notifications';

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
      name: POWER_TOOL_FETCH,
      description: POWER_TOOL_DESCRIPTIONS[POWER_TOOL_FETCH],
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
  [TASKS_TOOL_GROUP_NAME]: [
    {
      groupName: TASKS_TOOL_GROUP_NAME,
      name: TASKS_TOOL_LIST_TASKS,
      description: TASKS_TOOL_DESCRIPTIONS[TASKS_TOOL_LIST_TASKS],
    },
    {
      groupName: TASKS_TOOL_GROUP_NAME,
      name: TASKS_TOOL_GET_TASK,
      description: TASKS_TOOL_DESCRIPTIONS[TASKS_TOOL_GET_TASK],
    },
    {
      groupName: TASKS_TOOL_GROUP_NAME,
      name: TASKS_TOOL_GET_TASK_MESSAGE,
      description: TASKS_TOOL_DESCRIPTIONS[TASKS_TOOL_GET_TASK_MESSAGE],
    },
    {
      groupName: TASKS_TOOL_GROUP_NAME,
      name: TASKS_TOOL_CREATE_TASK,
      description: TASKS_TOOL_DESCRIPTIONS[TASKS_TOOL_CREATE_TASK],
    },
    {
      groupName: TASKS_TOOL_GROUP_NAME,
      name: TASKS_TOOL_DELETE_TASK,
      description: TASKS_TOOL_DESCRIPTIONS[TASKS_TOOL_DELETE_TASK],
    },
    {
      groupName: TASKS_TOOL_GROUP_NAME,
      name: TASKS_TOOL_SEARCH_TASK,
      description: TASKS_TOOL_DESCRIPTIONS[TASKS_TOOL_SEARCH_TASK],
    },
  ],
  [MEMORY_TOOL_GROUP_NAME]: [
    {
      groupName: MEMORY_TOOL_GROUP_NAME,
      name: MEMORY_TOOL_STORE,
      description: MEMORY_TOOL_DESCRIPTIONS[MEMORY_TOOL_STORE],
    },
    {
      groupName: MEMORY_TOOL_GROUP_NAME,
      name: MEMORY_TOOL_RETRIEVE,
      description: MEMORY_TOOL_DESCRIPTIONS[MEMORY_TOOL_RETRIEVE],
    },
    {
      groupName: MEMORY_TOOL_GROUP_NAME,
      name: MEMORY_TOOL_LIST,
      description: MEMORY_TOOL_DESCRIPTIONS[MEMORY_TOOL_LIST],
    },
    {
      groupName: MEMORY_TOOL_GROUP_NAME,
      name: MEMORY_TOOL_UPDATE,
      description: MEMORY_TOOL_DESCRIPTIONS[MEMORY_TOOL_UPDATE],
    },
    {
      groupName: MEMORY_TOOL_GROUP_NAME,
      name: MEMORY_TOOL_DELETE,
      description: MEMORY_TOOL_DESCRIPTIONS[MEMORY_TOOL_DELETE],
    },
  ],
  [SKILLS_TOOL_GROUP_NAME]: [
    {
      groupName: SKILLS_TOOL_GROUP_NAME,
      name: 'activate_skill',
      description: 'Execute a skill. Description is generated dynamically at runtime based on discovered skills.',
    },
  ],
};

// Helper functions for accordion summaries
const getRunSettingsSummary = (profile: AgentProfile) => {
  const settings: React.ReactNode[] = [];

  // Always show max iterations
  settings.push(
    <div key="iterations" className="flex items-center gap-1">
      <MdRepeat className="w-3 h-3 text-text-secondary" />
      <span>{profile.maxIterations}</span>
    </div>,
  );

  // Only show temperature if it's overridden
  if (profile.temperature !== undefined) {
    settings.push(
      <div key="temperature" className="flex items-center gap-1">
        <MdThermostat className="w-3 h-3 text-text-secondary" />
        <span>{profile.temperature}</span>
      </div>,
    );
  }

  // Only show max tokens if it's overridden
  if (profile.maxTokens !== undefined) {
    settings.push(
      <div key="tokens" className="flex items-center gap-1">
        <FaArrowRightFromBracket className="w-2.5 h-2.5 -rotate-90 text-text-secondary" />
        <span>{profile.maxTokens}</span>
      </div>,
    );
  }

  return (
    <div className="flex items-center gap-2">
      {settings.map((setting, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span className="text-text-muted">|</span>}
          {setting}
        </React.Fragment>
      ))}
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
    <span className="text-xs text-text-muted-light">None</span>
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
  if (profile.useTaskTools) {
    enabled.push(<FaList key="tasks" className="w-3 h-3 text-text-secondary" />);
  }
  if (profile.useMemoryTools) {
    enabled.push(<FaBrain key="memory" className="w-3 h-3 text-text-secondary" />);
  }
  if (profile.useSkillsTools) {
    enabled.push(<MdPsychology key="skills" className="w-3.5 h-3.5 text-text-secondary" />);
  }
  return enabled.length > 0 ? (
    <div className="flex items-center gap-2">
      {enabled.map((icon, index) => (
        <React.Fragment key={index}>{icon}</React.Fragment>
      ))}
    </div>
  ) : (
    <span className="text-xs text-text-muted-light">None</span>
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

  // Profile context state for project-level profiles
  const contexts = useMemo(() => ['global', ...openProjects.map((p) => p.baseDir)], [openProjects]);
  const [contextIndex, setContextIndex] = useState(0);
  const [profileContext, setProfileContext] = useState<'global' | string>(selectedProfileContext || 'global');

  const api = useApi();
  const { models, providers } = useModelProviders();

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

  // Handle initial profile ID - set context and select profile
  useEffect(() => {
    if (initialProfileId && agentProfiles.length > 0) {
      const initialProfile = agentProfiles.find((p) => p.id === initialProfileId);
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
    // only listen to initialProfileId change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProfileId]);

  const [mcpServersExpanded, setMcpServersExpanded] = useState(false);
  const profileNameInputRef = useRef<HTMLInputElement>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
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

  const getSubagentSummary = (profile: AgentProfile) => {
    if (!profile.subagent.enabled) {
      return t('settings.agent.subagent.statusDisabled');
    }
    const statusText =
      profile.subagent.invocationMode === InvocationMode.Automatic ? t('settings.agent.subagent.statusAutomatic') : t('settings.agent.subagent.statusOnDemand');

    return (
      <div className="flex items-center gap-2">
        <span>{statusText}</span>
        <div className="w-3 h-3 rounded border border-border-default" style={{ backgroundColor: profile.subagent.color }} />
      </div>
    );
  };

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

  const handleRemovePreferredModel = (modelId: string) => {
    const updatedSettings = {
      ...settings,
      preferredModels: settings.preferredModels.filter((preferred) => preferred !== modelId),
    };
    setSettings(updatedSettings);
  };

  const handleAddPreferredModel = (modelId: string) => {
    const updatedSettings = {
      ...settings,
      preferredModels: [...new Set([modelId, ...settings.preferredModels])],
    };
    setSettings(updatedSettings);
  };

  const handleModelChange = (model: Model) => {
    if (!selectedProfile) {
      return;
    }

    const selectedModelId = getProviderModelId(model);
    const providerId = model.providerId;
    const modelId = model.id;

    // Validate provider
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) {
      showErrorNotification(
        t('modelSelector.providerNotSupported', {
          provider: providerId,
          providers: AVAILABLE_PROVIDERS.join(', '),
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

  const renderSectionAccordion = (title: ReactNode, children: ReactNode, open?: boolean, setOpen?: (open: boolean) => void, summary?: ReactNode) => (
    <Accordion
      title={
        <div className="flex-1 text-left text-sm font-medium px-2 flex items-center justify-between">
          <div>{title}</div>
          {summary && <div className="text-xs text-text-muted-light ml-2">{summary}</div>}
        </div>
      }
      chevronPosition="right"
      className="mb-2 border rounded-md border-border-default-dark"
      isOpen={open}
      onOpenChange={setOpen}
      scrollToVisibleWhenExpanded={true}
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
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-bg-tertiary">
          <div className="max-w-3xl mx-auto">
            {selectedProfile ? (
              <div className="space-y-4">
                <Input
                  ref={profileNameInputRef}
                  label={t('agentProfiles.profileName')}
                  value={selectedProfile.name}
                  onChange={(e) => handleProfileSettingChange('name', e.target.value)}
                  className="mb-1"
                />
                {selectedProfile && (
                  <div className="!mb-4">
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
                )}

                {renderSectionAccordion(
                  t('settings.agent.runSettings'),
                  <div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                      <Slider
                        label={
                          <div className="flex items-center text-xs">
                            <span>{t('settings.agent.maxIterations')}</span>
                            <InfoIcon tooltip={t('settings.agent.computationalResources')} className="ml-1" />
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
                            <span>{t('settings.agent.minTimeBetweenToolCalls')}</span>
                            <InfoIcon tooltip={t('settings.agent.rateLimiting')} className="ml-1" />
                          </div>
                        }
                        type="number"
                        min={0}
                        max={60000}
                        step={100}
                        value={selectedProfile.minTimeBetweenToolCalls.toString()}
                        onChange={(e) => handleProfileSettingChange('minTimeBetweenToolCalls', Number(e.target.value))}
                      />

                      {/* Temperature Column */}
                      {selectedProfile.temperature === undefined ? (
                        <div className="space-y-2">
                          <div className="flex items-center text-xs">
                            <span>{t('settings.agent.temperature')}</span>
                            <InfoIcon tooltip={t('settings.agent.temperatureTooltip')} className="ml-1" />
                            <div className="flex items-center justify-end w-full">
                              <Button variant="text" size="xs" onClick={() => handleProfileSettingChange('temperature', DEFAULT_MODEL_TEMPERATURE)}>
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
                              value={selectedProfile.temperature}
                              className="flex-1"
                              onChange={(value) => handleProfileSettingChange('temperature', value)}
                            />
                            <IconButton
                              icon={<FaTimes className="w-3 h-3" />}
                              onClick={() => handleProfileSettingChange('temperature', undefined)}
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
                          {selectedProfile.maxTokens === undefined && (
                            <div className="flex items-center justify-end w-full">
                              <Button variant="text" size="xs" onClick={() => handleProfileSettingChange('maxTokens', 32000)} className="justify-center">
                                {t('settings.agent.override')}
                              </Button>
                            </div>
                          )}
                        </div>
                        {selectedProfile.maxTokens !== undefined && (
                          <div className="flex items-center gap-2 w-full">
                            <div className="flex-1">
                              <Input
                                type="number"
                                min={0}
                                max={60000}
                                step={100}
                                value={selectedProfile.maxTokens.toString()}
                                onChange={(e) => handleProfileSettingChange('maxTokens', Number(e.target.value))}
                              />
                            </div>
                            <IconButton
                              icon={<FaTimes className="w-3 h-3" />}
                              onClick={() => handleProfileSettingChange('maxTokens', undefined)}
                              tooltip={t('settings.agent.clearOverride')}
                              className="p-1 hover:bg-bg-tertiary-emphasis hover:text-text-error rounded-sm"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>,
                  undefined,
                  undefined,
                  <span className="text-xs text-text-muted-light">{getRunSettingsSummary(selectedProfile)}</span>,
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
                  <span className="text-xs text-text-muted-light">{getContextSummary(selectedProfile)}</span>,
                )}

                {renderSectionAccordion(
                  t('settings.agent.genericTools'),
                  <div>
                    <div className="space-y-1">
                      {Object.entries(tools).map(([groupName, tools]) => {
                        const isGroupEnabled =
                          (selectedProfile.usePowerTools && groupName === POWER_TOOL_GROUP_NAME) ||
                          (selectedProfile.useAiderTools && groupName === AIDER_TOOL_GROUP_NAME) ||
                          (selectedProfile.useTodoTools && groupName === TODO_TOOL_GROUP_NAME) ||
                          (selectedProfile.useTaskTools && groupName === TASKS_TOOL_GROUP_NAME) ||
                          (selectedProfile.useMemoryTools && groupName === MEMORY_TOOL_GROUP_NAME) ||
                          (selectedProfile.useSkillsTools && groupName === SKILLS_TOOL_GROUP_NAME);
                        return (
                          <div key={groupName}>
                            <GenericToolGroupItem
                              name={groupName}
                              tools={tools}
                              profile={selectedProfile}
                              onApprovalChange={handleToolApprovalChange}
                              onProfileChange={handleProfileSettingChange}
                              enabled={isGroupEnabled}
                              onEnabledChange={(enabled) => {
                                if (groupName === POWER_TOOL_GROUP_NAME) {
                                  handleProfileSettingChange('usePowerTools', enabled);
                                } else if (groupName === AIDER_TOOL_GROUP_NAME) {
                                  handleProfileSettingChange('useAiderTools', enabled);
                                } else if (groupName === TODO_TOOL_GROUP_NAME) {
                                  handleProfileSettingChange('useTodoTools', enabled);
                                } else if (groupName === TASKS_TOOL_GROUP_NAME) {
                                  handleProfileSettingChange('useTaskTools', enabled);
                                } else if (groupName === MEMORY_TOOL_GROUP_NAME) {
                                  handleProfileSettingChange('useMemoryTools', enabled);
                                } else if (groupName === SKILLS_TOOL_GROUP_NAME) {
                                  handleProfileSettingChange('useSkillsTools', enabled);
                                }
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                    {Object.keys(tools).length === 0 && (
                      <div className="text-xs text-text-muted-light my-4 text-center">{t('settings.agent.noGenericToolsConfigured')}</div>
                    )}
                  </div>,
                  undefined,
                  undefined,
                  <span className="text-xs text-text-muted-light">{getGenericToolsSummary(selectedProfile)}</span>,
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
                      <div className="text-xs text-text-muted-light my-4 text-center">{t('settings.agent.noServersConfigured')}</div>
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
                  <span className="text-xs text-text-muted-light">{getMcpServersSummary(selectedProfile, mcpServers)}</span>,
                )}

                {renderSectionAccordion(
                  t('settings.agent.subagent.title'),
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Checkbox
                        label={
                          <div className="flex items-center">
                            <span>{t('settings.agent.subagent.canUseSubagents')}</span>
                            <InfoIcon className="ml-2" tooltip={t('settings.agent.subagent.canUseSubagentsInformation')} />
                          </div>
                        }
                        checked={selectedProfile.useSubagents}
                        onChange={(checked) => handleProfileSettingChange('useSubagents', checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Checkbox
                        label={
                          <div className="flex items-center">
                            <span>{t('settings.agent.subagent.enableAsSubagent')}</span>
                            <InfoIcon className="ml-2" tooltip={t('settings.agent.subagent.enableAsSubagentInformation')} />
                          </div>
                        }
                        checked={selectedProfile.subagent.enabled}
                        onChange={(checked) => handleProfileSettingChange('subagent', { ...selectedProfile.subagent, enabled: checked })}
                      />
                      {selectedProfile.subagent.enabled && (
                        <div
                          className="w-6 h-6 rounded border border-border-default cursor-pointer"
                          style={{ backgroundColor: selectedProfile.subagent.color }}
                          onClick={() => setShowColorPicker(!showColorPicker)}
                        />
                      )}
                    </div>

                    {selectedProfile.subagent.enabled && (
                      <div className="flex items-center justify-between mt-2">
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
                          value={selectedProfile.subagent.contextMemory}
                          onChange={(value) =>
                            handleProfileSettingChange('subagent', { ...selectedProfile.subagent, contextMemory: value as ContextMemoryMode })
                          }
                          size="sm"
                        />
                      </div>
                    )}

                    {selectedProfile.subagent.enabled && (
                      <div className="mt-4 space-y-1">
                        <TextArea
                          label={<label className="text-xs font-medium text-text-primary">{t('settings.agent.subagent.systemPrompt')}</label>}
                          className="min-h-[160px]"
                          value={selectedProfile.subagent.systemPrompt}
                          onChange={(e) => handleProfileSettingChange('subagent', { ...selectedProfile.subagent, systemPrompt: e.target.value })}
                          placeholder={t('settings.agent.subagent.systemPromptPlaceholder')}
                        />

                        <div className="flex items-center gap-4 mb-1">
                          <Select
                            label={<label className="text-xs font-medium text-text-primary">{t('settings.agent.subagent.invocationMode')}</label>}
                            options={[
                              { label: t('settings.agent.subagent.invocationModeOnDemand'), value: InvocationMode.OnDemand },
                              { label: t('settings.agent.subagent.invocationModeAutomatic'), value: InvocationMode.Automatic },
                            ]}
                            value={selectedProfile.subagent.invocationMode}
                            onChange={(value) =>
                              handleProfileSettingChange('subagent', { ...selectedProfile.subagent, invocationMode: value as InvocationMode })
                            }
                            size="sm"
                          />
                        </div>

                        {selectedProfile.subagent.invocationMode === InvocationMode.Automatic && (
                          <TextArea
                            label={<label className="text-xs font-medium text-text-primary">{t('settings.agent.subagent.description')}</label>}
                            className="min-h-[100px]"
                            value={selectedProfile.subagent.description}
                            onChange={(e) => handleProfileSettingChange('subagent', { ...selectedProfile.subagent, description: e.target.value })}
                            placeholder={t('settings.agent.subagent.descriptionPlaceholder')}
                          />
                        )}
                        <div className="text-2xs text-text-muted-light mt-3">
                          {selectedProfile.subagent.invocationMode === InvocationMode.Automatic
                            ? !selectedProfile.subagent.description.trim()
                              ? t('settings.agent.subagent.descriptionRequiredForAutomatic')
                              : t('settings.agent.subagent.invocationModeAutomaticInformation')
                            : t('settings.agent.subagent.invocationModeOnDemandInformation')}
                        </div>
                      </div>
                    )}
                  </div>,
                  undefined,
                  undefined,
                  <span className="text-xs text-text-muted-light">{getSubagentSummary(selectedProfile)}</span>,
                )}

                {showColorPicker && selectedProfile.subagent.enabled && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setShowColorPicker(false)}>
                    <div className="relative bg-bg-secondary border border-border-default rounded-lg shadow-lg p-4">
                      <Sketch
                        color={selectedProfile.subagent.color}
                        onChange={(color) => {
                          handleProfileSettingChange('subagent', {
                            ...selectedProfile.subagent,
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

                <div className="mt-4 pt-2 flex justify-end items-center gap-2">
                  {isDefaultProfile(selectedProfileId) && (
                    <Button onClick={handleResetProfile} variant="text" size="sm" color="secondary" disabled={!selectedProfileId}>
                      <FaSyncAlt className="w-4 h-4" />
                      <span>{t('settings.agent.resetProfileToDefaults')}</span>
                    </Button>
                  )}
                  <Button
                    onClick={() => handleDeleteProfile(selectedProfileId)}
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
              <div className="flex items-center justify-center h-full text-xs">
                <p className="text-text-muted">{t('settings.agent.selectOrCreateProfile')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

import { AgentProfile, ExtensionToolInfo, GenericTool, McpServerConfig, ToolApprovalState } from '@common/types';
import { useTranslation } from 'react-i18next';
import { FaPencilAlt, FaPlus, FaSyncAlt } from 'react-icons/fa';
import { clsx } from 'clsx';
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

import { McpServer } from '../McpServerForm';
import { McpServerItem } from '../McpServerItem';
import { GenericToolGroupItem } from '../GenericToolGroupItem';

import { Button } from '@/components/common/Button';

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

type Props = {
  profile: AgentProfile;
  mcpServers: Record<string, McpServerConfig>;
  extensionToolsInfo: ExtensionToolInfo[];
  mcpServersReloadTrigger: number;
  onSettingChange: <K extends keyof AgentProfile>(field: K, value: AgentProfile[K]) => void;
  onApprovalChange: (toolId: string, approval: ToolApprovalState) => void;
  onToggleServerEnabled: (serverKey: string, checked: boolean) => void;
  onMcpServerRemove: (serverName: string) => void;
  onMcpServerEdit: (server: McpServer) => void;
  onAddMcpServer: () => void;
  onEditMcpServersConfig: () => void;
  onReloadMcpServers: () => void;
};

export const ProfileToolsSection = ({
  profile,
  mcpServers,
  extensionToolsInfo,
  mcpServersReloadTrigger,
  onSettingChange,
  onApprovalChange,
  onToggleServerEnabled,
  onMcpServerRemove,
  onMcpServerEdit,
  onAddMcpServer,
  onEditMcpServersConfig,
  onReloadMcpServers,
}: Props) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm font-medium text-text-primary mb-3">{t('settings.agent.genericTools')}</div>
        <div className="space-y-1">
          {Object.entries(tools).map(([groupName, groupTools]) => {
            const isGroupEnabled =
              (profile.usePowerTools && groupName === POWER_TOOL_GROUP_NAME) ||
              (profile.useAiderTools && groupName === AIDER_TOOL_GROUP_NAME) ||
              (profile.useTodoTools && groupName === TODO_TOOL_GROUP_NAME) ||
              (profile.useTaskTools && groupName === TASKS_TOOL_GROUP_NAME) ||
              (profile.useMemoryTools && groupName === MEMORY_TOOL_GROUP_NAME) ||
              (profile.useSkillsTools && groupName === SKILLS_TOOL_GROUP_NAME);
            return (
              <div key={groupName}>
                <GenericToolGroupItem
                  name={groupName}
                  tools={groupTools}
                  profile={profile}
                  onApprovalChange={onApprovalChange}
                  onProfileChange={onSettingChange}
                  enabled={isGroupEnabled}
                  onEnabledChange={(enabled) => {
                    if (groupName === POWER_TOOL_GROUP_NAME) {
                      onSettingChange('usePowerTools', enabled);
                    } else if (groupName === AIDER_TOOL_GROUP_NAME) {
                      onSettingChange('useAiderTools', enabled);
                    } else if (groupName === TODO_TOOL_GROUP_NAME) {
                      onSettingChange('useTodoTools', enabled);
                    } else if (groupName === TASKS_TOOL_GROUP_NAME) {
                      onSettingChange('useTaskTools', enabled);
                    } else if (groupName === MEMORY_TOOL_GROUP_NAME) {
                      onSettingChange('useMemoryTools', enabled);
                    } else if (groupName === SKILLS_TOOL_GROUP_NAME) {
                      onSettingChange('useSkillsTools', enabled);
                    }
                  }}
                />
              </div>
            );
          })}
          {extensionToolsInfo.map((extInfo) => {
            const extTools: GenericTool[] = extInfo.tools.map((tool) => ({
              groupName: extInfo.extensionId,
              name: tool.name,
              description: tool.description,
            }));
            const isExtEnabled = !(profile.disabledExtensionTools ?? []).includes(extInfo.extensionId);
            const handleExtEnabledChange = (enabled: boolean) => {
              const disabled = profile.disabledExtensionTools ?? [];
              const updated = enabled ? disabled.filter((id) => id !== extInfo.extensionId) : [...disabled, extInfo.extensionId];
              onSettingChange('disabledExtensionTools', updated);
            };
            return (
              <div key={extInfo.extensionId}>
                <GenericToolGroupItem
                  name={extInfo.extensionId}
                  displayName={extInfo.extensionName}
                  tools={extTools}
                  profile={profile}
                  onApprovalChange={onApprovalChange}
                  onProfileChange={onSettingChange}
                  enabled={isExtEnabled}
                  onEnabledChange={handleExtEnabledChange}
                />
              </div>
            );
          })}
        </div>
        {Object.keys(tools).length === 0 && extensionToolsInfo.length === 0 && (
          <div className="text-xs text-text-muted-light my-4 text-center">{t('settings.agent.noGenericToolsConfigured')}</div>
        )}
      </div>

      <div className="border-t border-border-default-dark pt-4">
        <div className="text-sm font-medium text-text-primary mb-3">{t('settings.agent.mcpServers')}</div>
        <div className="space-y-1">
          {Object.entries(mcpServers).map(([serverName, serverConfig]) => {
            const isServerEnabled = (profile.enabledServers || []).includes(serverName);
            return (
              <div key={serverName}>
                <McpServerItem
                  serverName={serverName}
                  config={serverConfig}
                  toolApprovals={profile.toolApprovals || {}}
                  onApprovalChange={onApprovalChange}
                  enabled={isServerEnabled}
                  onEnabledChange={(checked) => onToggleServerEnabled(serverName, checked)}
                  onRemove={() => onMcpServerRemove(serverName)}
                  onEdit={() =>
                    onMcpServerEdit({
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
              <Button variant="text" className="ml-2 text-xs" onClick={onEditMcpServersConfig}>
                <FaPencilAlt className="mr-1.5 w-2.5 h-2.5" /> {t('settings.agent.editConfig')}
              </Button>
              <Button variant="text" className="ml-2 text-xs" onClick={onReloadMcpServers}>
                <FaSyncAlt className="mr-1.5 w-2.5 h-2.5" /> {t('settings.agent.reloadServers')}
              </Button>
            </>
          )}
          <Button onClick={onAddMcpServer} variant="text" className="ml-2 text-xs">
            <FaPlus className="mr-1.5 w-2.5 h-2.5" /> {t('settings.agent.addMcpServer')}
          </Button>
        </div>
      </div>
    </div>
  );
};

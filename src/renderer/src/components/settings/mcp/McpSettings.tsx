import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useState } from 'react';
import { McpServerConfig, McpServersData, McpTool, ProjectData } from '@common/types';
import { extractIpcErrorMessage } from '@common/utils';
import { useTranslation } from 'react-i18next';
import { FaChevronLeft, FaChevronRight, FaPencilAlt, FaPlus, FaSyncAlt } from 'react-icons/fa';

import { McpServer, McpServerForm } from './McpServerForm';
import { McpServerSidebarItem } from './McpServerSidebarItem';
import { McpServerToolsPanel } from './McpServerToolsPanel';

import { useMcpServers } from '@/contexts/McpServersContext';
import { useApi } from '@/contexts/ApiContext';
import { getPathBasename } from '@/utils/path-utils';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';

type ServerToolsState = {
  tools: McpTool[] | null;
  loading: boolean;
  error: string | null;
};

type Props = {
  mcpServers?: McpServersData;
  setMcpServers?: Dispatch<SetStateAction<McpServersData>>;
  openProjects?: ProjectData[];
  selectedMcpContext?: string;
};

export const McpSettings = ({ mcpServers, setMcpServers, openProjects = [], selectedMcpContext }: Props) => {
  const { t } = useTranslation();
  const api = useApi();
  const { getScopedServers, addServer, updateServer, removeServer, replaceServers } = useMcpServers();

  const [isAddingServer, setIsAddingServer] = useState(false);
  const [editingServer, setEditingServer] = useState<McpServer | null>(null);
  const [isEditingServersConfig, setIsEditingServersConfig] = useState(false);
  const [selectedServerName, setSelectedServerName] = useState<string | null>(null);
  const [toolsReloadTrigger, setToolsReloadTrigger] = useState(0);
  const [serversTools, setServersTools] = useState<Record<string, ServerToolsState>>({});

  const contexts = useMemo(() => ['global', ...openProjects.map((p) => p.baseDir)], [openProjects]);
  const [contextIndex, setContextIndex] = useState(0);
  const [mcpContext, setMcpContext] = useState<string>(selectedMcpContext || 'global');

  useEffect(() => {
    if (selectedMcpContext !== undefined) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMcpContext(selectedMcpContext);
      const newIndex = contexts.indexOf(selectedMcpContext);
      if (newIndex !== -1) {
        setContextIndex(newIndex);
      }
    }
  }, [selectedMcpContext, contexts]);

  const navigateContext = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'prev' ? (contextIndex - 1 + contexts.length) % contexts.length : (contextIndex + 1) % contexts.length;
    setContextIndex(newIndex);
    setMcpContext(contexts[newIndex]);
    setServersTools({});
  };

  const getContextDisplayName = () => {
    if (mcpContext === 'global') {
      return 'Global';
    }
    const project = openProjects.find((p) => p.baseDir === mcpContext);
    return project ? getPathBasename(project.baseDir) : mcpContext;
  };

  const projectDir = mcpContext !== 'global' ? mcpContext : undefined;
  const servers = useMemo(() => {
    if (mcpServers) {
      return projectDir ? mcpServers.projectServers[projectDir] || {} : mcpServers.global;
    }
    return getScopedServers(projectDir);
  }, [mcpServers, projectDir, getScopedServers]);
  const serverEntries = Object.entries(servers);

  // Fall back to the first server when the selection is invalid or missing
  const selectedServer =
    selectedServerName && servers[selectedServerName]
      ? { name: selectedServerName, config: servers[selectedServerName] }
      : serverEntries.length > 0
        ? { name: serverEntries[0][0], config: serverEntries[0][1] }
        : null;
  const activeServerName = selectedServer?.name ?? null;

  // Load tools for all servers in the current context to reflect their status
  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      Object.entries(servers).map(async ([name, config]) => {
        try {
          const loadedTools = await api.loadMcpServerTools(name, config, projectDir);
          if (!cancelled) {
            setServersTools((prev) => ({ ...prev, [name]: { tools: loadedTools, loading: false, error: null } }));
          }
        } catch (loadError) {
          if (!cancelled) {
            const errorMessage = extractIpcErrorMessage(loadError);
            setServersTools((prev) => ({ ...prev, [name]: { tools: null, loading: false, error: errorMessage } }));
          }
        }
      }),
    );
    return () => {
      cancelled = true;
    };
  }, [api, projectDir, servers, toolsReloadTrigger]);

  const handleAddServer = useCallback(
    (name: string, config: McpServerConfig) => {
      if (setMcpServers) {
        setMcpServers((prev) =>
          projectDir
            ? { ...prev, projectServers: { ...prev.projectServers, [projectDir]: { ...(prev.projectServers[projectDir] || {}), [name]: config } } }
            : { ...prev, global: { ...prev.global, [name]: config } },
        );
      } else {
        void addServer(name, config, projectDir);
      }
    },
    [setMcpServers, projectDir, addServer],
  );

  const handleUpdateServer = useCallback(
    (oldName: string, name: string, config: McpServerConfig) => {
      if (setMcpServers) {
        setMcpServers((prev) => {
          if (projectDir) {
            const scoped = { ...(prev.projectServers[projectDir] || {}) };
            delete scoped[oldName];
            scoped[name] = config;
            return { ...prev, projectServers: { ...prev.projectServers, [projectDir]: scoped } };
          }
          const global = { ...prev.global };
          delete global[oldName];
          global[name] = config;
          return { ...prev, global };
        });
      } else {
        void updateServer(oldName, name, config, projectDir);
      }
    },
    [setMcpServers, projectDir, updateServer],
  );

  const handleRemoveServer = useCallback(
    (name: string) => {
      if (setMcpServers) {
        setMcpServers((prev) => {
          if (projectDir) {
            const scoped = { ...(prev.projectServers[projectDir] || {}) };
            delete scoped[name];
            return { ...prev, projectServers: { ...prev.projectServers, [projectDir]: scoped } };
          }
          const global = { ...prev.global };
          delete global[name];
          return { ...prev, global };
        });
      } else {
        void removeServer(name, projectDir);
      }
    },
    [setMcpServers, projectDir, removeServer],
  );

  const handleReplaceServers = useCallback(
    (replacement: Record<string, McpServerConfig>) => {
      if (setMcpServers) {
        setMcpServers((prev) =>
          projectDir ? { ...prev, projectServers: { ...prev.projectServers, [projectDir]: replacement } } : { ...prev, global: replacement },
        );
      } else {
        void replaceServers(replacement, projectDir);
      }
    },
    [setMcpServers, projectDir, replaceServers],
  );

  const handleReloadServer = useCallback(
    (name: string) => {
      const config = servers[name];
      if (!config) {
        return;
      }
      setServersTools((prev) => ({ ...prev, [name]: { tools: null, loading: true, error: null } }));
      void api
        .reloadMcpServer(name, config)
        .then((loadedTools) => {
          setServersTools((prev) => ({ ...prev, [name]: { tools: loadedTools, loading: false, error: null } }));
        })
        .catch((reloadError) => {
          const errorMessage = extractIpcErrorMessage(reloadError);
          setServersTools((prev) => ({ ...prev, [name]: { tools: null, loading: false, error: errorMessage } }));
        });
    },
    [api, servers],
  );

  const handleReload = () => {
    void api.reloadMcpServers(projectDir, true);
    setServersTools(Object.fromEntries(serverEntries.map(([name]) => [name, { tools: null, loading: true, error: null }])));
    setToolsReloadTrigger((prev) => prev + 1);
  };

  const handleRemove = (name: string) => {
    handleRemoveServer(name);
  };

  const handleSave = (savedServers: Record<string, McpServerConfig>) => {
    if (isAddingServer) {
      Object.entries(savedServers).forEach(([name, config]) => handleAddServer(name, config));
    } else if (editingServer) {
      const oldName = editingServer.name;
      const newNames = Object.keys(savedServers);
      if (newNames.length === 1) {
        handleUpdateServer(oldName, newNames[0], savedServers[newNames[0]]);
      } else {
        handleRemoveServer(oldName);
        Object.entries(savedServers).forEach(([name, config]) => handleAddServer(name, config));
      }
    } else if (isEditingServersConfig) {
      handleReplaceServers(savedServers);
    }

    setIsAddingServer(false);
    setEditingServer(null);
    setIsEditingServersConfig(false);
  };

  const handleCancel = () => {
    setIsAddingServer(false);
    setEditingServer(null);
    setIsEditingServersConfig(false);
  };

  if (isAddingServer || editingServer || isEditingServersConfig) {
    return (
      <McpServerForm
        onSave={handleSave}
        onCancel={handleCancel}
        servers={isEditingServersConfig ? Object.entries(servers).map(([name, config]) => ({ name, config })) : editingServer ? [editingServer] : undefined}
      />
    );
  }

  const selectedServerData = selectedServer ? serversTools[selectedServer.name] : undefined;

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Left List Pane */}
      <div className="w-[260px] flex-shrink-0 border-r border-border-default flex flex-col">
        {/* Context switcher */}
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

        {/* Server list */}
        <div className="flex-1 overflow-y-auto p-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-bg-tertiary">
          {serverEntries.length === 0 ? (
            <div className="h-full px-8 text-center flex items-center justify-center py-8 text-text-muted-light text-xs">
              {t('settings.agent.noServersConfigured')}
            </div>
          ) : (
            serverEntries.map(([serverName]) => (
              <McpServerSidebarItem
                key={serverName}
                serverName={serverName}
                isSelected={activeServerName === serverName}
                error={serversTools[serverName]?.error ?? null}
                onClick={setSelectedServerName}
                onRefresh={handleReloadServer}
                onEdit={(name) => setEditingServer({ name, config: servers[name] })}
                onRemove={handleRemove}
              />
            ))
          )}
        </div>

        {/* Sidebar actions */}
        <div className="p-2 border-t border-border-default flex items-center justify-center gap-1">
          <Button onClick={() => setIsAddingServer(true)} variant="text" size="sm" color="primary" className="text-xs">
            <FaPlus className="mr-1.5 w-3 h-3" /> {t('settings.agent.addMcpServer')}
          </Button>
          {serverEntries.length > 0 && (
            <IconButton
              icon={<FaPencilAlt className="w-3.5 h-3.5 text-button-primary" />}
              onClick={() => setIsEditingServersConfig(true)}
              tooltip={t('settings.agent.editConfig')}
              className="p-2 rounded hover:bg-button-primary-subtle"
            />
          )}
          {serverEntries.length > 0 && (
            <IconButton
              icon={<FaSyncAlt className="w-3.5 h-3.5" />}
              onClick={handleReload}
              tooltip={t('settings.agent.reloadServers')}
              className="p-2 rounded hover:bg-bg-tertiary"
            />
          )}
        </div>
      </div>

      {/* Right Details Pane */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {selectedServer ? (
          <McpServerToolsPanel
            key={selectedServer.name}
            serverName={selectedServer.name}
            config={selectedServer.config}
            tools={selectedServerData?.tools ?? null}
            loading={selectedServerData?.loading ?? true}
            error={selectedServerData?.error ?? null}
            onReload={() => handleReloadServer(selectedServer.name)}
            onEdit={() => setEditingServer({ name: selectedServer.name, config: selectedServer.config })}
            onRemove={() => handleRemove(selectedServer.name)}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-xs">
            <p className="text-text-muted">{t('mcp.selectServer')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

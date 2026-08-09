import { createContext, useContext, useEffect, useMemo, useCallback, useState, ReactNode } from 'react';
import { McpServerConfig } from '@common/types';

import { useApi } from '@/contexts/ApiContext';

export interface McpServersContextType {
  globalServers: Record<string, McpServerConfig>;
  projectServers: Record<string, Record<string, McpServerConfig>>;
  loading: boolean;
  error: string | null;
  getScopedServers: (projectDir?: string) => Record<string, McpServerConfig>;
  getMergedServers: (projectDir?: string) => Record<string, McpServerConfig>;
  refreshServers: () => Promise<void>;
  addServer: (name: string, config: McpServerConfig, projectDir?: string) => Promise<void>;
  updateServer: (oldName: string, name: string, config: McpServerConfig, projectDir?: string) => Promise<void>;
  removeServer: (name: string, projectDir?: string) => Promise<void>;
  replaceServers: (servers: Record<string, McpServerConfig>, projectDir?: string) => Promise<void>;
  reloadServers: (projectDir?: string, force?: boolean) => Promise<void>;
}

const McpServersContext = createContext<McpServersContextType | undefined>(undefined);

interface McpServersProviderProps {
  children: ReactNode;
}

export const McpServersProvider = ({ children }: McpServersProviderProps) => {
  const [globalServers, setGlobalServers] = useState<Record<string, McpServerConfig>>({});
  const [projectServers, setProjectServers] = useState<Record<string, Record<string, McpServerConfig>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const api = useApi();

  const refreshServers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.getMcpServers();
      setGlobalServers(result.global);
      setProjectServers(result.projectServers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load MCP servers');
    } finally {
      setLoading(false);
    }
  }, [api]);

  const getScopedServers = useCallback(
    (projectDir?: string) => {
      return projectDir ? projectServers[projectDir] || {} : globalServers;
    },
    [globalServers, projectServers],
  );

  const getMergedServers = useCallback(
    (projectDir?: string) => {
      if (!projectDir) {
        return globalServers;
      }
      return {
        ...globalServers,
        ...(projectServers[projectDir] || {}),
      };
    },
    [globalServers, projectServers],
  );

  const addServer = useCallback(
    async (name: string, config: McpServerConfig, projectDir?: string) => {
      try {
        const result = await api.addMcpServer(name, config, projectDir);
        setGlobalServers(result.global);
        setProjectServers(result.projectServers);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add MCP server');
        throw err;
      }
    },
    [api],
  );

  const updateServer = useCallback(
    async (oldName: string, name: string, config: McpServerConfig, projectDir?: string) => {
      try {
        const result = await api.updateMcpServer(oldName, name, config, projectDir);
        setGlobalServers(result.global);
        setProjectServers(result.projectServers);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update MCP server');
        throw err;
      }
    },
    [api],
  );

  const removeServer = useCallback(
    async (name: string, projectDir?: string) => {
      try {
        const result = await api.removeMcpServer(name, projectDir);
        setGlobalServers(result.global);
        setProjectServers(result.projectServers);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to remove MCP server');
        throw err;
      }
    },
    [api],
  );

  const replaceServers = useCallback(
    async (servers: Record<string, McpServerConfig>, projectDir?: string) => {
      try {
        const result = await api.replaceMcpServers(servers, projectDir);
        setGlobalServers(result.global);
        setProjectServers(result.projectServers);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save MCP servers');
        throw err;
      }
    },
    [api],
  );

  const reloadServers = useCallback(
    async (projectDir?: string, force = true) => {
      await api.reloadMcpServers(projectDir, force);
    },
    [api],
  );

  useEffect(() => {
    void refreshServers();

    const unsubscribe = api.addMcpServersUpdatedListener((data) => {
      setGlobalServers(data.global);
      setProjectServers(data.projectServers);
    });

    return () => {
      unsubscribe();
    };
  }, [api, refreshServers]);

  const value = useMemo<McpServersContextType>(
    () => ({
      globalServers,
      projectServers,
      loading,
      error,
      getScopedServers,
      getMergedServers,
      refreshServers,
      addServer,
      updateServer,
      removeServer,
      replaceServers,
      reloadServers,
    }),
    [
      globalServers,
      projectServers,
      loading,
      error,
      getScopedServers,
      getMergedServers,
      refreshServers,
      addServer,
      updateServer,
      removeServer,
      replaceServers,
      reloadServers,
    ],
  );

  return <McpServersContext.Provider value={value}>{children}</McpServersContext.Provider>;
};

export const useMcpServers = (): McpServersContextType => {
  const context = useContext(McpServersContext);
  if (context === undefined) {
    throw new Error('useMcpServers must be used within a McpServersProvider');
  }
  return context;
};

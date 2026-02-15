import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ZaiPlanProvider } from '@aider-desk/common/agent';
import { SettingsData, McpServerConfig } from '@aider-desk/common/types';
import { FaCheck, FaPlus, FaInfoCircle, FaExternalLinkAlt } from 'react-icons/fa';

import { ZaiPlanThinkingSetting } from './ZaiPlanThinkingSetting';

import { useSettings } from '@/contexts/SettingsContext';
import { Button } from '@/components/common/Button';
import { Tooltip } from '@/components/ui/Tooltip';

type Props = {
  provider: ZaiPlanProvider;
  onChange: (updated: ZaiPlanProvider) => void;
};

type McpServerInfo = {
  key: string;
  name: string;
  description: string;
  config: McpServerConfig;
  documentationLink: string;
};

export const ZaiPlanAdvancedSettings = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();
  const { settings, saveSettings } = useSettings();
  const [existingMcpServers, setExistingMcpServers] = useState<Record<string, McpServerConfig>>({});
  const [addingServers, setAddingServers] = useState<Record<string, boolean>>({});

  const { apiKey } = provider;

  useEffect(() => {
    setExistingMcpServers(settings?.mcpServers || {});
  }, [settings]);

  const mcpServers: McpServerInfo[] = [
    {
      key: 'zai-mcp-server',
      name: t('zaiPlan.mcp.vision.name'),
      description: t('zaiPlan.mcp.vision.description'),
      documentationLink: 'https://docs.z.ai/devpack/mcp/vision-mcp-server',
      config: {
        command: 'npx',
        args: ['-y', '@z_ai/mcp-server'],
        env: {
          Z_AI_API_KEY: apiKey,
          Z_AI_MODE: 'ZAI',
        },
      },
    },
    {
      key: 'zread',
      name: t('zaiPlan.mcp.zread.name'),
      description: t('zaiPlan.mcp.zread.description'),
      documentationLink: 'https://docs.z.ai/devpack/mcp/zread-mcp-server',
      config: {
        url: 'https://api.z.ai/api/mcp/zread/mcp',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    },
    {
      key: 'web-reader',
      name: t('zaiPlan.mcp.webReader.name'),
      description: t('zaiPlan.mcp.webReader.description'),
      documentationLink: 'https://docs.z.ai/devpack/mcp/reader-mcp-server',
      config: {
        url: 'https://api.z.ai/api/mcp/web_reader/mcp',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    },
    {
      key: 'web-search-prime',
      name: t('zaiPlan.mcp.webSearch.name'),
      description: t('zaiPlan.mcp.webSearch.description'),
      documentationLink: 'https://docs.z.ai/devpack/mcp/search-mcp-server',
      config: {
        url: 'https://api.z.ai/api/mcp/web_search_prime/mcp',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    },
  ];

  const isServerConfigured = (serverKey: string): boolean => {
    return serverKey in existingMcpServers;
  };

  const handleAddServer = async (serverInfo: McpServerInfo) => {
    if (!apiKey) {
      return;
    }

    setAddingServers((prev) => ({ ...prev, [serverInfo.key]: true }));

    try {
      const updatedMcpServers = {
        ...(settings?.mcpServers || {}),
        [serverInfo.key]: serverInfo.config,
      };

      const updatedSettings = { ...settings, mcpServers: updatedMcpServers } as SettingsData;
      await saveSettings(updatedSettings);
      setExistingMcpServers(updatedMcpServers);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to add MCP server:', error);
    } finally {
      setAddingServers((prev) => ({ ...prev, [serverInfo.key]: false }));
    }
  };

  return (
    <div className="space-y-4">
      <div className="py-2">
        <ZaiPlanThinkingSetting provider={provider} onChange={onChange} />
      </div>
      <div className="border border-border-default-dark rounded-md p-4">
        <div className="flex items-center space-x-2 mb-3">
          <span className="text-sm font-medium">{t('zaiPlan.mcp.title')}</span>
          <Tooltip content={t('zaiPlan.mcp.infoTooltip')}>
            <FaInfoCircle className="h-4 w-4 text-text-secondary" />
          </Tooltip>
        </div>

        {mcpServers.map((server) => {
          const isConfigured = isServerConfigured(server.key);
          const isAdding = addingServers[server.key];
          const canAdd = apiKey && !isConfigured;

          return (
            <div key={server.key} className="mb-3 last:mb-0">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-medium">{server.name}</div>
                    <a
                      href={server.documentationLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-text-secondary hover:text-info-light"
                      aria-label={`${server.name} documentation`}
                    >
                      <FaExternalLinkAlt className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="text-2xs text-text-secondary mt-1">{server.description}</div>
                </div>
                {isConfigured ? (
                  <div className="flex items-center text-2xs text-success mt-1 ml-2">
                    <FaCheck className="mr-1" />
                    {t('zaiPlan.mcp.configured')}
                  </div>
                ) : (
                  <Button onClick={() => handleAddServer(server)} disabled={!canAdd || isAdding} variant="text" color="primary" size="sm" className="mt-1 ml-2">
                    {isAdding ? (
                      t('zaiPlan.mcp.adding')
                    ) : (
                      <>
                        <FaPlus className="mr-1" />
                        {t('zaiPlan.mcp.add')}
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

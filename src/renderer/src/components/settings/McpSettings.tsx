import { getActiveProvider, McpAgent, McpServerConfig, SettingsData } from '@common/types';
import { useState } from 'react';
import { FaPlus } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import {
  LlmProvider,
  PROVIDER_MODELS,
  AVAILABLE_PROVIDERS,
  isBedrockProvider,
  isOpenAiProvider,
  isAnthropicProvider,
  isGeminiProvider,
} from '@common/llm-providers';

import { McpServerForm } from './McpServerForm';
import { McpServerItem } from './McpServerItem';
import { OpenAiParameters, AnthropicParameters, GeminiParameters, BedrockParameters } from './providers';

import { Select } from '@/components/common/Select';
import { Button } from '@/components/common/Button';
import { Slider } from '@/components/common/Slider';
import { InfoIcon } from '@/components/common/InfoIcon';
import { TextArea } from '@/components/common/TextArea';
import { Accordion } from '@/components/common/Accordion';
import { Input } from '@/components/common/Input';

type Props = {
  settings: SettingsData;
  setSettings: (settings: SettingsData) => void;
};

type EditingServer = {
  name: string;
  config: McpServerConfig;
};

export const McpSettings = ({ settings, setSettings }: Props) => {
  const { t } = useTranslation();
  const { mcpAgent } = settings;
  const [isAddingServer, setIsAddingServer] = useState(false);
  const [editingServer, setEditingServer] = useState<EditingServer | null>(null);
  const activeProvider = getActiveProvider(mcpAgent.providers);

  const handleProviderChanged = (newProviderName: string) => {
    let updatedProviders = settings.mcpAgent.providers;

    // Check if provider already exists
    const existingProvider = updatedProviders.find((p) => p.name === newProviderName);

    if (!existingProvider) {
      // Create new provider with default values based on provider type
      let newProvider: LlmProvider;

      if (newProviderName === 'bedrock') {
        newProvider = {
          name: 'bedrock',
          accessKeyId: '',
          secretAccessKey: '',
          region: 'us-east-1',
          model: Object.keys(PROVIDER_MODELS[newProviderName].models)[0],
          active: true,
        };
      } else {
        newProvider = {
          name: newProviderName as 'openai' | 'anthropic' | 'gemini',
          apiKey: '',
          model: Object.keys(PROVIDER_MODELS[newProviderName].models)[0],
          active: true,
        };
      }

      updatedProviders = [...updatedProviders, newProvider];
    }

    // Update active state for all providers
    updatedProviders = updatedProviders.map((provider) => ({
      ...provider,
      active: provider.name === newProviderName,
    }));

    const updatedMcpConfig = {
      ...settings.mcpAgent,
      providers: updatedProviders,
    };
    setSettings({ ...settings, mcpAgent: updatedMcpConfig });
  };

  const handleMaxIterationsChanged = (newMaxIterations: number) => {
    const updatedMcpConfig: McpAgent = {
      ...settings.mcpAgent,
      maxIterations: newMaxIterations,
    };
    setSettings({ ...settings, mcpAgent: updatedMcpConfig });
  };

  const handleDelayBetweenIterationsChanged = (newDelay: number) => {
    const updatedMcpConfig: McpAgent = {
      ...settings.mcpAgent,
      minTimeBetweenToolCalls: newDelay,
    };
    setSettings({ ...settings, mcpAgent: updatedMcpConfig });
  };

  const handleMaxTokenChanged = (newMaxTokens: number) => {
    const updatedMcpConfig: McpAgent = {
      ...settings.mcpAgent,
      maxTokens: newMaxTokens,
    };
    setSettings({ ...settings, mcpAgent: updatedMcpConfig });
  };

  const handleSystemPromptChanged = (newSystemPrompt: string) => {
    const updatedMcpConfig = {
      ...settings.mcpAgent,
      systemPrompt: newSystemPrompt,
    };
    setSettings({ ...settings, mcpAgent: updatedMcpConfig });
  };

  const handleServerConfigSave = (newServerName: string, newServerConfig: McpServerConfig) => {
    const updatedMcpServers = {
      ...settings.mcpAgent.mcpServers,
      [newServerName]: newServerConfig,
    };
    const updatedMcpConfig: McpAgent = {
      ...settings.mcpAgent,
      mcpServers: updatedMcpServers,
    };
    setSettings({ ...settings, mcpAgent: updatedMcpConfig });
    setIsAddingServer(false);
    setEditingServer(null);
  };

  const handleServerConfigRemove = (serverName: string) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [serverName]: removedServer, ...remainingServers } = settings.mcpAgent.mcpServers;
    const updatedMcpConfig = {
      ...settings.mcpAgent,
      mcpServers: remainingServers,
    };
    setSettings({ ...settings, mcpAgent: updatedMcpConfig });
  };

  return (
    <div>
      {isAddingServer || editingServer ? (
        <McpServerForm
          onSave={handleServerConfigSave}
          onCancel={() => {
            setIsAddingServer(false);
            setEditingServer(null);
          }}
          initialName={editingServer?.name}
          initialConfig={editingServer?.config}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div>
                <Select label={t('settings.mcp.provider')} value={activeProvider?.name || ''} onChange={handleProviderChanged} options={AVAILABLE_PROVIDERS} />
              </div>

              {activeProvider && isOpenAiProvider(activeProvider) && <OpenAiParameters settings={settings} setSettings={setSettings} />}

              {activeProvider && isAnthropicProvider(activeProvider) && <AnthropicParameters settings={settings} setSettings={setSettings} />}

              {activeProvider && isGeminiProvider(activeProvider) && <GeminiParameters settings={settings} setSettings={setSettings} />}

              {activeProvider && isBedrockProvider(activeProvider) && <BedrockParameters settings={settings} setSettings={setSettings} />}
            </div>
            <div>
              <div>
                <Slider
                  label={
                    <div className="flex items-center">
                      <span>{t('settings.mcp.maxIterations')}</span>
                      <InfoIcon className="ml-1" tooltip={t('settings.mcp.computationalResources')} />
                    </div>
                  }
                  min={1}
                  max={100}
                  value={mcpAgent.maxIterations}
                  onChange={handleMaxIterationsChanged}
                />
              </div>
              <div className="mt-4">
                <Input
                  label={
                    <div className="flex items-center">
                      <span>{t('settings.mcp.minTimeBetweenToolCalls')}</span>
                      <InfoIcon
                        className="ml-1"
                        tooltip={t('settings.mcp.rateLimiting')}
                      />
                    </div>
                  }
                  type="number"
                  min={0}
                  max={10000}
                  step={100}
                  value={mcpAgent.minTimeBetweenToolCalls.toString()}
                  onChange={(e) => handleDelayBetweenIterationsChanged(Number(e.target.value))}
                />
              </div>
              <div className="mt-2">
                <Input
                  label={
                    <div className="flex items-center">
                      <span>{t('settings.mcp.maxTokens')}</span>
                      <InfoIcon className="ml-1" tooltip={t('settings.mcp.tokensPerResponse')} />
                    </div>
                  }
                  type="number"
                  min={1}
                  value={mcpAgent.maxTokens.toString()}
                  onChange={(e) => handleMaxTokenChanged(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          <div className="mt-4">
            <Accordion title={t('settings.mcp.systemPrompt')} className="text-sm">
              <div className="text-xxs text-amber-500 mb-2">
                {t('settings.mcp.systemPromptWarning')}
              </div>
              <TextArea value={mcpAgent.systemPrompt} onChange={(e) => handleSystemPromptChanged(e.target.value)} rows={20} className="w-full resize-none" />
            </Accordion>
          </div>
          <div className="mt-4">
            <div className="text-sm text-neutral-100 font-medium mb-2 mt-4">{t('settings.mcpServers')}</div>
            {Object.keys(mcpAgent.mcpServers).length === 0 ? (
              <div className="text-xs text-gray-500 mb-2">{t('settings.mcp.noServersConfigured')}</div>
            ) : (
              Object.entries(mcpAgent.mcpServers).map(([serverName, config]) => (
                <McpServerItem
                  key={serverName}
                  serverName={serverName}
                  config={config}
                  onRemove={() => handleServerConfigRemove(serverName)}
                  onEdit={() => setEditingServer({ name: serverName, config })}
                />
              ))
            )}
            <div className="flex justify-center">
              <Button onClick={() => setIsAddingServer(true)} variant="text" className="mt-3 flex items-center">
                <FaPlus className="mr-2" /> {t('settings.addServer')}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

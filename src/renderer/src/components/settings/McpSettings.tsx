import { AgentConfig, McpServerConfig, SettingsData } from '@common/types';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaPlus } from 'react-icons/fa';
import {
  LlmProvider,
  PROVIDER_MODELS,
  AVAILABLE_PROVIDERS,
  isBedrockProvider,
  isOpenAiProvider,
  isAnthropicProvider,
  isGeminiProvider,
  isDeepseekProvider,
  isOpenAiCompatibleProvider,
  getActiveProvider,
} from '@common/llm-providers';

import { McpServerForm } from './McpServerForm';
import { McpServerItem } from './McpServerItem';
import { OpenAiParameters, AnthropicParameters, GeminiParameters, BedrockParameters, DeepseekParameters, OpenAiCompatibleParameters } from './providers';

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
  const handleToggleTool = (toolId: string) => {
    const disabledTools = settings.agentConfig.disabledTools;
    const updatedDisabledTools = disabledTools.includes(toolId) ? disabledTools.filter((id) => id !== toolId) : [...disabledTools, toolId];

    setSettings({
      ...settings,
      agentConfig: {
        ...settings.agentConfig,
        disabledTools: updatedDisabledTools,
      },
    });
  };
  const { agentConfig } = settings;
  const [isAddingServer, setIsAddingServer] = useState(false);
  const [editingServer, setEditingServer] = useState<EditingServer | null>(null);
  const activeProvider = getActiveProvider(agentConfig.providers);

  const handleProviderChanged = (newProviderName: string) => {
    let updatedProviders = settings.agentConfig.providers;

    // Check if provider already exists
    const existingProvider = updatedProviders.find((provider) => provider.name === newProviderName);

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
          name: newProviderName,
          apiKey: '',
          model: Object.keys(PROVIDER_MODELS[newProviderName]?.models || {})?.[0] || '',
          active: true,
        } as LlmProvider;
      }

      updatedProviders = [...updatedProviders, newProvider];
    }

    // Update active state for all providers
    updatedProviders = updatedProviders.map((provider) => ({
      ...provider,
      active: provider.name === newProviderName,
    }));

    const updatedMcpConfig = {
      ...settings.agentConfig,
      providers: updatedProviders,
    };
    setSettings({ ...settings, agentConfig: updatedMcpConfig });
  };

  const handleMaxIterationsChanged = (newMaxIterations: number) => {
    const updatedMcpConfig: AgentConfig = {
      ...settings.agentConfig,
      maxIterations: newMaxIterations,
    };
    setSettings({ ...settings, agentConfig: updatedMcpConfig });
  };

  const handleDelayBetweenIterationsChanged = (newDelay: number) => {
    const updatedMcpConfig: AgentConfig = {
      ...settings.agentConfig,
      minTimeBetweenToolCalls: newDelay,
    };
    setSettings({ ...settings, agentConfig: updatedMcpConfig });
  };

  const handleMaxTokenChanged = (newMaxTokens: number) => {
    const updatedMcpConfig: AgentConfig = {
      ...settings.agentConfig,
      maxTokens: newMaxTokens,
    };
    setSettings({ ...settings, agentConfig: updatedMcpConfig });
  };

  const handleSystemPromptChanged = (newSystemPrompt: string) => {
    const updatedMcpConfig = {
      ...settings.agentConfig,
      systemPrompt: newSystemPrompt,
    };
    setSettings({ ...settings, agentConfig: updatedMcpConfig });
  };

  const handleServerConfigSave = (newServerName: string, newServerConfig: McpServerConfig) => {
    const updatedMcpServers = {
      ...settings.agentConfig.mcpServers,
      [newServerName]: newServerConfig,
    };
    const updatedMcpConfig: AgentConfig = {
      ...settings.agentConfig,
      mcpServers: updatedMcpServers,
    };
    setSettings({ ...settings, agentConfig: updatedMcpConfig });
    setIsAddingServer(false);
    setEditingServer(null);
  };

  const handleServerConfigRemove = (serverName: string) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [serverName]: removedServer, ...remainingServers } = settings.agentConfig.mcpServers;
    const updatedMcpConfig = {
      ...settings.agentConfig,
      mcpServers: remainingServers,
    };
    setSettings({ ...settings, agentConfig: updatedMcpConfig });
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
              {activeProvider && isDeepseekProvider(activeProvider) && <DeepseekParameters settings={settings} setSettings={setSettings} />}
              {activeProvider && isBedrockProvider(activeProvider) && <BedrockParameters settings={settings} setSettings={setSettings} />}
              {activeProvider && isOpenAiCompatibleProvider(activeProvider) && <OpenAiCompatibleParameters settings={settings} setSettings={setSettings} />}
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
                  max={200}
                  value={agentConfig.maxIterations}
                  onChange={handleMaxIterationsChanged}
                />
              </div>
              <div className="mt-4">
                <Input
                  label={
                    <div className="flex items-center">
                      <span>{t('settings.mcp.minTimeBetweenToolCalls')}</span>
                      <InfoIcon className="ml-1" tooltip={t('settings.mcp.rateLimiting')} />
                    </div>
                  }
                  type="number"
                  min={0}
                  max={10000}
                  step={100}
                  value={agentConfig.minTimeBetweenToolCalls.toString()}
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
                  value={agentConfig.maxTokens.toString()}
                  onChange={(e) => handleMaxTokenChanged(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          <div className="mt-4">
            <Accordion title={t('settings.mcp.systemPrompt')} className="text-sm">
              <div className="text-xxs text-amber-500 mb-2">{t('settings.mcp.systemPromptWarning')}</div>
              <TextArea value={agentConfig.systemPrompt} onChange={(e) => handleSystemPromptChanged(e.target.value)} rows={20} className="w-full resize-none" />
            </Accordion>
          </div>
          <div className="mt-4">
            <div className="text-sm text-neutral-100 font-medium mb-2 mt-4">{t('settings.mcp.mcpServers')}</div>
            {Object.keys(agentConfig.mcpServers).length === 0 ? (
              <div className="text-xs text-gray-500 mb-2">{t('settings.mcp.noServersConfigured')}</div>
            ) : (
              Object.entries(agentConfig.mcpServers).map(([serverName, config]) => (
                <McpServerItem
                  key={serverName}
                  serverName={serverName}
                  config={config}
                  onRemove={() => handleServerConfigRemove(serverName)}
                  onEdit={() => setEditingServer({ name: serverName, config })}
                  toggleToolDisabled={handleToggleTool}
                  disabledTools={agentConfig.disabledTools}
                />
              ))
            )}
            <div className="flex justify-center">
              <Button onClick={() => setIsAddingServer(true)} variant="text" className="mt-3 flex items-center text-sm">
                <FaPlus className="mr-2 w-2 h-2" /> {t('settings.mcp.addServer')}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
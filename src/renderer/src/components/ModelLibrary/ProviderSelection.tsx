import { LlmProviderName, AVAILABLE_PROVIDERS } from '@common/agent';
import { useTranslation } from 'react-i18next';
import { ComponentType } from 'react';
import { FiArrowLeft } from 'react-icons/fi';

import { ProviderCard } from './ProviderCard';

import { IconButton } from '@/components/common/IconButton';
import {
  AnthropicIcon,
  AnthropicCompatibleIcon,
  AzureIcon,
  BedrockIcon,
  CerebrasIcon,
  ClaudeAgentSdkIcon,
  DeepseekIcon,
  GeminiCliIcon,
  GeminiIcon,
  GpustackIcon,
  GroqIcon,
  LitellmIcon,
  LmStudioIcon,
  MinimaxIcon,
  OllamaIcon,
  OpenAiCompatibleIcon,
  OpenAiIcon,
  OpenCodeIcon,
  OpenRouterIcon,
  RequestyIcon,
  SyntheticIcon,
  VertexAiIcon,
  ZaiPlanIcon,
  KimiPlanIcon,
} from '@/icons';

const PROVIDER_ICON_MAP: Record<LlmProviderName, ComponentType<{ width?: number; height?: number; className?: string }>> = {
  anthropic: AnthropicIcon,
  'anthropic-compatible': AnthropicCompatibleIcon,
  azure: AzureIcon,
  bedrock: BedrockIcon,
  cerebras: CerebrasIcon,
  'claude-agent-sdk': ClaudeAgentSdkIcon,
  deepseek: DeepseekIcon,
  'gemini-cli': GeminiCliIcon,
  gemini: GeminiIcon,
  gpustack: GpustackIcon,
  groq: GroqIcon,
  'kimi-plan': KimiPlanIcon,
  litellm: LitellmIcon,
  lmstudio: LmStudioIcon,
  minimax: MinimaxIcon,
  ollama: OllamaIcon,
  openai: OpenAiIcon,
  'openai-compatible': OpenAiCompatibleIcon,
  opencode: OpenCodeIcon,
  openrouter: OpenRouterIcon,
  requesty: RequestyIcon,
  synthetic: SyntheticIcon,
  'vertex-ai': VertexAiIcon,
  'zai-plan': ZaiPlanIcon,
};

type Props = {
  onSelectProvider: (provider: LlmProviderName) => void;
  onCancel?: () => void;
  showTitle?: boolean;
};

export const ProviderSelection = ({ onSelectProvider, onCancel, showTitle = true }: Props) => {
  const { t } = useTranslation();

  return (
    <div className="p-2 overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-tertiary">
      {showTitle && (
        <div className="relative flex items-center justify-center mb-6 max-w-4xl mx-auto">
          {onCancel && <IconButton icon={<FiArrowLeft size={24} />} onClick={onCancel} tooltip={t('common.back')} className="absolute left-0" />}
          <h2 className="text-md font-bold">{t('modelLibrary.selectProvider')}</h2>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
        {AVAILABLE_PROVIDERS.map((provider) => {
          const IconComponent = PROVIDER_ICON_MAP[provider];
          return (
            <ProviderCard
              key={provider}
              name={t(`providers.${provider}`)}
              icon={<IconComponent width={32} height={32} />}
              onClick={() => onSelectProvider(provider)}
            />
          );
        })}
      </div>
    </div>
  );
};

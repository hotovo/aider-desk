import {
  isAnthropicProvider,
  isBedrockProvider,
  isDeepseekProvider,
  isGeminiProvider,
  isGroqProvider,
  isLmStudioProvider,
  isOllamaProvider,
  isOpenAiCompatibleProvider,
  isOpenAiProvider,
  isOpenRouterProvider,
  isRequestyProvider,
  isVertexAiProvider,
  LlmProvider,
  LlmProviderName,
} from '@common/agent';
import { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { FaChevronDown, FaChevronRight } from 'react-icons/fa';
import clsx from 'clsx';

import {
  AnthropicParameters,
  BedrockParameters,
  DeepseekParameters,
  GeminiParameters,
  GroqParameters,
  LmStudioParameters,
  OllamaParameters,
  OpenAiCompatibleParameters,
  OpenAiParameters,
  OpenRouterParameters,
  RequestyParameters,
  VertexAIParameters,
} from './agent/providers';

type Props = {
  providerName: LlmProviderName;
  provider: LlmProvider;
  isConfigured: boolean;
  isExpanded: boolean;
  agentOnly?: boolean;
  onExpand: () => void;
  onProviderChange: (provider: LlmProvider) => void;
};

export const ProviderCard = ({ providerName, provider, isConfigured, isExpanded, agentOnly, onExpand, onProviderChange }: Props) => {
  const { t } = useTranslation();

  const handleCardClick = (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    onExpand();
  };

  const renderProviderParameters = () => {
    if (isOpenAiProvider(provider)) {
      return <OpenAiParameters provider={provider} onChange={onProviderChange} />;
    }
    if (isAnthropicProvider(provider)) {
      return <AnthropicParameters provider={provider} onChange={onProviderChange} />;
    }
    if (isGeminiProvider(provider)) {
      return <GeminiParameters provider={provider} onChange={onProviderChange} />;
    }
    if (isGroqProvider(provider)) {
      return <GroqParameters provider={provider} onChange={onProviderChange} />;
    }
    if (isLmStudioProvider(provider)) {
      return <LmStudioParameters provider={provider} onChange={onProviderChange} />;
    }
    if (isDeepseekProvider(provider)) {
      return <DeepseekParameters provider={provider} onChange={onProviderChange} />;
    }
    if (isBedrockProvider(provider)) {
      return <BedrockParameters provider={provider} onChange={onProviderChange} />;
    }
    if (isOpenAiCompatibleProvider(provider)) {
      return <OpenAiCompatibleParameters provider={provider} onChange={onProviderChange} />;
    }
    if (isOllamaProvider(provider)) {
      return <OllamaParameters provider={provider} onChange={onProviderChange} />;
    }
    if (isOpenRouterProvider(provider)) {
      return <OpenRouterParameters provider={provider} onChange={onProviderChange} />;
    }
    if (isRequestyProvider(provider)) {
      return <RequestyParameters provider={provider} onChange={onProviderChange} />;
    }
    if (isVertexAiProvider(provider)) {
      return <VertexAIParameters provider={provider} onChange={onProviderChange} />;
    }
    return null;
  };

  return (
    <div className="border border-neutral-700 rounded-md overflow-hidden">
      <div className="p-3 py-2 cursor-pointer hover:bg-neutral-800/50 transition-colors flex items-center justify-between" onClick={handleCardClick}>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            {isExpanded ? <FaChevronDown className="w-3 h-3 text-neutral-400" /> : <FaChevronRight className="w-3 h-3 text-neutral-400" />}
            <div className="font-medium text-sm uppercase text-white">{t(`providers.${providerName}`)}</div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {agentOnly && (
            <span className="px-2 py-1 text-xs rounded-full font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
              {t('settings.models.agentOnly')}
            </span>
          )}
          <span
            className={clsx(
              'px-2 py-1 text-xs rounded-full font-medium',
              isConfigured ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-neutral-600/20 text-neutral-400 border border-neutral-600/30',
            )}
          >
            {isConfigured ? t('settings.models.configured') : t('settings.models.notConfigured')}
          </span>
        </div>
      </div>

      {isExpanded && <div className="border-t border-neutral-700 p-4 bg-neutral-850/50">{renderProviderParameters()}</div>}
    </div>
  );
};

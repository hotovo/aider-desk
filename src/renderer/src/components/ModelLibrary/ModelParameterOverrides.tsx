import { useTranslation } from 'react-i18next';
import { LlmProvider, LlmProviderName } from '@common/agent';
import { ComponentType } from 'react';

import { OpenRouterModelOverrides } from './providers/OpenRouterModelOverrides';
import { GeminiModelOverrides } from './providers/GeminiModelOverrides';
import { VertexAiModelOverrides } from './providers/VertexAiModelOverrides';
import { OpenAiModelOverrides } from './providers/OpenAiModelOverrides';
import { OpenCodeModelOverrides } from './providers/OpenCodeModelOverrides';
import { RequestyModelOverrides } from './providers/RequestyModelOverrides';
import { AzureModelOverrides } from './providers/AzureModelOverrides';
import { OpenAiCompatibleModelOverrides } from './providers/OpenAiCompatibleModelOverrides';
import { DefaultModelOverrides } from './providers/DefaultModelOverrides';
import { ZaiPlanModelOverrides } from './providers/ZaiPlanModelOverrides';

import { Button } from '@/components/common/Button';
import { Accordion } from '@/components/common/Accordion';

type ProviderOverridesProps = {
  provider: LlmProvider;
  overrides: Record<string, unknown>;
  onChange: (overrides: Record<string, unknown>) => void;
};

const PROVIDER_OVERRIDES_MAP: Partial<Record<LlmProviderName, ComponentType<ProviderOverridesProps>>> = {
  openrouter: OpenRouterModelOverrides,
  gemini: GeminiModelOverrides,
  gpustack: DefaultModelOverrides,
  'vertex-ai': VertexAiModelOverrides,
  openai: OpenAiModelOverrides,
  opencode: OpenCodeModelOverrides,
  requesty: RequestyModelOverrides,
  azure: AzureModelOverrides,
  'openai-compatible': OpenAiCompatibleModelOverrides,
  // Providers without specific overrides use DefaultModelOverrides
  anthropic: DefaultModelOverrides,
  bedrock: DefaultModelOverrides,
  cerebras: DefaultModelOverrides,
  deepseek: DefaultModelOverrides,
  groq: DefaultModelOverrides,
  lmstudio: DefaultModelOverrides,
  minimax: DefaultModelOverrides,
  ollama: DefaultModelOverrides,
  synthetic: DefaultModelOverrides,
  'zai-plan': ZaiPlanModelOverrides,
};

type Props = {
  provider: LlmProvider;
  overrides: Record<string, unknown>;
  onChange: (overrides: Record<string, unknown>) => void;
  className?: string;
};

export const ModelParameterOverrides = ({ provider, overrides, onChange, className = '' }: Props) => {
  const { t } = useTranslation();

  const handleProviderOverrideChange = (providerOverrides: Record<string, unknown>) => {
    onChange(providerOverrides);
  };

  const handleResetToDefaults = () => {
    onChange({});
  };

  const hasOverrides = Object.keys(overrides).length > 0;
  const OverridesComponent = PROVIDER_OVERRIDES_MAP[provider.name];

  return (
    <div className={`space-y-2 ${className}`}>
      <Accordion
        title={
          <div className="flex flex-1 items-center space-x-4">
            <div className="text-sm font-medium text-text-primary">{t('modelLibrary.overrides.title')}</div>
            {hasOverrides && (
              <Button variant="text" size="xs" onClick={handleResetToDefaults}>
                {t('modelLibrary.overrides.resetToDefaults')}
              </Button>
            )}
          </div>
        }
        chevronPosition="right"
        className="border border-bg-tertiary rounded-lg"
      >
        <div className="space-y-3 p-3 pb-4">
          {OverridesComponent && <OverridesComponent provider={provider} overrides={overrides || {}} onChange={handleProviderOverrideChange} />}
        </div>
      </Accordion>
    </div>
  );
};

import { useTranslation } from 'react-i18next';
import { LlmProvider, LlmProviderName } from '@common/agent';
import { ComponentType } from 'react';

import { OpenRouterModelOverrides } from './providers/OpenRouterModelOverrides';
import { GeminiModelOverrides } from './providers/GeminiModelOverrides';
import { VertexAiModelOverrides } from './providers/VertexAiModelOverrides';
import { OpenAiModelOverrides } from './providers/OpenAiModelOverrides';
import { RequestyModelOverrides } from './providers/RequestyModelOverrides';

import { Button } from '@/components/common/Button';
import { Accordion } from '@/components/common/Accordion';

type ProviderOverridesProps = {
  overrides: Record<string, unknown>;
  onChange: (overrides: Record<string, unknown>) => void;
};

const PROVIDER_OVERRIDES_MAP: Partial<Record<LlmProviderName, ComponentType<ProviderOverridesProps>>> = {
  openrouter: OpenRouterModelOverrides,
  gemini: GeminiModelOverrides,
  'vertex-ai': VertexAiModelOverrides,
  openai: OpenAiModelOverrides,
  requesty: RequestyModelOverrides,
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

  if (!OverridesComponent) {
    return null;
  }

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
          {OverridesComponent && <OverridesComponent overrides={overrides || {}} onChange={handleProviderOverrideChange} />}
        </div>
      </Accordion>
    </div>
  );
};

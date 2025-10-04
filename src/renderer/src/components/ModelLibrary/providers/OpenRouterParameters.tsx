import { ChangeEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { OpenRouterProvider } from '@common/agent';

import { OpenRouterAdvancedSettings } from './OpenRouterAdvancedSettings';

import { Input } from '@/components/common/Input';
import { useEffectiveEnvironmentVariable } from '@/hooks/useEffectiveEnvironmentVariable';
import { Accordion } from '@/components/common/Accordion';

type Props = {
  provider: OpenRouterProvider;
  onChange: (updated: OpenRouterProvider) => void;
};

export const OpenRouterParameters = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const apiKey = provider.apiKey || '';

  const { environmentVariable: openRouterApiKeyEnv } = useEffectiveEnvironmentVariable('OPENROUTER_API_KEY');

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, apiKey: e.target.value });
  };

  const renderSectionAccordion = (title: ReactNode, children: ReactNode, open?: boolean, setOpen?: (open: boolean) => void) => (
    <Accordion
      title={<div className="flex-1 text-left text-sm font-medium px-2">{title}</div>}
      chevronPosition="right"
      className="mb-2 border rounded-md border-border-default-dark"
      isOpen={open}
      onOpenChange={setOpen}
    >
      <div className="p-4 pt-2">{children}</div>
    </Accordion>
  );

  return (
    <div className="space-y-4">
      <div className="!mt-0 !mb-5">
        <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-sm text-info-light hover:underline">
          Get OpenRouter API key
        </a>
      </div>
      <Input
        label={t('openRouter.apiKey')}
        type="password"
        value={apiKey}
        onChange={handleApiKeyChange}
        placeholder={
          openRouterApiKeyEnv
            ? t('settings.agent.envVarFoundPlaceholder', { source: openRouterApiKeyEnv.source })
            : t('settings.agent.envVarPlaceholder', { envVar: 'OPENROUTER_API_KEY' })
        }
      />
      {renderSectionAccordion(
        t('onboarding.providers.advancedSettings'),
        <div className="space-y-2">
          <OpenRouterAdvancedSettings provider={provider} onChange={onChange} />
        </div>,
      )}
    </div>
  );
};

import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { OllamaProvider } from '@aider-desk/common/agent';

import { Input } from '@/components/common/Input';
import { useEffectiveEnvironmentVariable } from '@/hooks/useEffectiveEnvironmentVariable';

type Props = {
  provider: OllamaProvider;
  onChange: (updated: OllamaProvider) => void;
};

export const OllamaParameters = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const baseUrl = provider.baseUrl || '';

  const { environmentVariable: ollamaApiBaseEnv } = useEffectiveEnvironmentVariable('OLLAMA_API_BASE');

  const handleBaseUrlChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, baseUrl: e.target.value });
  };

  return (
    <div className="space-y-2">
      <Input
        label={t('ollama.baseUrl')}
        type="text"
        value={baseUrl}
        onChange={handleBaseUrlChange}
        placeholder={ollamaApiBaseEnv ? t('settings.agent.envVarFoundPlaceholder', { source: ollamaApiBaseEnv.source }) : t('ollama.baseUrlPlaceholder')}
      />
    </div>
  );
};

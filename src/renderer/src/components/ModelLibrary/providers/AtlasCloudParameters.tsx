import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { AtlasCloudProvider } from '@common/agent';

import { Input } from '@/components/common/Input';
import { useEffectiveEnvironmentVariable } from '@/hooks/useEffectiveEnvironmentVariable';

type Props = {
  provider: AtlasCloudProvider;
  onChange: (updated: AtlasCloudProvider) => void;
};

export const AtlasCloudParameters = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const { apiKey } = provider;

  const { environmentVariable: atlasCloudKeyEnv } = useEffectiveEnvironmentVariable('ATLASCLOUD_API_KEY');

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, apiKey: e.target.value });
  };

  return (
    <div className="space-y-4">
      <div className="!mt-0 !mb-5">
        <a href="https://www.atlascloud.ai/" target="_blank" rel="noopener noreferrer" className="text-sm text-info-light hover:underline">
          {t('atlasCloud.getApiKeyLink')}
        </a>
      </div>
      <Input
        label={t('atlasCloud.apiKey')}
        type="password"
        value={apiKey}
        onChange={handleApiKeyChange}
        placeholder={
          atlasCloudKeyEnv
            ? t('settings.agent.envVarFoundPlaceholder', {
                source: atlasCloudKeyEnv.source,
              })
            : t('settings.agent.envVarPlaceholder', {
                envVar: 'ATLASCLOUD_API_KEY',
              })
        }
      />
    </div>
  );
};

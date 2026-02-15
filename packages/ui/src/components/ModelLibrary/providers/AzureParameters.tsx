import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { AzureProvider } from '@aider-desk/common/agent';

import { Input } from '@/components/common/Input';
import { useEffectiveEnvironmentVariable } from '@/hooks/useEffectiveEnvironmentVariable';

type Props = {
  provider: AzureProvider;
  onChange: (updated: AzureProvider) => void;
};

export const AzureParameters = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const apiKey = provider.apiKey || '';
  const resourceName = provider.resourceName || '';
  const apiVersion = provider.apiVersion || '';

  // Environment variable hooks for placeholders
  const { environmentVariable: azureApiKeyEnv } = useEffectiveEnvironmentVariable('AZURE_API_KEY');
  const { environmentVariable: azureResourceNameEnv } = useEffectiveEnvironmentVariable('AZURE_RESOURCE_NAME');
  const { environmentVariable: azureApiVersionEnv } = useEffectiveEnvironmentVariable('AZURE_API_VERSION');

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, apiKey: e.target.value });
  };

  const handleResourceNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, resourceName: e.target.value });
  };

  const handleApiVersionChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, apiVersion: e.target.value });
  };

  return (
    <div className="space-y-2">
      <Input
        label={t('azure.apiKey')}
        type="password"
        value={apiKey}
        onChange={handleApiKeyChange}
        placeholder={
          azureApiKeyEnv
            ? t('settings.agent.envVarFoundPlaceholder', {
                source: azureApiKeyEnv.source,
              })
            : t('settings.agent.envVarPlaceholder', {
                envVar: 'AZURE_API_KEY',
              })
        }
      />
      <div className="grid grid-cols-2 gap-x-4">
        <Input
          label={t('azure.resourceName')}
          type="text"
          value={resourceName}
          onChange={handleResourceNameChange}
          placeholder={
            azureResourceNameEnv
              ? t('settings.agent.envVarFoundPlaceholder', {
                  source: azureResourceNameEnv.source,
                })
              : t('settings.agent.envVarPlaceholder', {
                  envVar: 'AZURE_RESOURCE_NAME',
                })
          }
        />
        <Input
          label={t('azure.apiVersion')}
          type="text"
          value={apiVersion}
          onChange={handleApiVersionChange}
          placeholder={
            azureApiVersionEnv
              ? t('settings.agent.envVarFoundPlaceholder', {
                  source: azureApiVersionEnv.source,
                })
              : '2025-01-01-preview'
          }
        />
      </div>
      <div className="p-3 bg-info-subtle rounded-lg border border-info-light-emphasis !mt-4">
        <p className="text-xs text-info-lightest">{t('azure.addCustomModelInfo')}</p>
      </div>
    </div>
  );
};

import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { BedrockProvider } from '@aider-desk/common/agent';

import { Input } from '@/components/common/Input';
import { InfoIcon } from '@/components/common/InfoIcon';
import { useEffectiveEnvironmentVariable } from '@/hooks/useEffectiveEnvironmentVariable';

type Props = {
  provider: BedrockProvider;
  onChange: (updated: BedrockProvider) => void;
};

export const BedrockParameters = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const region = provider.region || '';
  const accessKeyId = provider.accessKeyId || '';
  const secretAccessKey = provider.secretAccessKey || '';
  const sessionToken = provider.sessionToken || '';

  const { environmentVariable: awsRegionEnv } = useEffectiveEnvironmentVariable('AWS_REGION');
  const { environmentVariable: awsAccessKeyIdEnv } = useEffectiveEnvironmentVariable('AWS_ACCESS_KEY_ID');
  const { environmentVariable: awsSecretAccessKeyEnv } = useEffectiveEnvironmentVariable('AWS_SECRET_ACCESS_KEY');
  const { environmentVariable: awsSessionTokenEnv } = useEffectiveEnvironmentVariable('AWS_SESSION_TOKEN');

  const handleRegionChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, region: e.target.value });
  };

  const handleAccessKeyIdChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, accessKeyId: e.target.value });
  };

  const handleSecretAccessKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, secretAccessKey: e.target.value });
  };

  const handleSessionTokenChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, sessionToken: e.target.value });
  };

  return (
    <div className="space-y-2">
      <Input
        label={t('bedrock.region')}
        value={region}
        onChange={handleRegionChange}
        placeholder={awsRegionEnv ? t('settings.agent.envVarFoundPlaceholder', { source: awsRegionEnv.source }) : t('bedrock.regionPlaceholder')}
      />
      <Input
        label={
          <div className="flex items-center">
            <span>{t('bedrock.accessKeyId')}</span>
            <InfoIcon className="ml-1" tooltip={t('bedrock.accessKeyIdTooltip')} />
          </div>
        }
        value={accessKeyId}
        onChange={handleAccessKeyIdChange}
        placeholder={
          awsAccessKeyIdEnv
            ? t('settings.agent.envVarFoundPlaceholder', { source: awsAccessKeyIdEnv.source })
            : t('settings.agent.envVarPlaceholder', { envVar: 'AWS_ACCESS_KEY_ID' })
        }
      />
      <Input
        label={
          <div className="flex items-center">
            <span>{t('bedrock.secretAccessKey')}</span>
            <InfoIcon className="ml-1" tooltip={t('bedrock.secretAccessKeyTooltip')} />
          </div>
        }
        type="password"
        value={secretAccessKey}
        onChange={handleSecretAccessKeyChange}
        placeholder={
          awsSecretAccessKeyEnv
            ? t('settings.agent.envVarFoundPlaceholder', { source: awsSecretAccessKeyEnv.source })
            : t('settings.agent.envVarPlaceholder', { envVar: 'AWS_SECRET_ACCESS_KEY' })
        }
      />
      <Input
        label={
          <div className="flex items-center">
            <span>{t('bedrock.sessionToken')}</span>
            <InfoIcon className="ml-1" tooltip={t('bedrock.sessionTokenTooltip')} />
          </div>
        }
        type="password"
        value={sessionToken}
        onChange={handleSessionTokenChange}
        placeholder={
          awsSessionTokenEnv
            ? t('settings.agent.envVarFoundPlaceholder', { source: awsSessionTokenEnv.source })
            : t('settings.agent.envVarPlaceholder', { envVar: 'AWS_SESSION_TOKEN' })
        }
      />
    </div>
  );
};

import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { LlmProviderBase } from '@common/agent';

import { Input } from '@/components/common/Input';
import { Checkbox } from '@/components/common/Checkbox';
import { Accordion } from '@/components/common/Accordion';
import { InfoIcon } from '@/components/common/InfoIcon';

type TlsCapableProvider = LlmProviderBase & { sslVerify?: boolean; caCertPath?: string };

type Props<T extends TlsCapableProvider> = {
  provider: T;
  onChange: (updated: T) => void;
};

export const TlsSettings = <T extends TlsCapableProvider>({ provider, onChange }: Props<T>) => {
  const { t } = useTranslation();

  const handleSslVerifyChange = (checked: boolean) => {
    onChange({ ...provider, sslVerify: !checked });
  };

  const handleCaCertPathChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, caCertPath: e.target.value });
  };

  return (
    <Accordion
      title={
        <div className="flex items-center text-sm font-medium gap-1">
          <span>{t('providerTls.title')}</span>
        </div>
      }
      className="border rounded-md border-border-default"
    >
      <div className="p-4 pt-2">
        <div className="space-y-2 flex flex-col">
          <div className="flex items-center space-x-2">
            <Checkbox
              label={t('providerTls.disableCertificateVerification')}
              checked={provider.sslVerify === false}
              onChange={handleSslVerifyChange}
              size="md"
            />
            <InfoIcon tooltip={t('providerTls.disableCertificateVerificationInfo')} />
          </div>
          <Input
            label={
              <div className="flex space-x-2">
                <span>{t('providerTls.caCertPath')}</span>
                <InfoIcon tooltip={t('providerTls.caCertPathInfo')} />
              </div>
            }
            type="text"
            value={provider.caCertPath || ''}
            onChange={handleCaCertPathChange}
            disabled={provider.sslVerify === false}
            placeholder={t('providerTls.caCertPathPlaceholder')}
          />
        </div>
      </div>
    </Accordion>
  );
};

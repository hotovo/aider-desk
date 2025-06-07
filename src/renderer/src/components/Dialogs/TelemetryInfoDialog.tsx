import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { BaseDialog } from '@/components/BaseDialog';
import { Button } from '@/components/common/Button';
import { Checkbox } from '@/components/common/Checkbox';
import { useSettings } from '@/context/SettingsContext';

export const TelemetryInfoDialog = () => {
  const { t } = useTranslation();
  const { settings, saveSettings } = useSettings();
  const [telemetryEnabled, setTelemetryEnabled] = useState(true);

  const handleOk = async () => {
    if (settings) {
      await saveSettings({
        ...settings,
        telemetryEnabled,
        telemetryInformed: true,
      });
    }
  };

  if (!settings || settings.telemetryInformed) {
    return null;
  }

  return (
    <BaseDialog
      title={t('telemetry.title')}
      width={500}
      footer={
        <Button onClick={handleOk} autoFocus>
          {t('common.ok')}
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-xs" style={{ color: 'var(--theme-foreground-secondary)' }}>{t('telemetry.message')}</p>
        <p className="text-xs" style={{ color: 'var(--theme-foreground-secondary)' }}>
          <Trans
            i18nKey="telemetry.fullInfo"
            components={{
              a: (
                <a
                  href="https://github.com/hotovo/aider-desk/blob/main/docs/TELEMETRY.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                  style={{ color: 'var(--theme-accent-primary)' }}
                />
              ),
            }}
          />{' '}
        </p>
        <Checkbox label={t('telemetry.enabledLabel')} checked={telemetryEnabled} onChange={setTelemetryEnabled} size="md" />
      </div>
    </BaseDialog>
  );
};

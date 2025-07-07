import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { SettingsData } from '@common/types';

import { Button } from '@/components/common/Button';
import { Checkbox } from '@/components/common/Checkbox';
import { Section } from '@/components/common/Section';
import { useVersions } from '@/hooks/useVersions';

type Props = {
  settings: SettingsData;
  setSettings: (settings: SettingsData) => void;
};

export const AboutSettings = ({ settings, setSettings }: Props) => {
  const { t } = useTranslation();
  const { versions, checkForUpdates } = useVersions();

  const isAiderDeskUpdateAvailable =
    !versions?.aiderDeskDownloadProgress && versions?.aiderDeskAvailableVersion && versions.aiderDeskAvailableVersion !== versions.aiderDeskCurrentVersion;
  const isAiderUpdateAvailable = versions?.aiderAvailableVersion && versions.aiderAvailableVersion !== versions.aiderCurrentVersion;
  const isDownloading = typeof versions?.aiderDeskDownloadProgress === 'number';

  const openLogsDirectory = async () => {
    try {
      const success = await window.api.openLogsDirectory();
      if (!success) {
        toast.error(t('settings.about.openLogsError'));
      }
    } catch (error) {
      toast.error(t('settings.about.openLogsError'));

      // eslint-disable-next-line no-console
      console.error('Failed to open logs directory:', error);
    }
  };

  const handleDownloadUpdate = async () => {
    try {
      await window.api.downloadLatestAiderDesk();
    } catch (error) {
      toast.error(t('settings.about.downloadError'));
      // eslint-disable-next-line no-console
      console.error('Failed to start download:', error);
    }
  };

  const handleTelemetryEnabledChange = (checked: boolean) => {
    setSettings({
      ...settings,
      telemetryEnabled: checked,
    });
  };

  return (
    <div className="space-y-6">
      <Section title="AiderDesk">
        <div className="p-6 space-y-2">
          <div className="flex  text-sm text-neutral-100 gap-2">
            <span>{t('settings.about.version')}:</span>
            <span>{versions ? (versions.aiderDeskCurrentVersion ?? t('settings.about.notAvailable')) : t('common.loading')}</span>
          </div>
          <div className="pt-2">
            <Checkbox
              label={t('settings.about.downloadAutomatically')}
              checked={settings.aiderDeskAutoUpdate}
              onChange={(checked) => setSettings({ ...settings, aiderDeskAutoUpdate: checked })}
            />
          </div>
          {isDownloading && (
            <div className="pt-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-amber-500 whitespace-nowrap">
                  {t('settings.about.downloadingUpdate')}: {versions?.aiderDeskDownloadProgress?.toFixed(0)}%
                </span>
              </div>
            </div>
          )}
          {versions?.aiderDeskNewVersionReady ? (
            <div className="pt-2">
              <p className="text-xs text-amber-500">{t('settings.about.newAiderDeskVersionReady')}</p>
            </div>
          ) : (
            isAiderDeskUpdateAvailable &&
            !isDownloading && (
              <div className="flex justify-between items-center pt-2">
                <span className="text-xs text-amber-500">
                  {t('settings.about.updateAvailable')} ({versions?.aiderDeskAvailableVersion})
                </span>
                <Button onClick={handleDownloadUpdate} size="sm" variant="outline">
                  {t('settings.about.downloadUpdate')}
                </Button>
              </div>
            )
          )}
        </div>
      </Section>

      <Section title="Aider">
        <div className="p-6 space-y-2">
          <div className="flex text-sm text-neutral-100 gap-2">
            <span>{t('settings.about.version')}:</span>
            <span>{versions ? (versions.aiderCurrentVersion ?? t('settings.about.notAvailable')) : t('common.loading')}</span>
          </div>
          {isAiderUpdateAvailable && (
            <div className="pt-2">
              <p className="text-xs text-amber-500">{t('settings.about.newAiderVersionAvailable', { version: versions.aiderAvailableVersion })}</p>
            </div>
          )}
        </div>
      </Section>
      <Section title={t('settings.telemetry.title')}>
        <div className="px-4 py-3 space-y-3 mt-2">
          <Checkbox label={t('telemetry.enabledLabel')} checked={settings.telemetryEnabled ?? false} onChange={handleTelemetryEnabledChange} />
        </div>
      </Section>
      <div className="flex flex-row justify-between items-center space-x-4">
        <Button onClick={openLogsDirectory} variant="text" size="sm" color="secondary">
          {t('settings.about.openLogsDirectory')}
        </Button>
        <Button onClick={checkForUpdates} disabled={!versions} variant="text" size="sm">
          {t('settings.about.checkForUpdates')}
        </Button>
      </div>
    </div>
  );
};

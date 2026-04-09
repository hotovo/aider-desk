import { useCallback, useEffect, useState } from 'react';
import StringToReactComponent from 'string-to-react-component';
import { useTranslation } from 'react-i18next';

import type { ExtensionConfigComponent } from '@common/types';

import { useApi } from '@/contexts/ApiContext';
import { useExtensions } from '@/contexts/ExtensionsContext';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { LoadingOverlay } from '@/components/common/LoadingOverlay';
import { showErrorNotification, showSuccessNotification } from '@/utils/notifications';

type Props = {
  extensionId: string;
  extensionName: string;
  projectDir?: string;
  onClose: () => void;
};

export const ExtensionSettingsDialog = ({ extensionId, extensionName, projectDir, onClose }: Props) => {
  const { t } = useTranslation();
  const api = useApi();
  const { componentProps: extensionProps } = useExtensions();

  const [componentDef, setComponentDef] = useState<ExtensionConfigComponent | null>(null);
  const [config, setConfig] = useState<unknown>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load component definition and initial config on mount
  useEffect(() => {
    let cancelled = false;

    const loadConfig = async () => {
      setIsLoading(true);
      try {
        const comp = await api.getExtensionConfigComponent(extensionId, projectDir);
        if (cancelled) {
          return;
        }

        if (!comp) {
          setIsLoading(false);
          showErrorNotification(t('settings.extensions.errors.settingsNotAvailable'));
          onClose();
          return;
        }

        setComponentDef(comp);

        const data = await api.getExtensionConfig(extensionId, projectDir);
        if (cancelled) {
          return;
        }
        setConfig(data ?? null);
      } catch {
        if (cancelled) {
          return;
        }
        showErrorNotification(t('settings.extensions.errors.loadSettings'));
        onClose();
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadConfig();
    return () => {
      cancelled = true;
    };
  }, [api, extensionId, projectDir, onClose, t]);

  const handleSave = useCallback(async () => {
    if (!componentDef) {
      return;
    }

    setIsSaving(true);
    try {
      await api.saveExtensionConfig(extensionId, config, projectDir);
      showSuccessNotification(t('settings.extensions.success.saveSettings', { name: extensionName }));
      onClose();
    } catch {
      showErrorNotification(t('settings.extensions.errors.saveSettings'));
    } finally {
      setIsSaving(false);
    }
  }, [api, extensionId, componentDef, config, projectDir, extensionName, onClose, t]);

  if (isLoading) {
    return (
      <ConfirmDialog
        title={t('settings.extensions.settingsDialog.title', { name: extensionName })}
        onCancel={onClose}
        onConfirm={() => {}}
        confirmButtonText=""
        cancelButtonText={t('common.cancel')}
        width={600}
        contentClass="p-0"
      >
        <div className="min-h-[240px] flex items-center justify-center">
          <LoadingOverlay message="" spinnerSize="sm" transparent />
        </div>
      </ConfirmDialog>
    );
  }

  if (!componentDef) {
    return null;
  }

  const componentProps = {
    ...extensionProps,
    config,
    updateConfig: setConfig,
  };

  return (
    <ConfirmDialog
      title={t('settings.extensions.settingsDialog.title', { name: extensionName })}
      onCancel={onClose}
      onConfirm={handleSave}
      confirmButtonText={t('common.save')}
      cancelButtonText={t('common.cancel')}
      disabled={isSaving}
      width={600}
      contentClass="p-0"
    >
      <div className="min-h-[240px] max-h-[70vh] overflow-y-auto p-6">
        <StringToReactComponent data={componentProps}>{componentDef.jsx}</StringToReactComponent>
      </div>
    </ConfirmDialog>
  );
};

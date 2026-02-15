import { MouseEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiCheck, FiDownload } from 'react-icons/fi';
import { CgSpinner } from 'react-icons/cg';

import { BmadWelcomeSection } from './BmadWelcomeSection';

import { useApi } from '@/contexts/ApiContext';
import { showErrorNotification, showSuccessNotification } from '@/utils/notifications';
import { Button } from '@/components/common/Button';
import { CopyMessageButton } from '@/components/message/CopyMessageButton';

type Props = {
  refreshState: () => void;
  projectDir: string;
};

export const BmadInstallPrompt = ({ refreshState, projectDir }: Props) => {
  const { t } = useTranslation();
  const api = useApi();
  const [installing, setInstalling] = useState(false);

  const installCommand = 'npx -y bmad-method install';

  const handleInstall = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setInstalling(true);

    try {
      const result = await api.installBmad(projectDir);

      if (result.success) {
        showSuccessNotification(result.message || t('bmad.install.success') || 'BMAD installed successfully');
        // Refresh BMAD state immediately after successful installation
        refreshState();
      } else {
        showErrorNotification(result.message || t('bmad.install.error') || 'BMAD installation failed');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      showErrorNotification(`${t('bmad.install.error')}: ${errorMessage}`);
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="w-full max-w-lg">
        <BmadWelcomeSection />

        <div className="bg-bg-secondary rounded-lg border border-border-dark-light p-4 mb-4">
          <p className="text-xs text-text-tertiary mb-3 font-medium">{t('bmad.install.terminalPrompt')}</p>
          <ul className="space-y-2">
            {(t('bmad.install.benefits', { returnObjects: true }) as string[]).map((benefit, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <div className="w-4 h-4 rounded-full bg-success-subtle flex items-center justify-center flex-shrink-0 mt-0.5">
                  <FiCheck className="w-2.5 h-2.5 text-success" />
                </div>
                <span className="text-xs text-text-secondary">{benefit}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex justify-center">
            <Button onClick={handleInstall} disabled={installing} size="sm">
              {installing ? (
                <>
                  <CgSpinner className="w-4 h-4 mr-2 animate-spin" />
                  {t('bmad.install.installing')}
                </>
              ) : (
                <>
                  <FiDownload className="w-4 h-4 mr-2" />
                  {t('bmad.install.button')}
                </>
              )}
            </Button>
          </div>

          <p className="text-xs text-text-secondary text-center">{t('bmad.install.autoInstallNote')}</p>
        </div>

        <div className="border-t border-border-dark-light pt-4 mt-2">
          <p className="text-xs text-text-tertiary mb-3 font-medium">{t('bmad.install.manualInstallTitle')}</p>
          <div className="bg-bg-tertiary rounded-lg border border-border-dark-light p-3">
            <p className="text-xs text-text-tertiary mb-2">{t('bmad.install.commandLabel')}</p>
            <div className="group flex items-center justify-between gap-2 bg-bg-primary rounded-md px-3 py-2">
              <code className="text-xs text-text-primary font-mono">{installCommand}</code>
              <CopyMessageButton content={installCommand} alwaysShow />
            </div>
            <p className="text-xs text-text-tertiary mt-2">{t('bmad.install.manualInstallNote')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

import { MouseEvent, useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FiAlertTriangle, FiLayers, FiZap } from 'react-icons/fi';
import { clsx } from 'clsx';

import { useBmadState } from './useBmadState';

import { useApi } from '@/contexts/ApiContext';
import { BmadInstallPrompt } from '@/components/bmad/BmadInstallPrompt';
import { BmadWelcomeSection } from '@/components/bmad/BmadWelcomeSection';
import { WorkflowList } from '@/components/bmad/WorkflowList';
import { PathInfoCard } from '@/components/bmad/PathInfoCard';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/common/Button';
import { showErrorNotification, showSuccessNotification } from '@/utils/notifications';
import { LoadingOverlay } from '@/components/common/LoadingOverlay';

type PathType = 'full' | 'quick';

type Props = {
  projectDir?: string;
  taskId?: string;
};

export const BmadWorkflowPage = ({ projectDir, taskId }: Props) => {
  const { t } = useTranslation();
  const api = useApi();
  const { status: bmadStatus, suggestedWorkflows, isLoading, error, refresh } = useBmadState({ projectDir });

  const [activeTab, setActiveTab] = useState<PathType>('full');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (bmadStatus && !bmadStatus.installed) {
      intervalRef.current = setInterval(() => {
        void refresh(false);
      }, 3000);
    }

    if (bmadStatus?.installed && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [bmadStatus, refresh]);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTabChange = (tab: PathType) => {
    setActiveTab(tab);
  };

  const handleResetClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setShowResetConfirm(true);
  };

  const handleResetCancel = () => {
    setShowResetConfirm(false);
  };

  const handleResetConfirm = async () => {
    if (!projectDir) {
      return;
    }

    setResetting(true);
    try {
      const result = await api.resetBmadWorkflow(projectDir);
      if (result.success) {
        showSuccessNotification(t('bmad.reset.success'));
        void refresh();
      } else {
        showErrorNotification(result.message || t('bmad.reset.error'));
      }
    } catch (err) {
      showErrorNotification(t('bmad.reset.error'));
      // eslint-disable-next-line no-console
      console.error('Reset workflow error:', err);
    } finally {
      setResetting(false);
      setShowResetConfirm(false);
    }
  };

  const hasWorkflowProgress =
    (bmadStatus?.completedWorkflows && bmadStatus.completedWorkflows.length > 0) ||
    (bmadStatus?.inProgressWorkflows && bmadStatus.inProgressWorkflows.length > 0);

  const renderWelcomeSection = () => <BmadWelcomeSection />;

  const renderResetBanner = () => {
    if (!bmadStatus?.installed || !hasWorkflowProgress) {
      return null;
    }

    return (
      <div className="bg-warning-subtle border border-warning-emphasis rounded-lg p-4 mb-4">
        <div className="flex items-start gap-3">
          <FiAlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-warning-light mb-1">{t('bmad.reset.bannerTitle')}</h3>
            <p className="text-xs text-text-secondary mb-3">{t('bmad.reset.bannerDescription')}</p>
            <Button onClick={handleResetClick} disabled={resetting} color="danger" size="sm">
              {resetting ? t('bmad.reset.resetting') : t('bmad.reset.button')}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderTabs = () => (
    <div className="flex bg-bg-secondary-light rounded-md p-1 mb-4">
      <button
        onClick={() => handleTabChange('full')}
        className={clsx(
          'flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm rounded transition-colors duration-200',
          activeTab === 'full' ? 'bg-bg-fourth text-text-primary font-medium' : 'text-text-muted-light hover:text-text-secondary hover:bg-bg-tertiary',
        )}
      >
        <FiLayers className="w-4 h-4" />
        {t('bmad.tabs.fullWorkflow')}
      </button>
      <button
        onClick={() => handleTabChange('quick')}
        className={clsx(
          'flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm rounded transition-colors duration-200',
          activeTab === 'quick' ? 'bg-bg-fourth text-text-primary font-medium' : 'text-text-muted-light hover:text-text-secondary hover:bg-bg-tertiary',
        )}
      >
        <FiZap className="w-4 h-4" />
        {t('bmad.tabs.quickFlow')}
      </button>
    </div>
  );

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <LoadingOverlay message={t('common.loading')} />
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-error text-center">
            {error}
            <button onClick={() => refresh()} className="ml-2 underline hover:no-underline">
              {t('common.retry')}
            </button>
          </div>
        </div>
      );
    }

    if (!bmadStatus) {
      return null;
    }

    if (!bmadStatus.installed) {
      if (!projectDir || !taskId) {
        return (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-sm text-text-secondary text-center">{t('common.error')}: Missing project context</div>
          </div>
        );
      }
      return <BmadInstallPrompt refreshState={refresh} projectDir={projectDir} />;
    }

    if (!projectDir || !taskId) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-sm text-text-secondary text-center">{t('common.error')}: Missing project context</div>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-4">
        {renderWelcomeSection()}

        <div className="text-xs text-text-tertiary">
          {t('bmad.workflows.installedVersion', {
            version: bmadStatus.version,
          })}
        </div>

        {renderTabs()}

        <PathInfoCard pathType={activeTab} />

        <WorkflowList
          projectDir={projectDir}
          taskId={taskId}
          activeTab={activeTab}
          status={bmadStatus}
          suggestedWorkflows={suggestedWorkflows}
          isLoading={isLoading}
          error={error}
          onRefresh={refresh}
        />

        {renderResetBanner()}
      </div>
    );
  };

  return (
    <div className="absolute inset-0 flex flex-col overflow-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-tertiary">
      <div className={clsx('w-full max-w-3xl mx-auto p-6', isLoading && 'flex-1 flex flex-col')}>{renderContent()}</div>

      {showResetConfirm && (
        <ConfirmDialog
          title={t('bmad.reset.confirmTitle')}
          onConfirm={handleResetConfirm}
          onCancel={handleResetCancel}
          confirmButtonText={t('bmad.reset.confirmButton')}
          confirmButtonColor="danger"
          disabled={resetting}
        >
          <p className="text-sm text-text-secondary">{t('bmad.reset.confirmDescription')}</p>
        </ConfirmDialog>
      )}
    </div>
  );
};

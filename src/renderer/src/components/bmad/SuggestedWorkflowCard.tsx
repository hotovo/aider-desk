import { Model, ProviderProfile } from '@common/types';
import { WorkflowExecutionOptions, WorkflowMetadata } from '@common/bmad-types';
import { getProviderModelId } from '@common/agent';
import { extractProviderModel } from '@common/utils';
import { MouseEvent, useCallback, useState } from 'react';
import { CgSpinner } from 'react-icons/cg';
import { FiChevronLeft, FiChevronRight, FiPlay } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';

import { useApi } from '@/contexts/ApiContext';
import { useSettings } from '@/contexts/SettingsContext';
import { showErrorNotification } from '@/utils/notifications';
import { Button } from '@/components/common/Button';
import { ModelSelector } from '@/components/ModelSelector';
import { IconButton } from '@/components/common/IconButton';

type Props = {
  workflow: WorkflowMetadata;
  projectDir: string;
  taskId: string;
  onRefresh: () => Promise<void>;
  defaultModelId?: string;
  models: Model[];
  providers: ProviderProfile[];
};

export const SuggestedWorkflowCard = ({ workflow, projectDir, taskId, onRefresh, defaultModelId, models, providers }: Props) => {
  const { t } = useTranslation();
  const api = useApi();
  const { settings } = useSettings();
  const [loading, setLoading] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string | undefined>(defaultModelId);

  const handleModelChange = useCallback((model: Model) => {
    const modelId = getProviderModelId(model);
    setSelectedModelId(modelId);
  }, []);

  const handleExecuteWorkflow = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    if (loading) {
      return;
    }

    setLoading(true);

    try {
      const options: WorkflowExecutionOptions = { asSubtask: true };

      if (selectedModelId) {
        const [providerId, modelId] = extractProviderModel(selectedModelId);
        if (providerId && modelId) {
          options.provider = providerId;
          options.model = modelId;
        }
      }

      const result = await api.executeWorkflow(projectDir, taskId, workflow.id, options);

      if (result.success) {
        await onRefresh();
      } else {
        const errorMessage = result.error?.message || t('bmad.workflows.workflowError');
        const fullMessage = result.error?.recoveryAction ? `${errorMessage}\n${result.error.recoveryAction}` : errorMessage;
        showErrorNotification(fullMessage);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      showErrorNotification(`${t('bmad.workflows.workflowError')}: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleModelSelector = () => {
    setShowModelSelector(!showModelSelector);
  };

  return (
    <div className="border border-border-dark-light rounded-md bg-bg-secondary min-w-0">
      <div className="flex items-center p-2 gap-1 pr-1">
        <Button onClick={handleExecuteWorkflow} disabled={loading} size="xs" className="flex-shrink-0">
          <span>{loading ? t('bmad.workflows.executing') : workflow.name}</span>
          {loading ? <CgSpinner className="animate-spin w-3 h-3" /> : <FiPlay className="w-3 h-3" />}
        </Button>
        {showModelSelector && (
          <div className="px-2">
            <ModelSelector
              models={models}
              selectedModelId={selectedModelId}
              onChange={handleModelChange}
              preferredModelIds={settings?.preferredModels || []}
              providers={providers}
              className="text-text-primary"
              popupPlacement="top"
            />
          </div>
        )}
        <IconButton
          icon={showModelSelector ? <FiChevronLeft className="w-3 h-3" /> : <FiChevronRight className="w-3 h-3" />}
          onClick={handleToggleModelSelector}
          disabled={loading}
          className="flex-shrink-0 hover:bg-bg-tertiary p-1.5 rounded-md"
          tooltip={t(showModelSelector ? 'bmad.hideModelSelector' : 'bmad.showModelSelector')}
        />
      </div>
    </div>
  );
};

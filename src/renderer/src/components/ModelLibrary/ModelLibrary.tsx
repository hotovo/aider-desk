import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useHotkeys } from 'react-hotkeys-hook';
import { Model, ProviderProfile } from '@common/types';
import { LlmProviderName } from '@common/agent';

import { ModelDialog } from './ModelDialog';
import { ProviderSelection } from './ProviderSelection';
import { ProviderProfileForm } from './ProviderProfileForm';
import { ProviderProfileDialog } from './ProviderProfileDialog';
import { ProviderHeader } from './ProviderHeader';
import { ModelTableSection } from './ModelTableSection';

import { ModalOverlayLayout } from '@/components/common/ModalOverlayLayout';
import { useModelProviders } from '@/contexts/ModelProviderContext';

type Props = {
  isVisible: boolean;
  onClose: () => void;
};

export const ModelLibrary = ({ isVisible, onClose }: Props) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    models,
    providers,
    saveProvider,
    deleteProvider,
    upsertModel,
    deleteModel,
    updateModels,
    errors: providerErrors,
    refresh,
    modelsLoading,
  } = useModelProviders();
  const [selectedProviderIds, setSelectedProviderIds] = useState<string[]>([]);
  const [configuringProvider, setConfiguringProvider] = useState<LlmProviderName | null>(null);
  const [editingProfile, setEditingProfile] = useState<ProviderProfile | undefined>(undefined);
  const [showProviderSelection, setShowProviderSelection] = useState(false);
  const [editingModel, setEditingModel] = useState<Model | undefined>(undefined);
  const [showModelDialog, setShowModelDialog] = useState(false);
  const hasProfiles = providers.length > 0;

  const handleCancelConfigure = () => {
    setConfiguringProvider(null);
    setEditingProfile(undefined);
    setShowProviderSelection(false);
  };

  const handleClose = () => {
    if (showModelDialog) {
      setShowModelDialog(false);
      setEditingModel(undefined);
    } else if (editingProfile) {
      setEditingProfile(undefined);
    } else if (configuringProvider || showProviderSelection) {
      handleCancelConfigure();
    } else {
      onClose();
    }
  };

  useHotkeys('esc', handleClose, {
    enabled: isVisible,
    enableOnFormTags: true,
    enableOnContentEditable: true,
  });

  useEffect(() => {
    if (isVisible) {
      containerRef.current?.focus();
    }
  }, [isVisible]);

  const handleToggleProviderSelect = (profileId: string) => {
    setSelectedProviderIds((prev) => (prev.includes(profileId) ? prev.filter((id) => id !== profileId) : [...prev, profileId]));
  };

  const handleAddProvider = () => {
    setShowProviderSelection(true);
    setEditingProfile(undefined);
  };

  const handleSelectProvider = (provider: LlmProviderName) => {
    setConfiguringProvider(provider);
    setShowProviderSelection(false);
  };

  const handleEditProfile = (profile: ProviderProfile) => {
    setEditingProfile(profile);
  };

  const handleDeleteProfile = async (profile: ProviderProfile) => {
    await deleteProvider(profile.id);
    setSelectedProviderIds((prev) => prev.filter((id) => id !== profile.id));
  };

  const handleSaveProfile = async (profile: ProviderProfile) => {
    await saveProvider(profile);
    setConfiguringProvider(null);
    setEditingProfile(undefined);
    setShowProviderSelection(false);
  };

  const handleAddModel = () => {
    setEditingModel(undefined);
    setShowModelDialog(true);
  };

  const handleEditModel = (model: Model) => {
    setEditingModel(model);
    setShowModelDialog(true);
  };

  const handleDeleteModel = async (model: Model) => {
    if (model.isCustom) {
      await deleteModel(model.providerId, model.id);
      setSelectedProviderIds((prev) => prev.filter((id) => id !== model.providerId));
    }
  };

  const handleSaveModel = async (model: Model) => {
    await upsertModel(model.providerId, model.id, model);
    setShowModelDialog(false);
    setEditingModel(undefined);
  };

  const handleToggleHidden = async (model: Model) => {
    const updatedModel = { ...model, isHidden: !model.isHidden };
    await upsertModel(model.providerId, model.id, updatedModel);
  };

  const handleBulkToggleHidden = async (modelIds: string[], isHidden: boolean) => {
    const modelsToUpdate = models.filter((model) => modelIds.includes(model.id));
    const modelUpdates = modelsToUpdate.map((model) => ({
      providerId: model.providerId,
      modelId: model.id,
      model: { ...model, isHidden },
    }));
    await updateModels(modelUpdates);
  };

  // Show provider selection when adding new provider
  if (showProviderSelection || (!hasProfiles && !configuringProvider)) {
    return (
      <div ref={containerRef} tabIndex={-1} className="h-full outline-none">
        <ModalOverlayLayout title={t('modelLibrary.title')} onClose={onClose}>
          <div className="p-10">
            <ProviderSelection onSelectProvider={handleSelectProvider} onCancel={handleCancelConfigure} />
          </div>
        </ModalOverlayLayout>
      </div>
    );
  }

  // Show provider configuration form
  if (configuringProvider) {
    return (
      <div ref={containerRef} tabIndex={-1} className="h-full outline-none">
        <ModalOverlayLayout title={t('modelLibrary.title')} onClose={onClose}>
          <ProviderProfileForm
            key={configuringProvider}
            provider={configuringProvider}
            editProfile={editingProfile}
            providers={providers}
            onSave={handleSaveProfile}
            onCancel={handleCancelConfigure}
          />
        </ModalOverlayLayout>
      </div>
    );
  }

  return (
    <div ref={containerRef} tabIndex={-1} className="h-full outline-none">
      <ModalOverlayLayout title={t('modelLibrary.title')} onClose={onClose}>
        {showModelDialog && (
          <ModelDialog
            model={editingModel}
            providers={providers}
            onSave={handleSaveModel}
            onCancel={() => {
              setShowModelDialog(false);
              setEditingModel(undefined);
            }}
          />
        )}
        {editingProfile && (
          <ProviderProfileDialog
            provider={editingProfile.provider.name}
            editProfile={editingProfile}
            providers={providers}
            onSave={handleSaveProfile}
            onCancel={() => setEditingProfile(undefined)}
          />
        )}
        <div className="flex flex-col h-full overflow-hidden">
          <ProviderHeader
            providers={providers}
            providerErrors={providerErrors}
            selectedProfileIds={selectedProviderIds}
            onToggleSelect={handleToggleProviderSelect}
            onAddProvider={handleAddProvider}
            onEditProfile={handleEditProfile}
            onDeleteProfile={handleDeleteProfile}
          />
          <ModelTableSection
            models={models}
            selectedProviderIds={selectedProviderIds}
            providers={providers}
            onAddModel={handleAddModel}
            onEditModel={handleEditModel}
            onDeleteModel={handleDeleteModel}
            onToggleHidden={handleToggleHidden}
            onBulkToggleHidden={handleBulkToggleHidden}
            onRefreshModels={refresh}
            modelsLoading={modelsLoading}
          />
        </div>
      </ModalOverlayLayout>
    </div>
  );
};

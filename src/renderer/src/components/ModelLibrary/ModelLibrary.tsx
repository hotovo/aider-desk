import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Model, ProviderProfile } from '@common/types';
import { LlmProviderName } from '@common/agent';

import { ModelDialog } from './ModelDialog';
import { ProviderSelection } from './ProviderSelection';
import { ProviderProfileDialog } from './ProviderProfileDialog';
import { ProviderHeader } from './ProviderHeader';
import { ModelTableSection } from './ModelTableSection';

import { ModalOverlayLayout } from '@/components/common/ModalOverlayLayout';
import { useModelProviders } from '@/contexts/ModelProviderContext';

type Props = {
  onClose: () => void;
};

export const ModelLibrary = ({ onClose }: Props) => {
  const { t } = useTranslation();
  const { models, providers, saveProvider, deleteProvider, upsertModel, deleteModel, errors: providerErrors, refresh, modelsLoading } = useModelProviders();
  const [selectedProviderIds, setSelectedProviderIds] = useState<string[]>([]);
  const [configuringProvider, setConfiguringProvider] = useState<LlmProviderName | null>(null);
  const [editingProfile, setEditingProfile] = useState<ProviderProfile | undefined>(undefined);
  const [showProviderSelection, setShowProviderSelection] = useState(false);
  const [editingModel, setEditingModel] = useState<Model | undefined>(undefined);
  const [showModelDialog, setShowModelDialog] = useState(false);
  const hasProfiles = providers.length > 0;
  const shouldShowProviderSelection = showProviderSelection || (!hasProfiles && !configuringProvider);

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
    setConfiguringProvider(profile.provider.name);
  };

  const handleDeleteProfile = async (profile: ProviderProfile) => {
    await deleteProvider(profile.id);
    setSelectedProviderIds((prev) => prev.filter((id) => id !== profile.id));
  };

  const handleCancelConfigure = () => {
    setConfiguringProvider(null);
    setEditingProfile(undefined);
    setShowProviderSelection(false);
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

  // Show provider selection when adding new provider
  if (shouldShowProviderSelection) {
    return (
      <ModalOverlayLayout title={t('modelLibrary.title')} onClose={onClose}>
        <div className="p-10">
          <ProviderSelection onSelectProvider={handleSelectProvider} onCancel={handleCancelConfigure} />
        </div>
      </ModalOverlayLayout>
    );
  }

  return (
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
          onAutoSave={(modelData) => upsertModel(modelData.providerId, modelData.id, modelData)}
        />
      )}
      {configuringProvider && (
        <ProviderProfileDialog
          provider={configuringProvider}
          editProfile={editingProfile}
          providers={providers}
          onSave={handleSaveProfile}
          onCancel={handleCancelConfigure}
          onAutoSave={(profile) => saveProvider(profile)}
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
          onRefreshModels={refresh}
          modelsLoading={modelsLoading}
        />
      </div>
    </ModalOverlayLayout>
  );
};

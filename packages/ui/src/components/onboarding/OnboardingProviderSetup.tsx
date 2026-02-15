import { useState } from 'react';
import { ProviderProfile } from '@aider-desk/common/types';
import { LlmProviderName } from '@aider-desk/common/agent';

import { ProviderSelection } from '@/components/ModelLibrary/ProviderSelection';
import { ProviderProfileForm } from '@/components/ModelLibrary/ProviderProfileForm';
import { useModelProviders } from '@/contexts/ModelProviderContext';
import { ProviderHeader } from '@/components/ModelLibrary/ProviderHeader';

export const OnboardingProviderSetup = () => {
  const { providers, saveProvider, deleteProvider, errors: providerErrors } = useModelProviders();
  const [configuringProvider, setConfiguringProvider] = useState<LlmProviderName | null>(null);
  const [editingProfile, setEditingProfile] = useState<ProviderProfile | undefined>(undefined);
  const [showProviderSelection, setShowProviderSelection] = useState(false);

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

  // Show provider configuration form
  if (configuringProvider) {
    return (
      <div className="border border-border-default-dark rounded-md">
        <ProviderProfileForm
          provider={configuringProvider}
          editProfile={editingProfile}
          providers={providers}
          onSave={handleSaveProfile}
          onCancel={handleCancelConfigure}
        />
      </div>
    );
  }

  // Show provider selection when adding new provider
  if (showProviderSelection || providers.length === 0) {
    return (
      <div className="space-y-6">
        <ProviderSelection
          onSelectProvider={handleSelectProvider}
          onCancel={providers.length === 0 ? undefined : handleCancelConfigure}
          showTitle={providers.length > 0}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ProviderHeader
        providers={providers}
        providerErrors={providerErrors}
        selectedProfileIds={[]}
        onToggleSelect={() => {}}
        onAddProvider={handleAddProvider}
        onEditProfile={handleEditProfile}
        onDeleteProfile={handleDeleteProfile}
      />
    </div>
  );
};

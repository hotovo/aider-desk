import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';
import { LlmProviderName } from '@common/agent';
import { ProviderProfile } from '@common/types';

import { ProviderProfileForm, ProviderProfileFormRef } from './ProviderProfileForm';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';

type Props = {
  provider: LlmProviderName;
  editProfile?: ProviderProfile;
  providers: ProviderProfile[];
  onSave: (profile: ProviderProfile) => void;
  onCancel: () => void;
  onAutoSave?: (profile: ProviderProfile) => void;
};

export const ProviderProfileDialog = ({ provider, editProfile, providers, onSave, onCancel, onAutoSave }: Props) => {
  const { t } = useTranslation();
  const formRef = useRef<ProviderProfileFormRef>(null);
  const [draftProfile, setDraftProfile] = useState<ProviderProfile | null>(editProfile || null);
  const lastSavedJsonRef = useRef<string | null>(editProfile ? JSON.stringify(editProfile) : null);

  useEffect(() => {
    setDraftProfile(editProfile || null);
    lastSavedJsonRef.current = editProfile ? JSON.stringify(editProfile) : null;
  }, [editProfile]);

  useEffect(() => {
    if (!onAutoSave || !draftProfile) {
      return;
    }

    const handle = setTimeout(() => {
      const draftJson = JSON.stringify(draftProfile);
      if (draftJson === lastSavedJsonRef.current) {
        return;
      }

      lastSavedJsonRef.current = draftJson;
      void onAutoSave(draftProfile);
    }, 400);

    return () => {
      clearTimeout(handle);
    };
  }, [draftProfile, onAutoSave]);

  return (
    <ConfirmDialog
      title={t('modelLibrary.editProvider', { defaultValue: 'Edit Provider' })}
      onCancel={onCancel}
      onConfirm={() => formRef.current?.submit()}
      confirmButtonText={t('common.done', { defaultValue: 'Done' })}
      width={700}
      closeOnEscape={true}
    >
      <ProviderProfileForm
        ref={formRef}
        provider={provider}
        editProfile={editProfile}
        providers={providers}
        onSave={onSave}
        onCancel={onCancel}
        hideActions
        onChange={(profile) => setDraftProfile(profile)}
      />
    </ConfirmDialog>
  );
};

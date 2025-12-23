import { useTranslation } from 'react-i18next';
import { useRef } from 'react';
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
};

export const ProviderProfileDialog = ({ provider, editProfile, providers, onSave, onCancel }: Props) => {
  const { t } = useTranslation();
  const formRef = useRef<ProviderProfileFormRef>(null);

  return (
    <ConfirmDialog
      title={t('modelLibrary.editProvider', { defaultValue: 'Edit Provider' })}
      onCancel={onCancel}
      onConfirm={() => formRef.current?.submit()}
      confirmButtonText={t('common.done', { defaultValue: 'Done' })}
      width={700}
    >
      <ProviderProfileForm
        key={editProfile?.id || provider}
        ref={formRef}
        provider={provider}
        editProfile={editProfile}
        providers={providers}
        onSave={onSave}
        onCancel={onCancel}
        hideActions
      />
    </ConfirmDialog>
  );
};

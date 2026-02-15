import { useTranslation } from 'react-i18next';
import { useRef, useState } from 'react';
import { LlmProviderName } from '@aider-desk/common/agent';
import { ProviderProfile } from '@aider-desk/common/types';

import { ProviderProfileForm, ProviderProfileFormRef } from './ProviderProfileForm';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/common/Button';

type Props = {
  provider: LlmProviderName;
  profile?: ProviderProfile;
  providers: ProviderProfile[];
  onSave: (profile: ProviderProfile) => void;
  onCancel: () => void;
};

export const ProviderProfileDialog = ({ provider, profile, providers, onSave, onCancel }: Props) => {
  const { t } = useTranslation();
  const formRef = useRef<ProviderProfileFormRef>(null);
  const [isDisabled, setIsDisabled] = useState(profile?.disabled ?? false);

  const handleSave = (savedProfile: ProviderProfile) => {
    onSave({ ...savedProfile, disabled: isDisabled });
  };

  const handleToggleDisabled = () => {
    setIsDisabled((prev) => !prev);
  };

  return (
    <ConfirmDialog
      title={t('modelLibrary.editProvider')}
      onCancel={onCancel}
      onConfirm={() => formRef.current?.submit()}
      confirmButtonText={t('common.save')}
      footerAdditionalComponents={
        <div className="flex gap-2 w-full justify-start">
          <Button onClick={handleToggleDisabled} variant="text" color={isDisabled ? 'tertiary' : 'danger'}>
            {isDisabled ? t('modelLibrary.enable') : t('modelLibrary.disable')}
          </Button>
        </div>
      }
      width={700}
    >
      <ProviderProfileForm
        key={profile?.id || provider}
        ref={formRef}
        provider={provider}
        editProfile={profile}
        providers={providers}
        onSave={handleSave}
        onCancel={onCancel}
        hideActions
        hideTitle
      />
      {isDisabled && (
        <div className="p-3">
          <p className="text-xs text-text-error">{t('modelLibrary.providerDisabled')}</p>
        </div>
      )}
    </ConfirmDialog>
  );
};

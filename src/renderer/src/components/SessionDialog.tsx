import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { BaseDialog } from './common/BaseDialog';
import { Button } from './common/Button';
import { Checkbox } from './common/Checkbox';
import { Input } from './common/Input';

type Props = {
  onClose: () => void;
  onSave: (name: string, loadMessages: boolean, loadFiles: boolean) => void;
  initialName?: string;
  initialLoadMessages?: boolean;
  initialLoadFiles?: boolean;
  isEdit?: boolean;
};

export const SessionDialog = ({ onClose, onSave, initialName = '', initialLoadMessages = true, initialLoadFiles = true, isEdit = false }: Props) => {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);
  const [loadMessages, setLoadMessages] = useState(initialLoadMessages);
  const [loadFiles, setLoadFiles] = useState(initialLoadFiles);

  const handleSave = () => {
    if (!name.trim()) {
      return;
    }
    onSave(name.trim(), loadMessages, loadFiles);
    onClose();
  };

  return (
    <BaseDialog
      title={isEdit ? t('session.edit') : t('session.save')}
      onClose={onClose}
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {isEdit ? t('common.update') : t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label={t('session.name')} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('session.namePlaceholder')} autoFocus />

        <div className="pt-2">
          <h3 className="text-sm font-medium mb-2">{t('session.loadSettings')}</h3>
          <div className="space-y-2">
            <Checkbox label={t('session.loadMessages')} checked={loadMessages} onChange={setLoadMessages} />
            <Checkbox label={t('session.loadFiles')} checked={loadFiles} onChange={setLoadFiles} />
          </div>
        </div>
      </div>
    </BaseDialog>
  );
};

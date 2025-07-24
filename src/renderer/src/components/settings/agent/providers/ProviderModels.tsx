import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IoClose } from 'react-icons/io5';
import { HiPlus } from 'react-icons/hi';
import clsx from 'clsx';

import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';

type Props = {
  models: string[];
  onChange: (updatedModels: string[]) => void;
  placeholder?: string;
};

export const ProviderModels = ({ models, onChange, placeholder }: Props) => {
  const { t } = useTranslation();

  const [newModel, setNewModel] = useState('');

  const handleModelsChange = (updatedModels: string[]) => {
    onChange(updatedModels);
  };

  const handleAddModel = () => {
    if (newModel.trim() && !models.includes(newModel.trim())) {
      handleModelsChange([...models, newModel.trim()]);
      setNewModel('');
    }
  };

  const handleRemoveModel = (index: number) => {
    const updatedModels = models.filter((_, i) => i !== index);
    handleModelsChange(updatedModels);
  };

  return (
    <div className="space-y-1">
      <div>
        <div className="text-sm font-medium mb-1">{t('model.labelMultiple')}</div>
        <div className={clsx('space-y-1', models.length && 'mb-2')}>
          {models.map((model, index) => (
            <div key={model} className="flex items-center justify-between rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-xs">
              <span>{model}</span>
              <IconButton icon={<IoClose className="h-4 w-4" />} onClick={() => handleRemoveModel(index)} className="text-neutral-400 hover:text-neutral-200" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-end space-x-2">
        <Input
          type="text"
          value={newModel}
          onChange={(e) => setNewModel(e.target.value)}
          placeholder={placeholder || t('model.placeholder')}
          wrapperClassName="flex-grow"
        />
        <Button onClick={handleAddModel} disabled={!newModel.trim()} variant="text">
          <HiPlus className="mr-1 w-3 h-3" />
          {t('common.add')}
        </Button>
      </div>
    </div>
  );
};

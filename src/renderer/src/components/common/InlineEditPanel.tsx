import { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';

type Props = {
  value: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  placeholder?: string;
  autoFocus?: boolean;
};

export const InlineEditPanel = ({ value, onChange, onConfirm, onCancel, placeholder, autoFocus = true }: Props) => {
  const { t } = useTranslation();

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onConfirm();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="m-2 p-2 bg-bg-primary border border-border-default rounded-md">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="mb-2"
        size="sm"
        autoFocus={autoFocus}
        onFocus={(e) => e.target.select()}
      />
      <div className="flex gap-2 justify-end">
        <Button variant="text" size="xs" color="tertiary" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button variant="contained" color="primary" size="xs" onClick={onConfirm}>
          {t('common.confirm')}
        </Button>
      </div>
    </div>
  );
};

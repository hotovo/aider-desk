import { useState, useRef, KeyboardEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Chip } from '@/components/common/Chip';
import { Button } from '@/components/common/Button';

type Props = {
  label: ReactNode;
  items: string[];
  onAdd: (item: string) => void;
  onRemove: (item: string) => void;
  placeholder?: string;
  addLabel?: string;
  removeTooltip?: string;
  emptyLabel?: string;
};

export const ChipListInput = ({ label, items, onAdd, onRemove, placeholder, addLabel, removeTooltip, emptyLabel }: Props) => {
  const { t } = useTranslation();
  const [newValue, setNewValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    const trimmed = newValue.trim();
    if (trimmed && !items.includes(trimmed)) {
      onAdd(trimmed);
    }
    setNewValue('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs text-text-primary font-medium">{label}</label>}

      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto p-0.5 scrollbar-thin scrollbar-track-bg-secondary-light scrollbar-thumb-bg-tertiary hover:scrollbar-thumb-bg-fourth w-full">
          {items.map((item) => (
            <Chip
              key={item}
              label={item}
              onRemove={() => onRemove(item)}
              removeTooltip={removeTooltip || t('common.remove')}
              className="bg-bg-secondary text-2xs"
            />
          ))}
        </div>
      ) : (
        emptyLabel && <div className="text-2xs text-text-muted">{emptyLabel}</div>
      )}

      <div className="flex gap-2 items-center">
        <input
          ref={inputRef}
          type="text"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-64 bg-bg-secondary border border-border-default rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-border-accent placeholder:text-text-muted"
        />
        <Button variant="outline" size="xs" onClick={handleAdd}>
          {addLabel || t('common.add')}
        </Button>
      </div>
    </div>
  );
};

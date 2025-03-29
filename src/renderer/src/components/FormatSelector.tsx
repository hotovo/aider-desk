import { useState, useRef } from 'react';
import { CgLock, CgLockUnlock } from 'react-icons/cg';
import { MdKeyboardArrowUp } from 'react-icons/md';
import { useTranslation } from 'react-i18next';

import { useClickOutside } from '@/hooks/useClickOutside';

type Props = {
  editFormat: string;
  editFormatLocked: boolean;
  onFormatChange: (format: string) => void;
  onLockChange: (locked: boolean) => void;
};

const EDIT_FORMATS = [
  { value: 'code', label: 'components.formatSelector.code' },
  { value: 'ask', label: 'components.formatSelector.ask' },
  { value: 'architect', label: 'components.formatSelector.architect' },
];

export const FormatSelector = ({ editFormat, editFormatLocked, onFormatChange, onLockChange }: Props) => {
  const { t } = useTranslation();
  const [formatSelectorVisible, setFormatSelectorVisible] = useState(false);
  const formatSelectorRef = useRef<HTMLDivElement>(null);

  useClickOutside(formatSelectorRef, () => setFormatSelectorVisible(false));

  const toggleFormatSelectorVisible = () => {
    setFormatSelectorVisible((prev) => !prev);
  };

  return (
    <div className="relative" ref={formatSelectorRef}>
      <button
        onClick={toggleFormatSelectorVisible}
        className="flex items-center hover:text-neutral-300 focus:outline-none transition-colors duration-200 text-xs"
      >
        <MdKeyboardArrowUp className="w-3 h-3 mr-0.5" />
        <span className="capitalize">{editFormat}</span>
        {editFormat !== 'code' && (
          <span className="ml-1">
            {editFormatLocked ? (
              <CgLock
                className="w-4 h-4 focus:outline-none"
                onClick={(e) => {
                  e.stopPropagation();
                  onLockChange(false);
                }}
                title={t('formatSelector.lock')}
              />
            ) : (
              <CgLockUnlock
                className="w-4 h-4 focus:outline-none"
                onClick={(e) => {
                  e.stopPropagation();
                  onLockChange(true);
                }}
                title={t('formatSelector.unlock')}
              />
            )}
          </span>
        )}
      </button>
      {formatSelectorVisible && (
        <div className="absolute bottom-full mb-1 bg-neutral-900 border border-neutral-700 rounded-md shadow-lg z-10 ml-2">
          {EDIT_FORMATS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => {
                onFormatChange(value);
                setFormatSelectorVisible(false);
              }}
              className={`w-full px-3 py-1 text-left hover:bg-neutral-700 transition-colors duration-200 text-xs
              ${value === editFormat ? 'text-white font-bold' : 'text-neutral-300'}`}
            >
              {t(label, { ns: 'translation' })}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

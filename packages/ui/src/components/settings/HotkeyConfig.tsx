import { useEffect, useRef, useState, KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { FaPlus, FaEdit, FaTimes } from 'react-icons/fa';
import { clsx } from 'clsx';
import { useRecordHotkeys } from 'react-hotkeys-hook';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Input } from '@/components/common/Input';
import { IconButton } from '@/components/common/IconButton';

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  size?: 'md' | 'sm';
};

type RecordingDialogProps = {
  onSave: (hotkey: string) => void;
  onCancel: () => void;
  existingHotkey?: string;
};

const RecordingDialog = ({ onSave, onCancel, existingHotkey }: RecordingDialogProps) => {
  const { t } = useTranslation();
  const [keys, { start, stop, isRecording }] = useRecordHotkeys();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    start();
    inputRef.current?.focus();
    return () => stop();
  }, [start, stop]);

  const handleConfirm = () => {
    if (keys.size > 0) {
      const hotkeyArray = Array.from(keys);
      const hotkey = hotkeyArray.join('+');
      onSave(hotkey);
    } else {
      onCancel();
    }
  };

  const displayValue = keys.size > 0 ? Array.from(keys).join('+') : existingHotkey || '';

  return (
    <ConfirmDialog
      title={existingHotkey ? t('settings.hotkeys.editShortcut') : t('settings.hotkeys.addShortcut')}
      onConfirm={handleConfirm}
      onCancel={onCancel}
      confirmButtonText={t('common.ok')}
      cancelButtonText={t('common.cancel')}
      disabled={keys.size === 0 && !existingHotkey}
      width={400}
      closeOnEscape={true}
    >
      <div className="space-y-4">
        <div className="text-sm text-text-secondary">{t('settings.hotkeys.recordShortcutDescription')}</div>
        <Input
          ref={inputRef}
          value={isRecording ? displayValue || t('settings.hotkeys.pressKeysToRecord') : displayValue}
          onChange={() => {}}
          readOnly
          size="md"
          className={clsx('font-mono text-center', isRecording && 'border-2 border-text-primary animate-pulse')}
          placeholder={t('settings.hotkeys.pressKeysToRecord')}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.preventDefault()}
        />
      </div>
    </ConfirmDialog>
  );
};

export const HotkeyConfig = ({ label, value, onChange, size = 'md' }: Props) => {
  const { t } = useTranslation();
  const [showRecordingDialog, setShowRecordingDialog] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Parse the value into an array of shortcuts
  const shortcuts = value
    ? value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const handleAddShortcut = () => {
    setEditingIndex(null);
    setShowRecordingDialog(true);
  };

  const handleEditShortcut = (index: number) => {
    setEditingIndex(index);
    setShowRecordingDialog(true);
  };

  const handleClearShortcut = (index: number) => {
    if (shortcuts.length === 1) {
      // If only one shortcut exists, just clear it
      onChange('');
    } else {
      // Remove the shortcut at the specified index
      const newShortcuts = shortcuts.filter((_, i) => i !== index);
      onChange(newShortcuts.join(','));
    }
  };

  const handleSaveShortcut = (hotkey: string) => {
    if (editingIndex !== null) {
      // Edit existing shortcut
      const newShortcuts = [...shortcuts];
      newShortcuts[editingIndex] = hotkey;
      onChange(newShortcuts.join(','));
    } else {
      // Add new shortcut
      const newShortcuts = [...shortcuts, hotkey];
      onChange(newShortcuts.join(','));
    }
    setShowRecordingDialog(false);
    setEditingIndex(null);
  };

  const handleCancelRecording = () => {
    setShowRecordingDialog(false);
    setEditingIndex(null);
  };

  const canAddMore = shortcuts.length < 3;

  return (
    <div className="flex items-center justify-between gap-3">
      <div className={`text-sm ${size === 'sm' ? 'text-xs' : ''} text-text-primary flex-1`}>{label}</div>
      <div className="flex flex-wrap items-center justify-end gap-2 flex-1 max-w-md">
        {shortcuts.length === 0 ? (
          <span className="text-xs text-text-tertiary">{t('settings.hotkeys.noShortcut')}</span>
        ) : (
          <>
            {shortcuts.map((shortcut, index) => (
              <div key={index} className="flex items-center gap-1.5 bg-bg-secondary-light border border-border-default rounded px-2 py-1 group">
                <span className="text-xs text-text-primary">{shortcut}</span>
                <div className="flex items-center gap-0.5 ml-1 border-l border-border-default pl-1">
                  <IconButton
                    icon={<FaEdit className="w-2.5 h-2.5" />}
                    onClick={() => handleEditShortcut(index)}
                    className="p-1 hover:text-text-primary"
                    tooltip={t('settings.hotkeys.editShortcut')}
                  />
                  <IconButton
                    icon={<FaTimes className="w-2.5 h-2.5" />}
                    onClick={() => handleClearShortcut(index)}
                    className="p-1 hover:text-text-primary"
                    tooltip={t('settings.hotkeys.clearShortcut')}
                  />
                </div>
              </div>
            ))}
          </>
        )}
        {canAddMore && (
          <IconButton
            icon={<FaPlus className="w-3 h-3 text-text-primary" />}
            onClick={handleAddShortcut}
            className="rounded-md p-2 hover:bg-bg-tertiary-emphasis ml-1"
            tooltip={t('settings.hotkeys.addShortcut')}
          />
        )}
      </div>

      {showRecordingDialog && (
        <RecordingDialog
          onSave={handleSaveShortcut}
          onCancel={handleCancelRecording}
          existingHotkey={editingIndex !== null ? shortcuts[editingIndex] : undefined}
        />
      )}
    </div>
  );
};

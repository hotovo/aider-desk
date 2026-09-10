import { ChangeEvent, FormEvent, KeyboardEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RiEyeLine, RiEyeOffLine } from 'react-icons/ri';
import { InputPromptData } from '@common/types';

import { BaseDialog } from '@/components/common/BaseDialog';
import { Button } from '@/components/common/Button';
import { Checkbox } from '@/components/common/Checkbox';
import { Input } from '@/components/common/Input';

type Props = {
  promptData: InputPromptData;
  onRespond: (id: string, value: string | null, rememberSession?: boolean) => void;
};

export const InputPromptModal = ({ promptData, onRespond }: Props) => {
  const { t } = useTranslation();
  const [value, setValue] = useState(promptData.defaultValue ?? '');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberSession, setRememberSession] = useState(false);

  const promptType = promptData.type ?? 'password';
  const isConfirmation = promptType === 'confirmation';

  const resolvedTitle = promptData.title ? t(promptData.title, { defaultValue: promptData.title, ...promptData.titleParams }) : t('common.inputPrompt');

  const resolvedMessage = promptData.message ? t(promptData.message, { defaultValue: promptData.message, ...promptData.messageParams }) : '';

  const resolvedPlaceholder = promptData.placeholder
    ? t(promptData.placeholder, { defaultValue: promptData.placeholder })
    : promptType === 'password'
      ? t('common.enterPassword')
      : undefined;

  const resolvedConfirmLabel = promptData.confirmLabel
    ? t(promptData.confirmLabel, { defaultValue: promptData.confirmLabel })
    : isConfirmation
      ? t('common.yes')
      : t('common.confirm');

  const resolvedCancelLabel = promptData.cancelLabel
    ? t(promptData.cancelLabel, { defaultValue: promptData.cancelLabel })
    : isConfirmation
      ? t('common.no')
      : t('common.cancel');

  const resolvedRememberLabel = promptData.rememberSessionLabel
    ? t(promptData.rememberSessionLabel, { defaultValue: promptData.rememberSessionLabel })
    : t('common.rememberSession');

  const handleClose = () => {
    onRespond(promptData.id, null);
  };

  const handleSubmit = (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    onRespond(promptData.id, value, rememberSession);
  };

  const handleConfirmChoice = (answer: string) => {
    onRespond(promptData.id, answer);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  };

  const handleToggleShowPassword = () => {
    setShowPassword((prev) => !prev);
  };

  const handleToggleRemember = (checked: boolean) => {
    setRememberSession(checked);
  };

  const footer = (
    <div className="flex justify-end gap-2 w-full">
      {isConfirmation ? (
        <>
          <Button color="tertiary" onClick={() => handleConfirmChoice('no')}>
            {resolvedCancelLabel}
          </Button>
          <Button color="primary" onClick={() => handleConfirmChoice('yes')}>
            {resolvedConfirmLabel}
          </Button>
        </>
      ) : (
        <>
          <Button variant="text" onClick={handleClose}>
            {resolvedCancelLabel}
          </Button>
          <Button color="primary" onClick={() => handleSubmit()}>
            {resolvedConfirmLabel}
          </Button>
        </>
      )}
    </div>
  );

  return (
    <BaseDialog title={resolvedTitle} onClose={handleClose} footer={footer} width={500} closeOnEscape={true}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {resolvedMessage && <div className="text-sm text-text-primary whitespace-pre-wrap break-words">{resolvedMessage}</div>}

        {!isConfirmation && (
          <div className="relative w-full flex items-center">
            <Input
              autoFocus
              wrapperClassName="w-full"
              className={promptType === 'password' ? 'w-full pr-10' : 'w-full'}
              type={promptType === 'password' && !showPassword ? 'password' : 'text'}
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={resolvedPlaceholder}
            />
            {promptType === 'password' && (
              <button
                type="button"
                tabIndex={-1}
                aria-label={showPassword ? t('common.hidePassword') : t('common.showPassword')}
                onClick={handleToggleShowPassword}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors focus:outline-none flex items-center justify-center"
              >
                {showPassword ? <RiEyeOffLine size={18} /> : <RiEyeLine size={18} />}
              </button>
            )}
          </div>
        )}

        {promptData.allowRememberSession && (
          <div className="pt-1">
            <Checkbox checked={rememberSession} onChange={handleToggleRemember} label={resolvedRememberLabel} size="sm" />
          </div>
        )}
      </form>
    </BaseDialog>
  );
};

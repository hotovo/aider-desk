import { MouseEvent, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { BiCheck, BiCopy, BiErrorCircle } from 'react-icons/bi';

import { Button } from '@/components/common/Button';

type Props = {
  error: Error | null;
};

export const AppCrashFallback = ({ error }: Props) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleReload = () => {
    window.location.reload();
  };

  const handleCopy = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!error) {
      return;
    }
    try {
      await navigator.clipboard.writeText(error.stack || error.message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (copyError) {
      // eslint-disable-next-line no-console
      console.error('Failed to copy to clipboard:', copyError);
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-bg-primary text-text-primary p-8">
      <BiErrorCircle className="w-12 h-12 text-text-error" />
      <h1 className="text-lg font-semibold">{t('errors.appCrash.title', 'Something went wrong')}</h1>
      <p className="text-sm text-text-muted text-center max-w-md">
        {t('errors.appCrash.message', 'An unexpected error occurred and the application could not continue.')}
      </p>
      <p className="text-sm text-text-muted text-center max-w-md">
        <Trans
          i18nKey="errors.appCrash.reportIssue"
          defaults="Please, consider reporting an issue at <a>https://github.com/hotovo/aider-desk/issues</a>. Thank you."
          components={{
            a: <a href="https://github.com/hotovo/aider-desk/issues" target="_blank" rel="noopener noreferrer" className="text-info-lighter hover:underline" />,
          }}
        />
      </p>
      <Button onClick={handleReload}>{t('errors.appCrash.reload', 'Reload')}</Button>
      {error && (
        <details className="max-w-2xl w-full mt-4 border border-border-default rounded p-3">
          <summary className="text-xs text-text-muted cursor-pointer select-none">
            {t('errors.appCrash.details', 'Error details')}
            <button
              type="button"
              onClick={handleCopy}
              title={copied ? t('errors.appCrash.copied', 'Copied!') : t('errors.appCrash.copy', 'Copy')}
              className="float-right text-text-muted hover:text-text-tertiary cursor-pointer focus:outline-none"
            >
              {copied ? <BiCheck className="w-4 h-4" /> : <BiCopy className="w-4 h-4" />}
            </button>
          </summary>
          <pre className="mt-2 p-3 text-xs text-text-muted bg-bg-secondary rounded overflow-auto max-h-64 whitespace-pre-wrap break-words scrollbar-thin scrollbar-track-bg-secondary-light scrollbar-thumb-bg-fourth scrollbar-thumb-rounded-full">
            {error.stack || error.message}
          </pre>
        </details>
      )}
    </div>
  );
};

import { useTranslation } from 'react-i18next';

type Props = {
  udiff?: string;
  oldValue?: string;
  newValue?: string;
};

export const DiffFallback = ({ udiff, oldValue, newValue }: Props) => {
  const { t } = useTranslation();
  const className = 'whitespace-pre-wrap break-words m-0 text-2xs font-mono';

  if (udiff !== undefined) {
    return <pre className={className}>{udiff}</pre>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-xs text-text-secondary">{t('diffViewer.oldValue')}</h3>
        <pre className={className}>{oldValue}</pre>
      </div>
      <div>
        <h3 className="text-xs text-text-secondary">{t('diffViewer.newValue')}</h3>
        <pre className={className}>{newValue}</pre>
      </div>
    </div>
  );
};

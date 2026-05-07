import { AIDER_MODES, Mode } from '@common/types';
import { useTranslation } from 'react-i18next';

type Props = {
  mode: Mode;
};

export const EmptyContextInfo = ({ mode }: Props) => {
  const { t } = useTranslation();
  const isAiderMode = AIDER_MODES.includes(mode);

  return (
    <div className="absolute inset-0 flex items-center justify-center p-4">
      <div className="text-center text-text-muted text-2xs max-w-[280px] space-y-2">
        <p className="font-medium text-text-secondary">{t('contextFiles.empty.title')}</p>
        {isAiderMode ? (
          <>
            <p>{t('contextFiles.empty.aiderMode.description')}</p>
            <p className="text-text-tertiary italic">{t('contextFiles.empty.aiderMode.hint')}</p>
          </>
        ) : (
          <>
            <p>{t('contextFiles.empty.agentMode.description')}</p>
            <p className="mt-1">{t('contextFiles.empty.agentMode.includeContextFiles')}</p>
            <p className="text-text-tertiary italic">{t('contextFiles.empty.agentMode.hint')}</p>
          </>
        )}
      </div>
    </div>
  );
};

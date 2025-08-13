import { useTranslation } from 'react-i18next';

// @ts-expect-error TypeScript is not aware of asset import
import icon from '../../../../../resources/icon.png?asset';

type Props = {
  onOpenProject: () => void;
};

export const NoProjectsOpen = ({ onOpenProject }: Props) => {
  const { t } = useTranslation();
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-text-muted-light">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-4">
          <img src={icon} alt="Aider Desk" className="h-16 w-16" />
        </div>
        <h2 className="text-xl font-medium mb-4 uppercase ">
          {t('noProjectsOpen.welcome')} <span className="text-text-primary font-bold">Aider Desk</span>
        </h2>
        <p className="text-text-muted-light mb-6 text-sm">{t('noProjectsOpen.description')}</p>
        <div className="space-y-4">
          <button
            className="px-6 py-3 border border-border-default rounded hover:bg-bg-tertiary-emphasis hover:text-text-secondary transition-colors duration-200 text-md font-medium mb-4 text-text-secondary"
            onClick={onOpenProject}
          >
            {t('common.openProject')}
          </button>
          <p className="text-xs text-text-muted">{t('tips.multipleProjects')}</p>
        </div>
      </div>
    </div>
  );
};

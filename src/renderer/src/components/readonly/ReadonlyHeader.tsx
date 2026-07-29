import { ReadonlyProjectData } from '@common/types';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';

// @ts-expect-error TypeScript is not aware of asset import
import icon from '../../../../../resources/icon.png?asset';

import { ExtensionComponentWrapper } from '@/components/extensions/ExtensionComponentWrapper';
import { getProjectTabClassName, ProjectTabContent } from '@/components/project/ProjectTabContent';

type Props = {
  projects: ReadonlyProjectData[];
  projectDir: string;
  onSelectProject: (projectDir: string) => void;
};

export const ReadonlyHeader = ({ projects, projectDir, onSelectProject }: Props) => {
  const { t } = useTranslation();

  return (
    <header className="shrink-0 border-b border-border-dark-light bg-bg-primary-light flex items-stretch overflow-hidden">
      <div className="flex items-center gap-2 px-4 shrink-0 border-r border-border-dark-light bg-bg-primary">
        <img src={icon} alt="AiderDesk" className="h-5 w-5" />
        <span className="font-bold text-sm text-text-primary">AiderDesk</span>
      </div>
      <nav className="flex-1 min-w-0 flex items-stretch overflow-x-auto scrollbar-none" aria-label={t('readonly.projects')}>
        {projects.map((project) => {
          const isActive = project.baseDir === projectDir;
          return (
            <button
              type="button"
              key={project.baseDir}
              className={clsx(getProjectTabClassName(isActive), 'pr-3')}
              onClick={() => onSelectProject(project.baseDir)}
            >
              <ProjectTabContent baseDir={project.baseDir} isActive={isActive} />
            </button>
          );
        })}
      </nav>
      <ExtensionComponentWrapper placement="header-left" />
      <ExtensionComponentWrapper placement="header-right" />
    </header>
  );
};

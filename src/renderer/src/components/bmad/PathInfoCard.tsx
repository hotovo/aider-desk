import { useTranslation } from 'react-i18next';
import { FiLayers, FiZap } from 'react-icons/fi';
import { clsx } from 'clsx';

type PathType = 'full' | 'quick';

type Props = {
  pathType: PathType;
};

export const PathInfoCard = ({ pathType }: Props) => {
  const { t } = useTranslation();

  const isFullWorkflow = pathType === 'full';
  const Icon = isFullWorkflow ? FiLayers : FiZap;

  const useCases = isFullWorkflow
    ? [
        t('bmad.pathInfo.fullWorkflow.useCases.newProject'),
        t('bmad.pathInfo.fullWorkflow.useCases.complexFeature'),
        t('bmad.pathInfo.fullWorkflow.useCases.unclearRequirements'),
        t('bmad.pathInfo.fullWorkflow.useCases.teamCollaboration'),
      ]
    : [
        t('bmad.pathInfo.quickFlow.useCases.bugFixes'),
        t('bmad.pathInfo.quickFlow.useCases.smallFeatures'),
        t('bmad.pathInfo.quickFlow.useCases.refactoring'),
        t('bmad.pathInfo.quickFlow.useCases.wellDefined'),
      ];

  return (
    <div className={clsx('border rounded-md p-4 bg-bg-primary-light-strong', 'border-border-dark-light')}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 p-2 bg-bg-tertiary rounded-md">
          <Icon className="w-5 h-5 text-text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-text-primary mb-1">
            {isFullWorkflow ? t('bmad.pathInfo.fullWorkflow.title') : t('bmad.pathInfo.quickFlow.title')}
          </h3>
          <p className="text-xs text-text-secondary leading-relaxed mb-3">
            {isFullWorkflow ? t('bmad.pathInfo.fullWorkflow.description') : t('bmad.pathInfo.quickFlow.description')}
          </p>
          <div>
            <p className="text-2xs font-medium text-text-tertiary uppercase mb-1.5">
              {isFullWorkflow ? t('bmad.pathInfo.fullWorkflow.whenToUse') : t('bmad.pathInfo.quickFlow.whenToUse')}
            </p>
            <ul className="grid grid-cols-2 gap-x-2 gap-y-1">
              {useCases.map((useCase, index) => (
                <li key={index} className="text-2xs text-text-secondary flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-accent-primary flex-shrink-0" />
                  {useCase}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

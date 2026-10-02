import { HiOutlineCpuChip, HiOutlineCommandLine } from 'react-icons/hi2';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';

export type OnboardingPath = 'agent' | 'aider';

type PathOption = {
  path: OnboardingPath;
  icon: ReactNode;
  title: string;
  subtitle: string;
  description: string;
  features: readonly string[];
  modeLabel: string;
};

type Props = {
  selectedPath: OnboardingPath | null;
  onSelectPath: (path: OnboardingPath) => void;
};

export const OnboardingPathChoice = ({ selectedPath, onSelectPath }: Props) => {
  const { t } = useTranslation();

  const options: PathOption[] = [
    {
      path: 'agent',
      icon: <HiOutlineCpuChip className="w-6 h-6" />,
      title: t('onboarding.choice.agent.title'),
      subtitle: t('onboarding.choice.agent.subtitle'),
      description: t('onboarding.choice.agent.description'),
      features: [t('onboarding.choice.agent.feature1'), t('onboarding.choice.agent.feature2'), t('onboarding.choice.agent.feature3')],
      modeLabel: t('onboarding.choice.agent.modeLabel'),
    },
    {
      path: 'aider',
      icon: <HiOutlineCommandLine className="w-6 h-6" />,
      title: t('onboarding.choice.aider.title'),
      subtitle: t('onboarding.choice.aider.subtitle'),
      description: t('onboarding.choice.aider.description'),
      features: [t('onboarding.choice.aider.feature1'), t('onboarding.choice.aider.feature2'), t('onboarding.choice.aider.feature3')],
      modeLabel: t('onboarding.choice.aider.modeLabel'),
    },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-text-primary uppercase">{t('onboarding.choice.title')}</h2>
      <p className="text-text-tertiary text-sm">{t('onboarding.choice.description')}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        {options.map((option) => {
          const isSelected = selectedPath === option.path;
          return (
            <button
              key={option.path}
              type="button"
              onClick={() => onSelectPath(option.path)}
              className={clsx(
                'relative flex flex-col items-start rounded-lg border p-4 text-left transition-colors duration-200',
                isSelected ? 'border-info-light-emphasis bg-info-subtle' : 'border-border-default bg-bg-secondary hover:border-border-default-dark',
              )}
            >
              {option.path === 'agent' && (
                <span className="absolute top-3 right-3 text-3xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded bg-success-subtle text-success">
                  {t('onboarding.choice.recommended')}
                </span>
              )}

              <span className={clsx('flex items-center gap-3 mb-3', isSelected ? 'text-info-lighter' : 'text-text-secondary')}>
                {option.icon}
                <span>
                  <span className="block font-semibold text-text-primary">{option.title}</span>
                  <span className="block text-3xs text-text-muted uppercase tracking-wide">{option.subtitle}</span>
                </span>
              </span>

              <span className="text-sm text-text-tertiary mb-3">{option.description}</span>

              <ul className="space-y-1.5 mb-4">
                {option.features.map((feature) => (
                  <li key={feature} className="relative pl-4 text-xs text-text-secondary">
                    <span className="absolute left-0 top-[7px] w-1 h-1 rounded-full bg-agent-power-tools"></span>
                    {feature}
                  </li>
                ))}
              </ul>

              <span
                className={clsx(
                  'mt-auto font-mono text-3xs px-2 py-1 rounded border',
                  isSelected ? 'border-info-light-emphasis text-info-lightest' : 'border-border-default text-text-muted',
                )}
              >
                {option.modeLabel}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

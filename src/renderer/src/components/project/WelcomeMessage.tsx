import { RiRobot2Line } from 'react-icons/ri';
import { useTranslation } from 'react-i18next';
import { FiCode, FiFile, FiLayers, FiTerminal, FiArrowRight } from 'react-icons/fi';
import { CgTerminal } from 'react-icons/cg';
import { clsx } from 'clsx';

// @ts-expect-error TypeScript is not aware of asset import
import icon from '../../../../../resources/icon.png?asset';

import type { Mode } from '@common/types';

import { useExtensionComponentsWrapper } from '@/components/extensions/useExtensionComponentsWrapper';

type Props = {
  onModeChange?: (mode: Mode) => void;
  mode?: Mode;
  projectDir?: string;
  taskId?: string;
};

export const WelcomeMessage = ({ onModeChange, mode: _mode, projectDir, taskId: _taskId }: Props) => {
  const { t } = useTranslation();

  const { isEmpty: isEmptyWelcomePage, renderComponents: renderWelcomePageComponents } = useExtensionComponentsWrapper({
    placement: 'welcome-page',
    additionalProps: {
      projectDir,
    },
  });

  const features = [
    { icon: FiCode, key: 'aiCoding' },
    { icon: FiFile, key: 'contextManagement' },
    { icon: FiLayers, key: 'multiModel' },
    { icon: FiTerminal, key: 'commands' },
  ];

  const modes = [
    {
      icon: RiRobot2Line,
      key: 'agent',
      value: 'agent' as Mode,
      iconBg: 'bg-success-subtle',
      iconColor: 'text-success',
      borderHover: 'hover:border-success',
    },
    {
      icon: CgTerminal,
      key: 'code',
      value: 'code' as Mode,
      iconBg: 'bg-info-subtle',
      iconColor: 'text-info',
      borderHover: 'hover:border-info',
    },
  ];

  const tips = ['addFiles', 'askQuestion', 'useCommands', 'switchMode'];

  const handleModeClick = (mode: Mode) => {
    onModeChange?.(mode);
  };

  if (!isEmptyWelcomePage) {
    return (
      <div className="absolute inset-0 text-text-muted-light overflow-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-tertiary py-4 px-4">
        <div className="w-full h-full flex flex-col gap-2">{renderWelcomePageComponents()}</div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 text-text-muted-light overflow-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-tertiary py-4 px-4">
      <div className="text-center max-w-3xl w-full mx-auto">
        <div className="mb-8">
          <img src={icon} alt="AiderDesk" className="h-14 w-14 mx-auto" />
          <h1 className="text-2xl font-bold text-text-primary mb-2">{t('welcomeMessage.title')}</h1>
          <p className="text-sm text-text-secondary">{t('welcomeMessage.subtitle')}</p>
        </div>

        <div className="mb-8">
          <h2 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-4">{t('welcomeMessage.features.title')}</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {features.map(({ icon: Icon, key }) => (
              <div
                key={key}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-secondary border border-border-dark-light text-text-secondary text-xs"
              >
                <Icon className="w-3.5 h-3.5 text-accent-primary flex-shrink-0" />
                <span>{t(`welcomeMessage.features.${key}`)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-4">{t('welcomeMessage.modes.title')}</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {modes.map(({ icon: Icon, key, value, iconBg, iconColor, borderHover }) => (
              <div
                key={key}
                onClick={() => handleModeClick(value)}
                className={clsx(
                  'group relative overflow-hidden rounded-xl border border-border-dark-light bg-bg-primary-light-strong p-4 cursor-pointer transition-all duration-300 hover:scale-105 flex flex-col md:max-w-[300px]',
                  borderHover,
                  'hover:bg-bg-secondary',
                )}
              >
                <div className="flex items-center justify-center gap-2 mb-3">
                  <div className={clsx('p-2 rounded-lg transition-colors duration-300', iconBg, iconColor)}>
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-text-primary mb-1.5">{t(`welcomeMessage.modes.${key}.title`)}</h3>
                <p className="text-2xs text-text-secondary leading-relaxed flex-1">{t(`welcomeMessage.modes.${key}.description`)}</p>
                <div className="flex items-center justify-center gap-1 text-2xs text-text-primary group-hover:text-text-secondary transition-colors mt-3">
                  <span>{t('welcomeMessage.selectMode')}</span>
                  <FiArrowRight className="w-3 h-3 transform group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-4">{t('welcomeMessage.tips.title')}</h2>
          <div className="inline-flex flex-col items-start gap-2 text-xs bg-bg-secondary rounded-lg p-4 border border-border-dark-light">
            {tips.map((tip) => (
              <div key={tip} className="flex items-center gap-2 text-text-secondary">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-primary flex-shrink-0" />
                <span>{t(`welcomeMessage.tips.${tip}`)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

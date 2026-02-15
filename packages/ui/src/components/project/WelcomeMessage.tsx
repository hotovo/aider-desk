import { RiRobot2Line } from 'react-icons/ri';
import { useTranslation } from 'react-i18next';
import { FiCode, FiFile, FiLayers, FiTerminal } from 'react-icons/fi';
import { CgTerminal } from 'react-icons/cg';

// @ts-expect-error TypeScript is not aware of asset import
import icon from '../../../../../resources/icon.png?asset';

import type { Mode } from '@aider-desk/common/types';

import { BmadWorkflowPage } from '@/components/bmad/BmadWorkflowPage';

type Props = {
  onModeChange?: (mode: Mode) => void;
  mode?: Mode;
  projectDir?: string;
  taskId?: string;
};

export const WelcomeMessage = ({ onModeChange, mode, projectDir, taskId }: Props) => {
  const { t } = useTranslation();

  const features = [
    { icon: FiCode, key: 'aiCoding' },
    { icon: FiFile, key: 'contextManagement' },
    { icon: FiLayers, key: 'multiModel' },
    { icon: FiTerminal, key: 'commands' },
  ];

  const modes = [
    { icon: RiRobot2Line, key: 'agent', value: 'agent' as Mode },
    { icon: CgTerminal, key: 'code', value: 'code' as Mode },
  ];

  const tips = ['addFiles', 'askQuestion', 'useCommands', 'switchMode'];

  const handleModeClick = (mode: Mode) => {
    onModeChange?.(mode);
  };

  if (mode === 'bmad') {
    return <BmadWorkflowPage projectDir={projectDir} taskId={taskId} />;
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-text-muted-light overflow-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-tertiary">
      <div className="text-center max-w-2xl h-full pt-10 px-4">
        <img src={icon} alt="AiderDesk" className="h-20 w-20 mx-auto mb-2 opacity-90" />

        <h1 className="text-xl font-semibold text-text-primary mb-2">{t('welcomeMessage.title')}</h1>
        <p className="text-sm text-text-secondary mb-10">{t('welcomeMessage.subtitle')}</p>

        <div className="mb-8">
          <h2 className="text-sm font-semibold text-text-primary mb-3">{t('welcomeMessage.features.title')}</h2>
          <div className="space-y-2">
            {features.map(({ icon: Icon, key }) => (
              <div key={key} className="flex items-center justify-center gap-3 text-text-secondary text-xs">
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{t(`welcomeMessage.features.${key}`)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-sm font-semibold text-text-primary mb-3">{t('welcomeMessage.modes.title')}:</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {modes.map(({ icon: Icon, key, value }) => (
              <div
                key={key}
                onClick={() => handleModeClick(value)}
                className="bg-bg-primary-light-strong border border-border-dark-light rounded-md p-3 text-xs cursor-pointer hover:scale-105 hover:border-border-primary transition-all duration-200"
              >
                <div className="flex items-center justify-center gap-2 mb-2 text-text-primary font-semibold">
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{t(`welcomeMessage.modes.${key}.title`)}</span>
                </div>
                <p className="text-2xs text-text-secondary leading-relaxed">{t(`welcomeMessage.modes.${key}.description`)}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-text-primary mb-3">{t('welcomeMessage.tips.title')}</h2>
          <div className="space-y-2 text-xs">
            {tips.map((tip) => (
              <div key={tip} className="flex items-start justify-center gap-2 text-text-secondary">
                <span className="mt-0.5">•</span>
                <span>{t(`welcomeMessage.tips.${tip}`)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

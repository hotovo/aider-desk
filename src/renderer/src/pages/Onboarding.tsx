import { useState } from 'react';
import { t, getTranslatedLanguageOptions } from '@/utils/i18n';
import { HiArrowRight } from 'react-icons/hi2';
import { useNavigate } from 'react-router-dom';

import { useSettings } from '@/context/SettingsContext';
import { AiderSettings } from '@/components/settings/AiderSettings';
import { Select } from '@/components/common/Select';

export const Onboarding = () => {
  const navigate = useNavigate();
  const { settings, saveSettings } = useSettings();
  const [step, setStep] = useState(1);

  const handleLanguageChange = (newLanguage: string) => {
    // 保存设置到存储
    saveSettings({
      ...settings!,
      language: newLanguage as 'en' | 'zh',
    });
    
    // 立即应用新的语言设置，不需要刷新页面
    import('@/utils/i18n').then(({ setCurrentLanguage }) => {
      setCurrentLanguage(newLanguage as 'en' | 'zh');
    });
  };

  const handleNext = async () => {
    if (step === 2) {
      await saveSettings({
        ...settings!,
        onboardingFinished: true,
      });
      navigate('/home');
    } else {
      setStep(step + 1);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="flex flex-col space-y-4">
            <h1 className="text-xl font-bold text-neutral-100 uppercase">{t('Welcome to Aider Desk')}</h1>
            <p className="text-neutral-300 text-sm">
              {t('Aider Desk is your desktop companion for AI-assisted coding. This application brings the power of Aider\'s AI coding assistant to a user-friendly interface, helping you:')}
            </p>
            <ul className="list-disc list-inside text-neutral-300 space-y-2 text-sm">
              <li>{t('Manage multiple coding projects')}</li>
              <li>{t('Track your AI usage and costs')}</li>
              <li>{t('Interact with AI models in a structured way')}</li>
              <li>{t('Visualize and manage your code files')}</li>
            </ul>
            <p className="text-neutral-300 text-sm">{t('Let\'s get started by configuring your Aider settings.')}</p>
            
            {/* 添加语言选择下拉菜单 */}
            <div className="mt-4">
              <Select
                label="Language / 语言"
                value={settings?.language || 'en'}
                onChange={handleLanguageChange}
                options={getTranslatedLanguageOptions()}
                className="w-48"
              />
              <p className="text-xs text-neutral-400 mt-1">
                {t('Select your preferred language')}
              </p>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-neutral-100 uppercase">{t('Aider Configuration')}</h2>
            <p className="text-neutral-300 text-sm">{t('To get started, please configure your Aider settings. You\'ll need to:')}</p>
            <ul className="list-disc list-inside text-neutral-300 space-y-2 text-sm">
              <li>{t('Add your API keys for the LLM provider you want to use')}</li>
              <li>{t('Set any additional options for Aider')}</li>
            </ul>
            <p className="text-neutral-300 text-sm">{t('You can also do that later in the Settings menu.')}</p>
            <AiderSettings settings={settings!} setSettings={saveSettings} />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-screen p-[4px] bg-gradient-to-b from-neutral-950 to-neutral-900 overflow-y-auto">
      <div className="flex flex-col flex-1 border-2 border-neutral-600">
        <div className="flex-1 flex flex-col justify-center items-center p-4">
          <div className="max-w-2xl w-full">
            {renderStep()}
            <div className="mt-10 flex justify-center">
              <button onClick={handleNext} className="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 flex items-center gap-2">
                {step === 2 ? t('Complete Setup') : t('Next')}
                <HiArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import { useState } from 'react';
import { HiArrowRight } from 'react-icons/hi2';
import { ROUTES } from '@/utils/routes';
import { useTranslation } from 'react-i18next';

import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';

import { useSettings } from '@/context/SettingsContext';
import { AiderSettings } from '@/components/settings/AiderSettings';

export const Onboarding = () => {
  const { t } = useTranslation();
  const { settings, saveSettings } = useSettings();
  const [step, setStep] = useState(1);

  const handleNext = async () => {
    if (step === 2) {
      try {
        console.log('Finishing setup: Saving settings with onboardingFinished=true');
        // Save the settings first, which will trigger the useEffect in LanguageSwitcher to apply the language change
        await saveSettings({
          ...settings!,
          onboardingFinished: true,
        });
        console.log('Settings saved successfully, navigating to Home');
        
        // Use window.location.hash for navigation in HashRouter context
        console.log('Using window.location.hash for navigation in Electron with HashRouter');
        // Wait for settings to be saved before navigation
        setTimeout(() => {
          // In HashRouter, we need to use hash-based navigation
          console.log(`Redirecting to: ${ROUTES.Home}`);
          window.location.hash = ROUTES.Home;
        }, 300); // Add delay to ensure settings are fully saved
      } catch (error) {
        console.error('Error during finish setup:', error);
        alert('Failed to save settings. Please try again!');
      }
    } else {
      setStep(step + 1);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="flex flex-col space-y-4">
            <h1 className="text-xl font-bold text-neutral-100 uppercase">{t('onboarding.title')}</h1>
            <p className="text-neutral-300 text-sm">
              {t('onboarding.description')}
            </p>
            <ul className="list-disc list-inside text-neutral-300 space-y-2 text-sm">
              <li>{t('onboarding.features.1')}</li>
              <li>{t('onboarding.features.2')}</li>
              <li>{t('onboarding.features.3')}</li>
              <li>{t('onboarding.features.4')}</li>
            </ul>
            <p className="text-neutral-300 text-sm">{t('onboarding.getStarted')}</p>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-neutral-100 uppercase">{t('settings.general')}</h2>
            <p className="text-neutral-300 text-sm">{t('onboarding.configureSettings')}</p>
            <ul className="list-disc list-inside text-neutral-300 space-y-2 text-sm">
              <li>{t('onboarding.setupSteps.1')}</li>
              <li>{t('onboarding.setupSteps.2')}</li>
            </ul>
            <p className="text-neutral-300 text-sm">{t('onboarding.configureLater')}</p>
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
        <div className="absolute top-4 right-4">
          <LanguageSwitcher />
        </div>
        <div className="flex-1 flex flex-col justify-center items-center p-4">
          <div className="max-w-2xl w-full">
            {renderStep()}
            <div className="mt-10 flex justify-center">
              <button onClick={handleNext} className="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 flex items-center gap-2">
                {step === 2 ? t('onboarding.finish') : t('common.next')}
                <HiArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

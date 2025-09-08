import { useCallback, useEffect, useState } from 'react';
import { HiArrowRight, HiArrowLeft } from 'react-icons/hi2';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SettingsData } from '@common/types';

import { useSettings } from '@/context/SettingsContext';
import { AiderSettings } from '@/components/settings/AiderSettings';
import { LanguageSelector } from '@/components/settings/LanguageSelector';
import { ModelProvidersSettings } from '@/components/settings/ModelProvidersSettings';
import { AgentSettings } from '@/components/settings/agent/AgentSettings';
import { Button } from '@/components/common/Button';
import { OnboardingStepper } from '@/components/onboarding/OnboardingStepper';
import { ROUTES } from '@/utils/routes';
import { showErrorNotification, showInfoNotification } from '@/utils/notifications';

export const Onboarding = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { settings: originalSettings, saveSettings } = useSettings();
  const [localSettings, setLocalSettings] = useState<SettingsData | null>(originalSettings);
  const [step, setStep] = useState(1);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (originalSettings) {
      setLocalSettings(originalSettings);
    }
  }, [originalSettings]);

  const steps = [
    { title: t('onboarding.steps.welcome') },
    { title: t('onboarding.steps.connectModel') },
    { title: t('onboarding.steps.aider') },
    { title: t('onboarding.steps.agent') },
  ];

  const handleNext = async () => {
    if (isNavigating || isSaving) {
      return;
    }

    try {
      setIsNavigating(true);

      if (step < 5) {
        setStep(step + 1);
      } else {
        await handleFinish();
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Navigation error:', error);
      showErrorNotification(t('onboarding.errors.navigationFailed'));
    } finally {
      setIsNavigating(false);
    }
  };

  const handleBack = () => {
    if (isNavigating || isSaving || step <= 1) {
      return;
    }

    try {
      setIsNavigating(true);
      setStep(step - 1);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Navigation error:', error);
      showErrorNotification(t('onboarding.errors.navigationFailed'));
    } finally {
      setIsNavigating(false);
    }
  };

  const handleFinish = async () => {
    if (isSaving || isNavigating) {
      return;
    }

    try {
      setIsSaving(true);

      if (!localSettings) {
        throw new Error('Settings not available');
      }

      await saveSettings({
        ...localSettings,
        onboardingFinished: true,
      });

      showInfoNotification(t('onboarding.complete.success'));
      navigate(ROUTES.Home);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to finish onboarding:', error);
      showErrorNotification(t('onboarding.errors.finishFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleLanguageChange = useCallback(
    async (language: string) => {
      const newSettings = { ...localSettings!, language };
      setLocalSettings(newSettings);
      await saveSettings(newSettings);
    },
    [saveSettings, localSettings],
  );

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="flex flex-col space-y-4 relative">
            {/* Language Selector in top-right corner */}
            <div className="absolute top-0 right-0">
              <LanguageSelector language={localSettings?.language || 'en'} onChange={handleLanguageChange} hideLabel />
            </div>

            <h1 className="text-xl font-bold text-text-primary uppercase">{t('onboarding.title')}</h1>
            <p className="text-text-tertiary text-sm">{t('onboarding.description')}</p>
            <ul className="list-disc list-inside text-text-tertiary space-y-2 text-sm">
              <li>{t('onboarding.features.1')}</li>
              <li>{t('onboarding.features.2')}</li>
              <li>{t('onboarding.features.3')}</li>
              <li>{t('onboarding.features.4')}</li>
              <li>{t('onboarding.features.5')}</li>
            </ul>
            <p className="text-text-tertiary text-sm">{t('onboarding.getStarted')}</p>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-text-primary uppercase">{t('onboarding.providers.connectTitle')}</h2>
            <p className="text-text-tertiary text-sm">{t('onboarding.providers.connectDescription')}</p>
            <ModelProvidersSettings settings={localSettings!} setSettings={setLocalSettings} showProminentModels={true} />
            <div className="mt-4 p-3 bg-info-subtle rounded-lg border border-info-light-emphasis">
              <p className="text-xs text-info-lightest">{t('onboarding.providers.advancedUsersNote')}</p>
            </div>
            <div className="flex justify-center mt-4">
              <button
                onClick={handleNext}
                disabled={isNavigating || isSaving}
                className="text-sm text-text-muted-light hover:text-text-secondary underline transition-colors duration-200"
              >
                {t('onboarding.skipForNow')}
              </button>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-text-primary uppercase !mb-4">{t('onboarding.aider.fineTuneTitle')}</h2>
            <div className="p-3 bg-info-subtle rounded-lg border border-info-light-emphasis">
              <p className="text-xs text-info-lightest">{t('onboarding.aider.fineTuneNote')}</p>
            </div>
            <AiderSettings settings={localSettings!} setSettings={setLocalSettings} initialShowEnvVars={true} />
          </div>
        );
      case 4:
        return (
          <div className="space-y-6">
            <div className="">
              <h2 className="text-xl font-bold text-text-primary uppercase">{t('onboarding.agent.title')}</h2>
              <p className="text-text-tertiary text-sm mt-2">{t('onboarding.agent.description')}</p>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-text-primary">{t('onboarding.agent.capabilities')}</h3>
              <ul className="space-y-3">
                <li className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-info-lighter rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <span className="text-text-primary font-medium">{t('onboarding.agent.autonomousPlanning')}</span>
                    <p className="text-text-tertiary text-sm">{t('onboarding.agent.autonomousPlanningDesc')}</p>
                  </div>
                </li>
                <li className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-success-light rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <span className="text-text-primary font-medium">{t('onboarding.agent.toolUse')}</span>
                    <p className="text-text-tertiary text-sm">{t('onboarding.agent.toolUseDesc')}</p>
                  </div>
                </li>
                <li className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-agent-power-tools rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <span className="text-text-primary font-medium">{t('onboarding.agent.extensible')}</span>
                    <p className="text-text-tertiary text-sm">{t('onboarding.agent.extensibleDesc')}</p>
                  </div>
                </li>
              </ul>
            </div>

            <div className="flex flex-col items-center space-y-5 pt-4">
              <Button onClick={handleNext} className="gap-2" disabled={isNavigating || isSaving} size="sm" color="secondary">
                {isNavigating ? t('common.loading') : t('onboarding.agent.configureAgent')}
                {!isNavigating && <HiArrowRight className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        );
      case 5:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-text-primary uppercase">{t('onboarding.agent.configureTitle')}</h2>
            <p className="text-text-tertiary text-sm">{t('onboarding.agent.configureDescription')}</p>
            <AgentSettings settings={localSettings!} setSettings={setLocalSettings} />
          </div>
        );
      case 6:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-text-primary uppercase">{t('onboarding.complete.title')}</h2>
            <p className="text-text-tertiary text-sm">{t('onboarding.complete.description')}</p>
            <p className="text-text-tertiary text-sm">{t('onboarding.complete.ready')}</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full p-[4px] bg-bg-secondary">
      <div className="flex flex-col flex-1 border-2 border-border-default relative overflow-y-auto scrollbar-thin scrollbar-track-bg-secondary scrollbar-thumb-bg-tertiary hover:scrollbar-thumb-bg-fourth">
        <div className="flex-1 flex flex-col justify-center items-center p-4">
          <div className="max-w-3xl w-full">
            {/* Stepper */}
            <div className="mb-8">
              <OnboardingStepper steps={steps} currentStep={step === 5 ? 4 : step} />
            </div>

            {/* Step Content */}
            {renderStep()}

            {/* Navigation Buttons */}
            <div className="mt-10 flex justify-between">
              <div>
                {step > 1 && (
                  <Button onClick={handleBack} variant="outline" color="secondary" className="gap-2" disabled={isNavigating || isSaving}>
                    <HiArrowLeft className="w-4 h-4" />
                    {t('common.back')}
                  </Button>
                )}
              </div>
              {step !== 4 && step !== 5 && (
                <Button onClick={handleNext} className="gap-2" disabled={isNavigating || isSaving}>
                  {isNavigating || isSaving ? t('common.loading') : step === 6 ? t('onboarding.finish') : t('common.next')}
                  {!(isNavigating || isSaving) && <HiArrowRight className="w-4 h-4" />}
                </Button>
              )}
              {(step === 4 || step === 5) && (
                <div className="flex gap-3">
                  <Button onClick={handleFinish} className="gap-2" disabled={isNavigating || isSaving}>
                    {isSaving ? t('common.loading') : t('onboarding.finish')}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

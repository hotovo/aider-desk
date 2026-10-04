import { useCallback, useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { HiArrowRight, HiArrowLeft } from 'react-icons/hi2';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isEqual } from 'lodash';
import { DEFAULT_AGENT_PROFILE, DEFAULT_PROVIDER_MODELS } from '@common/agent';
import { SettingsData } from '@common/types';

import { useSaveSettings, useSettingsStore } from '@/stores/settingsStore';
import { useAgents } from '@/contexts/AgentsContext';
import { useModelProviders } from '@/contexts/ModelProviderContext';
import { AiderSettings } from '@/components/settings/AiderSettings';
import { LanguageSelector } from '@/components/settings/LanguageSelector';
import { OnboardingProviderSetup } from '@/components/onboarding/OnboardingProviderSetup';
import { OnboardingPathChoice, OnboardingPath } from '@/components/onboarding/OnboardingPathChoice';
import { AgentSettings } from '@/components/settings/agent/AgentSettings';
import { Button } from '@/components/common/Button';
import { OnboardingStepper } from '@/components/onboarding/OnboardingStepper';
import { ROUTES } from '@/utils/routes';
import { showErrorNotification, showInfoNotification } from '@/utils/notifications';

export const Onboarding = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const originalSettings = useSettingsStore((state) => state.settings);
  const saveSettings = useSaveSettings();
  const { profiles: originalAgentProfiles, createProfile, updateProfile, deleteProfile, updateProfilesOrder } = useAgents();
  const { providers, models } = useModelProviders();
  const [localSettings, setLocalSettings] = useState<SettingsData | null>(originalSettings);
  const [agentProfiles, setAgentProfiles] = useState(originalAgentProfiles);
  const [selectedPath, setSelectedPath] = useState<OnboardingPath | null>(null);
  const [step, setStep] = useState(1);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (originalSettings) {
      setLocalSettings(originalSettings);
    }
  }, [originalSettings]);

  useEffect(() => {
    setAgentProfiles(originalAgentProfiles);
  }, [originalAgentProfiles]);

  // Point the untouched default agent profile to the first provider configured during onboarding,
  // so the agent doesn't keep a hardcoded provider the user never set up.
  useEffect(() => {
    if (providers.length === 0) {
      return;
    }

    setAgentProfiles((prevProfiles) => {
      let changed = false;
      const nextProfiles = prevProfiles.map((profile) => {
        if (profile.id !== DEFAULT_AGENT_PROFILE.id) {
          return profile;
        }
        if (profile.provider !== DEFAULT_AGENT_PROFILE.provider || profile.model !== DEFAULT_AGENT_PROFILE.model) {
          return profile;
        }

        const primaryProvider = providers[0];
        const providerModels = models.filter((model) => model.providerId === primaryProvider.id);
        const defaultModel = DEFAULT_PROVIDER_MODELS[primaryProvider.provider.name] ?? providerModels[0]?.id;
        if (!defaultModel) {
          return profile;
        }

        changed = true;
        return { ...profile, provider: primaryProvider.provider.name, model: defaultModel };
      });

      return changed ? nextProfiles : prevProfiles;
    });
  }, [providers, models, originalAgentProfiles]);

  const branchStepTitle =
    selectedPath === 'aider' ? t('onboarding.steps.aider') : selectedPath === 'agent' ? t('onboarding.steps.agent') : t('onboarding.steps.configure');

  const steps = [
    { title: t('onboarding.steps.welcome') },
    { title: t('onboarding.steps.choosePath') },
    { title: t('onboarding.steps.connectModel') },
    { title: branchStepTitle },
    { title: t('onboarding.steps.finish') },
  ];

  const handleNext = async () => {
    if (isNavigating || isSaving) {
      return;
    }

    if (step === 2 && !selectedPath) {
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
        taskSettings: {
          ...localSettings.taskSettings,
          defaultProjectMode: selectedPath === 'aider' ? 'code' : 'agent',
          defaultTaskMode: 'last',
        },
        onboardingFinished: true,
      });

      // Save agent profile changes
      try {
        // Find profiles that were added, updated, or deleted
        const originalProfileIds = new Set(originalAgentProfiles.map((p) => p.id));
        const currentProfileIds = new Set(agentProfiles.map((p) => p.id));

        // Handle deleted profiles
        for (const profileId of originalProfileIds) {
          if (!currentProfileIds.has(profileId)) {
            await deleteProfile(profileId);
          }
        }

        // Handle added and updated profiles
        for (const profile of agentProfiles) {
          if (!originalProfileIds.has(profile.id)) {
            // New profile
            await createProfile(profile);
          } else {
            // Updated profile - check if it actually changed
            const originalProfile = originalAgentProfiles.find((p) => p.id === profile.id);
            if (originalProfile && !isEqual(originalProfile, profile)) {
              await updateProfile(profile);
            }
          }
        }

        // Update profile order if needed
        if (
          !isEqual(
            agentProfiles.map((p) => p.id),
            originalAgentProfiles.map((p) => p.id),
          )
        ) {
          await updateProfilesOrder(agentProfiles);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to save agent profiles:', error);
      }

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
    [localSettings, saveSettings],
  );

  const handleSelectPath = (path: OnboardingPath) => {
    setSelectedPath(path);
  };

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
        return <OnboardingPathChoice selectedPath={selectedPath} onSelectPath={handleSelectPath} />;
      case 3:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-text-primary uppercase">{t('onboarding.providers.connectTitle')}</h2>
            <p className="text-text-tertiary text-sm">{t('onboarding.providers.connectDescription')}</p>
            <OnboardingProviderSetup />
            <div className="flex justify-center mt-4">
              <button
                onClick={handleNext}
                disabled={isNavigating || isSaving}
                className="text-sm text-text-muted-light hover:text-text-secondary underline transition-colors duration-200"
              >
                {t('onboarding.skipForNow')}
              </button>
            </div>
            <div className="p-3 bg-info-subtle rounded-lg border border-info-light-emphasis">
              <p className="text-xs text-info-lightest">{t('onboarding.providers.setupLater')}</p>
            </div>
          </div>
        );
      case 4:
        if (selectedPath === 'aider') {
          return (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-text-primary uppercase !mb-4">{t('onboarding.aider.fineTuneTitle')}</h2>
              <div className="p-3 bg-info-subtle rounded-lg border border-info-light-emphasis">
                <p className="text-xs text-info-lightest">{t('onboarding.aider.fineTuneNote')}</p>
              </div>
              <AiderSettings settings={localSettings!} setSettings={setLocalSettings} initialShowEnvVars={true} />
              <div className="p-3 bg-info-subtle rounded-lg border border-info-light-emphasis">
                <p className="text-xs text-info-lightest">{t('onboarding.aider.agentSwitchNote')}</p>
              </div>
            </div>
          );
        }

        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-text-primary uppercase">{t('onboarding.agent.configureTitle')}</h2>
              <p className="text-text-tertiary text-sm mt-2">{t('onboarding.agent.configureDescription')}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 bg-bg-secondary rounded-lg border border-border-default">
                <span className="text-sm font-medium text-text-primary">{t('onboarding.agent.autonomousPlanning')}</span>
                <p className="text-xs text-text-tertiary mt-1">{t('onboarding.agent.autonomousPlanningDesc')}</p>
              </div>
              <div className="p-3 bg-bg-secondary rounded-lg border border-border-default">
                <span className="text-sm font-medium text-text-primary">{t('onboarding.agent.toolUse')}</span>
                <p className="text-xs text-text-tertiary mt-1">{t('onboarding.agent.toolUseDesc')}</p>
              </div>
              <div className="p-3 bg-bg-secondary rounded-lg border border-border-default">
                <span className="text-sm font-medium text-text-primary">{t('onboarding.agent.extensible')}</span>
                <p className="text-xs text-text-tertiary mt-1">{t('onboarding.agent.extensibleDesc')}</p>
              </div>
            </div>

            <div className="border border-border-default rounded-lg overflow-hidden h-[600px]">
              <AgentSettings settings={localSettings!} setSettings={setLocalSettings} agentProfiles={agentProfiles} setAgentProfiles={setAgentProfiles} />
            </div>
          </div>
        );
      case 5:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-text-primary uppercase">{t('onboarding.complete.title')}</h2>
            <p className="text-text-tertiary text-sm">{t('onboarding.complete.description')}</p>
            <p className="text-text-tertiary text-sm">{t('onboarding.complete.ready')}</p>
            <div className="p-3 bg-success-subtle rounded-lg border border-success-emphasis">
              <p className="text-xs text-success-light">
                {t('onboarding.complete.mode', { mode: selectedPath === 'aider' ? t('onboarding.complete.modeCode') : t('onboarding.complete.modeAgent') })}
              </p>
            </div>
            <div className="space-y-3 pt-2">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">{t('onboarding.complete.customizeTitle')}</h3>
                <p className="text-xs text-text-tertiary mt-1">{t('onboarding.complete.customizeDescription')}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 bg-bg-secondary rounded-lg border border-border-default">
                  <span className="text-xs font-medium text-text-primary">{t('onboarding.complete.general.title')}</span>
                  <p className="text-xs text-text-tertiary mt-1">{t('onboarding.complete.general.description')}</p>
                </div>
                <div className="p-3 bg-bg-secondary rounded-lg border border-border-default">
                  <span className="text-xs font-medium text-text-primary">{t('onboarding.complete.mcp.title')}</span>
                  <p className="text-xs text-text-tertiary mt-1">{t('onboarding.complete.mcp.description')}</p>
                </div>
                <div className="p-3 bg-bg-secondary rounded-lg border border-border-default">
                  <span className="text-xs font-medium text-text-primary">{t('onboarding.complete.tasks.title')}</span>
                  <p className="text-xs text-text-tertiary mt-1">{t('onboarding.complete.tasks.description')}</p>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full p-[4px] bg-bg-primary-light">
      <div className="flex flex-col flex-1 border-2 border-border-default relative overflow-y-auto scrollbar-thin scrollbar-track-bg-secondary scrollbar-thumb-bg-tertiary hover:scrollbar-thumb-bg-fourth">
        <div className="flex-1 flex flex-col justify-center items-center p-4">
          <div className={clsx('w-full', step === 3 || step === 4 ? 'max-w-5xl' : 'max-w-3xl')}>
            {/* Stepper */}
            <div className="mb-8">
              <OnboardingStepper steps={steps} currentStep={step} />
            </div>

            {/* Step Content */}
            {renderStep()}

            {/* Navigation Buttons */}
            <div className="mt-10 flex justify-between">
              <div>
                {step > 1 && (
                  <Button onClick={handleBack} variant="text" className="gap-2" disabled={isNavigating || isSaving}>
                    <HiArrowLeft className="w-4 h-4" />
                    {t('common.back')}
                  </Button>
                )}
              </div>
              {step < 5 && (
                <Button onClick={handleNext} className="gap-2" disabled={isNavigating || isSaving || (step === 2 && !selectedPath)}>
                  {isNavigating ? t('common.loading') : t('common.next')}
                  {!isNavigating && <HiArrowRight className="w-4 h-4" />}
                </Button>
              )}
              {step === 5 && (
                <Button onClick={handleFinish} className="gap-2" disabled={isNavigating || isSaving}>
                  {isSaving ? t('common.loading') : t('onboarding.finish')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

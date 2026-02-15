import { useEffect, useMemo, useState } from 'react';
import { useLocalStorage } from '@reactuses/core';
import { ProviderProfile } from '@aider-desk/common/types';
import {
  DEFAULT_VOICE_SYSTEM_INSTRUCTIONS,
  GeminiProvider,
  GeminiVoiceModel,
  OpenAiProvider,
  OpenAiVoiceModel,
  isGeminiProvider,
  isOpenAiProvider,
} from '@aider-desk/common/agent';
import { useTranslation } from 'react-i18next';

import { useModelProviders } from '@/contexts/ModelProviderContext';
import { Section } from '@/components/common/Section';
import { Select, Option } from '@/components/common/Select';
import { Input } from '@/components/common/Input';
import { TextArea } from '@/components/common/TextArea';
import { Slider } from '@/components/common/Slider';
import { InfoIcon } from '@/components/common/InfoIcon';

const DEFAULT_IDLE_TIMEOUT_MS = 5000;
const DEFAULT_MIC_DEVICE_ID = '__default__';

type AudioDeviceOption = {
  label: string;
  value: string;
};

type SupportedVoiceProviderName = 'openai' | 'gemini';

type LanguageOption = {
  label: string;
  value: string;
};

const OPENAI_LANGUAGE_OPTIONS: LanguageOption[] = [
  { label: 'Afrikaans', value: 'af' },
  { label: 'Arabic', value: 'ar' },
  { label: 'Armenian', value: 'hy' },
  { label: 'Azerbaijani', value: 'az' },
  { label: 'Belarusian', value: 'be' },
  { label: 'Bosnian', value: 'bs' },
  { label: 'Bulgarian', value: 'bg' },
  { label: 'Catalan', value: 'ca' },
  { label: 'Chinese', value: 'zh' },
  { label: 'Croatian', value: 'hr' },
  { label: 'Czech', value: 'cs' },
  { label: 'Danish', value: 'da' },
  { label: 'Dutch', value: 'nl' },
  { label: 'English', value: 'en' },
  { label: 'Estonian', value: 'et' },
  { label: 'Finnish', value: 'fi' },
  { label: 'French', value: 'fr' },
  { label: 'Galician', value: 'gl' },
  { label: 'German', value: 'de' },
  { label: 'Greek', value: 'el' },
  { label: 'Hebrew', value: 'he' },
  { label: 'Hindi', value: 'hi' },
  { label: 'Hungarian', value: 'hu' },
  { label: 'Icelandic', value: 'is' },
  { label: 'Indonesian', value: 'id' },
  { label: 'Italian', value: 'it' },
  { label: 'Japanese', value: 'ja' },
  { label: 'Kannada', value: 'kn' },
  { label: 'Kazakh', value: 'kk' },
  { label: 'Korean', value: 'ko' },
  { label: 'Latvian', value: 'lv' },
  { label: 'Lithuanian', value: 'lt' },
  { label: 'Macedonian', value: 'mk' },
  { label: 'Malay', value: 'ms' },
  { label: 'Marathi', value: 'mr' },
  { label: 'Maori', value: 'mi' },
  { label: 'Nepali', value: 'ne' },
  { label: 'Norwegian', value: 'no' },
  { label: 'Persian', value: 'fa' },
  { label: 'Polish', value: 'pl' },
  { label: 'Portuguese', value: 'pt' },
  { label: 'Romanian', value: 'ro' },
  { label: 'Russian', value: 'ru' },
  { label: 'Serbian', value: 'sr' },
  { label: 'Slovak', value: 'sk' },
  { label: 'Slovenian', value: 'sl' },
  { label: 'Spanish', value: 'es' },
  { label: 'Swahili', value: 'sw' },
  { label: 'Swedish', value: 'sv' },
  { label: 'Tagalog', value: 'tl' },
  { label: 'Tamil', value: 'ta' },
  { label: 'Thai', value: 'th' },
  { label: 'Turkish', value: 'tr' },
  { label: 'Ukrainian', value: 'uk' },
  { label: 'Urdu', value: 'ur' },
  { label: 'Vietnamese', value: 'vi' },
  { label: 'Welsh', value: 'cy' },
];

type Props = {
  providers?: ProviderProfile[];
  setProviders?: (providers: ProviderProfile[]) => void;
  initialProviderId?: string;
};

export const VoiceSettings = ({ providers: localProviders, setProviders: setLocalProviders, initialProviderId }: Props) => {
  const { t } = useTranslation();
  const { providers, saveProvider } = useModelProviders();

  const currentProviders = localProviders ?? providers;
  const updateProviders = setLocalProviders
    ? setLocalProviders
    : (updated: ProviderProfile[]) => {
        if (updated.length > 0) {
          void saveProvider(updated[0]);
        }
      };

  const voiceProviders = useMemo(() => {
    return currentProviders.filter((p) => isOpenAiProvider(p.provider) || isGeminiProvider(p.provider));
  }, [currentProviders]);

  const defaultSelectedProviderId = useMemo(() => {
    if (initialProviderId && voiceProviders.some((p) => p.id === initialProviderId)) {
      return initialProviderId;
    }

    const voiceEnabled = voiceProviders.find((p) => p.provider.voiceEnabled);
    return voiceEnabled?.id || voiceProviders[0]?.id || '';
  }, [initialProviderId, voiceProviders]);

  const [selectedProviderId, setSelectedProviderId] = useState(defaultSelectedProviderId);

  const selectedProfile = useMemo(() => {
    return voiceProviders.find((p) => p.id === selectedProviderId);
  }, [selectedProviderId, voiceProviders]);

  const providerOptions: Option[] = useMemo(() => {
    return voiceProviders.map((p) => ({
      label: p.name || t(`providers.${p.provider.name}`),
      value: p.id,
    }));
  }, [t, voiceProviders]);

  const handleSelectProvider = (providerId: string) => {
    setSelectedProviderId(providerId);

    const selected = voiceProviders.find((p) => p.id === providerId);
    if (selected && !selected.provider.voiceEnabled) {
      handleUpdateProfile({
        ...selected,
        provider: {
          ...selected.provider,
          voiceEnabled: true,
        },
      });
    }
  };

  const handleUpdateProfile = (profile: ProviderProfile) => {
    const updated = currentProviders.some((p) => p.id === profile.id)
      ? currentProviders.map((p) => (p.id === profile.id ? profile : p))
      : [...currentProviders, profile];

    let normalized = updated;
    if (profile.provider.voiceEnabled) {
      normalized = updated.map((p) => {
        if (p.id !== profile.id && p.provider.voiceEnabled) {
          return {
            ...p,
            provider: {
              ...p.provider,
              voiceEnabled: false,
            },
          };
        }
        return p;
      });
    }

    updateProviders(normalized);
  };

  const handleIdleTimeoutChangeSeconds = (seconds: number) => {
    if (!selectedProfile) {
      return;
    }

    if (Number.isNaN(seconds) || seconds < 0) {
      return;
    }

    const idleTimeoutMs = Math.round(seconds) * 1000;

    if (selectedProfile.provider.name === 'openai') {
      const provider = selectedProfile.provider as OpenAiProvider;
      const updated: ProviderProfile = {
        ...selectedProfile,
        provider: {
          ...provider,
          voice: {
            ...provider.voice,
            idleTimeoutMs,
          },
        },
      };
      handleUpdateProfile(updated);
      return;
    }

    if (selectedProfile.provider.name === 'gemini') {
      const provider = selectedProfile.provider as GeminiProvider;
      const updated: ProviderProfile = {
        ...selectedProfile,
        provider: {
          ...provider,
          voice: {
            ...provider.voice,
            idleTimeoutMs,
          },
        },
      };
      handleUpdateProfile(updated);
    }
  };

  const [inputDeviceId, setInputDeviceId] = useLocalStorage<string | undefined>('voice-microphone-device-id', undefined);
  const [audioInputs, setAudioInputs] = useState<AudioDeviceOption[]>([]);

  useEffect(() => {
    const loadDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const inputs: AudioDeviceOption[] = devices
          .filter((d) => d.kind === 'audioinput')
          .filter((d) => d.deviceId !== 'default')
          .map((d) => ({
            label: d.label || t('settings.voice.microphoneUnknown'),
            value: d.deviceId,
          }));
        setAudioInputs(inputs);
      } catch {
        setAudioInputs([]);
      }
    };

    void loadDevices();

    const handleDeviceChange = () => {
      void loadDevices();
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [t]);

  const handleInputDeviceChange = (value: string) => {
    const inputDeviceId = value === DEFAULT_MIC_DEVICE_ID ? undefined : value;
    setInputDeviceId(inputDeviceId);
  };

  const handleSystemInstructionsChange = (value: string) => {
    if (!selectedProfile) {
      return;
    }

    if (selectedProfile.provider.name === 'openai') {
      const provider = selectedProfile.provider as OpenAiProvider;
      const updated: ProviderProfile = {
        ...selectedProfile,
        provider: {
          ...provider,
          voice: {
            ...provider.voice,
            systemInstructions: value,
          },
        },
      };
      handleUpdateProfile(updated);
      return;
    }

    if (selectedProfile.provider.name === 'gemini') {
      const provider = selectedProfile.provider as GeminiProvider;
      const updated: ProviderProfile = {
        ...selectedProfile,
        provider: {
          ...provider,
          voice: {
            ...provider.voice,
            systemInstructions: value,
          },
        },
      };
      handleUpdateProfile(updated);
    }
  };

  const idleTimeoutMs =
    selectedProfile?.provider.name === 'openai'
      ? ((selectedProfile.provider as OpenAiProvider).voice?.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS)
      : selectedProfile?.provider.name === 'gemini'
        ? ((selectedProfile.provider as GeminiProvider).voice?.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS)
        : DEFAULT_IDLE_TIMEOUT_MS;
  const idleTimeoutSeconds = Math.round(idleTimeoutMs / 1000);

  const [idleTimeoutDraftSeconds, setIdleTimeoutDraftSeconds] = useState<number>(idleTimeoutSeconds);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIdleTimeoutDraftSeconds(idleTimeoutSeconds);
  }, [idleTimeoutSeconds, selectedProviderId]);

  const systemInstructions =
    selectedProfile?.provider.name === 'openai'
      ? ((selectedProfile.provider as OpenAiProvider).voice?.systemInstructions ?? DEFAULT_VOICE_SYSTEM_INSTRUCTIONS)
      : selectedProfile?.provider.name === 'gemini'
        ? ((selectedProfile.provider as GeminiProvider).voice?.systemInstructions ?? DEFAULT_VOICE_SYSTEM_INSTRUCTIONS)
        : DEFAULT_VOICE_SYSTEM_INSTRUCTIONS;

  const providerName = selectedProfile?.provider.name as SupportedVoiceProviderName | undefined;

  const microphoneOptions: Option[] = useMemo(() => {
    return [{ label: t('settings.voice.microphoneDefault'), value: DEFAULT_MIC_DEVICE_ID }, ...audioInputs.map((d) => ({ label: d.label, value: d.value }))];
  }, [audioInputs, t]);

  const openAiModelOptions: Option[] = [
    { label: OpenAiVoiceModel.Gpt4oMiniTranscribe, value: OpenAiVoiceModel.Gpt4oMiniTranscribe },
    { label: OpenAiVoiceModel.Gpt4oTranscribe, value: OpenAiVoiceModel.Gpt4oTranscribe },
  ];

  const geminiModelOptions: Option[] = [{ label: GeminiVoiceModel.GeminiLive25FlashNativeAudio, value: GeminiVoiceModel.GeminiLive25FlashNativeAudio }];

  const handleOpenAiModelChange = (value: string) => {
    if (!selectedProfile || selectedProfile.provider.name !== 'openai') {
      return;
    }

    const provider = selectedProfile.provider as OpenAiProvider;

    const updated: ProviderProfile = {
      ...selectedProfile,
      provider: {
        ...provider,
        voice: {
          ...provider.voice,
          model: value as OpenAiVoiceModel,
        },
      },
    };

    handleUpdateProfile(updated);
  };

  const handleOpenAiLanguageChange = (value: string) => {
    if (!selectedProfile || selectedProfile.provider.name !== 'openai') {
      return;
    }

    const provider = selectedProfile.provider as OpenAiProvider;

    const updated: ProviderProfile = {
      ...selectedProfile,
      provider: {
        ...provider,
        voice: {
          ...provider.voice,
          language: value,
        },
      },
    };

    handleUpdateProfile(updated);
  };

  const handleGeminiModelChange = (value: string) => {
    if (!selectedProfile || selectedProfile.provider.name !== 'gemini') {
      return;
    }

    const provider = selectedProfile.provider as GeminiProvider;

    const updated: ProviderProfile = {
      ...selectedProfile,
      provider: {
        ...provider,
        voice: {
          ...provider.voice,
          model: value as GeminiVoiceModel,
        },
      },
    };

    handleUpdateProfile(updated);
  };

  const handleGeminiTemperatureChange = (value: number) => {
    if (!selectedProfile || selectedProfile.provider.name !== 'gemini') {
      return;
    }

    const provider = selectedProfile.provider as GeminiProvider;

    const updated: ProviderProfile = {
      ...selectedProfile,
      provider: {
        ...provider,
        voice: {
          ...provider.voice,
          temperature: value,
        },
      },
    };

    handleUpdateProfile(updated);
  };

  const openAiProvider = selectedProfile?.provider.name === 'openai' ? (selectedProfile.provider as OpenAiProvider) : undefined;
  const openAiModel = openAiProvider?.voice?.model ?? OpenAiVoiceModel.Gpt4oTranscribe;
  const openAiLanguage = openAiProvider?.voice?.language ?? 'en';

  const geminiProvider = selectedProfile?.provider.name === 'gemini' ? (selectedProfile.provider as GeminiProvider) : undefined;
  const geminiModel = geminiProvider?.voice?.model ?? GeminiVoiceModel.GeminiLive25FlashNativeAudio;
  const geminiTemperature = geminiProvider?.voice?.temperature ?? 0.7;

  const [geminiTemperatureDraft, setGeminiTemperatureDraft] = useState<number>(geminiTemperature);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGeminiTemperatureDraft(geminiTemperature);
  }, [geminiTemperature, selectedProviderId]);

  const selectedModelOptions = providerName === 'openai' ? openAiModelOptions : providerName === 'gemini' ? geminiModelOptions : [];
  const selectedModelValue = providerName === 'openai' ? openAiModel : providerName === 'gemini' ? geminiModel : '';
  const handleModelChange = (value: string) => {
    if (providerName === 'openai') {
      handleOpenAiModelChange(value);
      return;
    }

    if (providerName === 'gemini') {
      handleGeminiModelChange(value);
    }
  };

  const handleIdleTimeoutChange = (value: string) => {
    if (value === '') {
      return;
    }

    const seconds = parseInt(value);
    if (Number.isNaN(seconds)) {
      return;
    }

    setIdleTimeoutDraftSeconds(seconds);
    handleIdleTimeoutChangeSeconds(seconds);
  };

  const handleTemperatureChange = (value: number) => {
    setGeminiTemperatureDraft(value);
    handleGeminiTemperatureChange(value);
  };

  const hasSupportedProviders = voiceProviders.length > 0;

  return (
    <div className="space-y-6">
      <Section id="voice" title={t('settings.voice.title')}>
        {!hasSupportedProviders ? (
          <div className="px-4 py-5 pb-3">
            <p className="text-xs text-text-secondary">{t('settings.voice.noSupportedProviders')}</p>
          </div>
        ) : (
          <div className="px-4 py-5 pb-3 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Select label={t('settings.voice.providerProfile')} options={providerOptions} value={selectedProviderId} onChange={handleSelectProvider} />
              <Select
                label={t('settings.voice.model')}
                options={selectedModelOptions}
                value={selectedModelValue}
                onChange={handleModelChange}
                disabled={!providerName}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 items-end">
              <Select
                label={t('settings.voice.microphone')}
                options={microphoneOptions}
                value={!inputDeviceId || inputDeviceId === 'undefined' ? DEFAULT_MIC_DEVICE_ID : inputDeviceId}
                onChange={handleInputDeviceChange}
              />
              <Input
                label={
                  <div className="flex items-center text-sm">
                    <span>{t('settings.voice.idleTimeout')}</span>
                    <InfoIcon tooltip={t('settings.voice.idleTimeoutHelp')} className="ml-1" />
                  </div>
                }
                type="number"
                min={0}
                step={1}
                value={idleTimeoutDraftSeconds.toString()}
                onChange={(e) => handleIdleTimeoutChange(e.target.value)}
              />
              {providerName === 'openai' && (
                <Select
                  label={t('settings.voice.openai.language')}
                  options={OPENAI_LANGUAGE_OPTIONS.map((l) => ({ label: l.label, value: l.value }))}
                  value={openAiLanguage}
                  onChange={handleOpenAiLanguageChange}
                />
              )}

              {providerName === 'gemini' && (
                <Slider
                  label={
                    <div className="flex items-center text-sm">
                      <span>{t('settings.voice.gemini.temperature')}</span>
                    </div>
                  }
                  min={0}
                  max={1}
                  step={0.05}
                  value={geminiTemperatureDraft}
                  onChange={handleTemperatureChange}
                />
              )}
            </div>

            <TextArea
              label={t('settings.voice.systemInstructions')}
              value={systemInstructions}
              onChange={(e) => handleSystemInstructionsChange(e.target.value)}
              rows={4}
            />
          </div>
        )}
      </Section>
    </div>
  );
};

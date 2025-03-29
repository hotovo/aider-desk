import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { FaGlobe } from 'react-icons/fa';
import { FaChevronDown } from 'react-icons/fa';
import { useSettings } from '@/context/SettingsContext';

/**
 * Language switcher component that allows users to select from available languages using a dropdown
 */
export const LanguageSwitcher = () => {
  const { i18n, t } = useTranslation();
  const { settings, saveSettings } = useSettings();
  const [currentLanguage, setCurrentLanguage] = useState(settings?.language || i18n.language || 'en');
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  
  // Check if we're in the onboarding page
  const isOnboardingPage = window.location.hash.includes('/onboarding');

  // Available languages - can be expanded in the future
  const languages = [
    { code: 'en', name: t('settings.english') },
    { code: 'zh', name: t('settings.chinese') }
  ];

  // Update state when language changes externally or settings load
  useEffect(() => {
    if (settings?.language && settings.language !== i18n.language) {
      i18n.changeLanguage(settings.language);
    }
    setCurrentLanguage(settings?.language || i18n.language || 'en');
  }, [i18n.language, settings]);

  // Store selected language without applying it immediately
  const changeLanguage = (langCode: string) => {
    // If we're in onboarding, just update the UI without saving settings
    if (isOnboardingPage) {
      setCurrentLanguage(langCode);
      i18n.changeLanguage(langCode);
      // Force close dropdown after selection in onboarding page
      setIsOpen(false);
      // Force update settings with the new language to ensure UI updates
      if (settings) {
        saveSettings({
          ...settings,
          language: langCode
        });
      }
    } else {
      setSelectedLanguage(langCode);
      setCurrentLanguage(langCode);
    }
  };
  
  // Apply language change when settings are saved
  useEffect(() => {
    if (settings?.language && settings.language !== i18n.language) {
      i18n.changeLanguage(settings.language);
      setSelectedLanguage(null);
    }
  }, [settings, i18n]);
  
  // Save selected language to settings when changed
  useEffect(() => {
    // Don't save settings during onboarding to prevent navigation issues
    if (selectedLanguage && settings && !isOnboardingPage) {
      saveSettings({
        ...settings,
        language: selectedLanguage
      });
    }
  }, [selectedLanguage, settings, saveSettings, isOnboardingPage]);

  // Get current language name
  const getCurrentLanguageName = () => {
    const lang = languages.find(l => l.code === currentLanguage);
    return lang ? lang.name : t('settings.english');
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-1 text-sm rounded bg-neutral-800 hover:bg-neutral-700"
        title={t('settings.language')}
      >
        <FaGlobe className="text-gray-500" />
        <span>{getCurrentLanguageName()}</span>
        <FaChevronDown className="text-gray-500 text-xs ml-1" />
      </button>
      
      {isOpen && (
        <div className="absolute right-0 mt-1 w-40 bg-neutral-800 rounded-md shadow-lg z-50 border border-neutral-700 max-h-[300px] overflow-y-auto">
          {languages.map((lang) => (
            <button
              key={lang.code}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-neutral-700 ${currentLanguage === lang.code ? 'bg-neutral-750' : ''}`}
              onClick={() => changeLanguage(lang.code)}
            >
              {lang.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
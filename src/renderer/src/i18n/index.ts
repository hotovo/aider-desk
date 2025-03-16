import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import your translation files
import en from './locales/en';
import zh from './locales/zh';

export const SUPPORTED_LANGUAGES = {
  en: {
    label: 'English',
    countryCode: 'US',
  },
  zh: {
    label: '简体中文',
    countryCode: 'CN',
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      zh: { translation: zh },
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;

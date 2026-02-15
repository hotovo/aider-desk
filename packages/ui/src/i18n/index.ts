import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
// Import your translation files
import en from '@aider-desk/common/locales/en.json';
import zh from '@aider-desk/common/locales/zh.json';

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

// eslint-disable-next-line import/no-named-as-default-member
void i18n
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

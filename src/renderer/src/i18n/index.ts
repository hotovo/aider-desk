import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
// Import your translation files
import en from '@common/locales/en.json';
import zh from '@common/locales/zh.json';
import ru from '@common/locales/ru.json';
import ko from '@common/locales/ko.json';

export const SUPPORTED_LANGUAGES = {
  en: {
    label: 'English',
    countryCode: 'US',
  },
  zh: {
    label: '简体中文',
    countryCode: 'CN',
  },
  ru: {
    label: 'Русский',
    countryCode: 'RU',
  },
  ko: {
    label: '한국어',
    countryCode: 'KR',
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
      ru: { translation: ru },
      ko: { translation: ko },
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;

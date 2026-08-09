import en from '@common/locales/en.json';
import ko from '@common/locales/ko.json';
import ru from '@common/locales/ru.json';
import zh from '@common/locales/zh.json';

const resources: Record<string, Record<string, unknown>> = { en, zh, ru, ko };

const getNested = (obj: Record<string, unknown>, key: string): unknown => {
  return key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
};

const interpolate = (template: string, params?: Record<string, string>): string => {
  if (!params) {
    return template;
  }
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => params[key] ?? match);
};

export const translate = (language: string | undefined, key: string, params?: Record<string, string>): string => {
  const dictionary = (language && resources[language]) || en;
  const value = getNested(dictionary, key);
  if (typeof value === 'string') {
    return interpolate(value, params);
  }
  const fallback = getNested(en, key);
  return typeof fallback === 'string' ? interpolate(fallback, params) : key;
};

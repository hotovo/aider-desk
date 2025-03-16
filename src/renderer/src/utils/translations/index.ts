// 导出所有语言翻译
import { translations as enTranslations } from './en';
import { translations as zhTranslations } from './zh';

// 语言映射，用于存储所有支持的语言翻译
export const translationsMap: Record<string, Record<string, string>> = {
  en: enTranslations,
  zh: zhTranslations,
};

// 语言选项，用于UI显示
export const languageOptions = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' },
];

// 添加新语言的函数，方便后续扩展
export function registerLanguage(code: string, translations: Record<string, string>, label: string) {
  translationsMap[code] = translations;
  
  // 检查是否已存在该语言选项
  const existingOption = languageOptions.find(option => option.value === code);
  if (!existingOption) {
    languageOptions.push({ value: code, label });
  }
}
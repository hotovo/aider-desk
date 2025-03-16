// 国际化翻译工具
import { translationsMap } from './translations';
import React from 'react';

// 获取当前语言（异步版本）
export async function getCurrentLanguageAsync(): Promise<'en' | 'zh'> {
  try {
    // 从window.api获取最新的设置
    const settings = await window.api.loadSettings();
    if (settings && settings.language) {
      return settings.language as 'en' | 'zh';
    }
    return 'en'; // 默认返回英文
  } catch (error) {
    console.error('Failed to get language from settings:', error);
    return 'en'; // 出错时默认返回英文
  }
}

// 获取当前语言（同步版本）
export function getCurrentLanguage(): 'en' | 'zh' {
  return getCurrentLanguageSync();
}

// 同步获取当前语言（从localStorage）
export function getCurrentLanguageSync(): 'en' | 'zh' {
  try {
    // 尝试从localStorage获取语言设置
    const storedSettings = localStorage.getItem('electron-store');
    if (storedSettings) {
      const settings = JSON.parse(storedSettings);
      // 确保正确访问settings对象中的language属性
      if (settings && settings.settings && settings.settings.language) {
        const language = settings.settings.language;
        console.log('Current language from localStorage:', language);
        // 确保返回的是有效的语言代码
        if (language === 'zh' || language === 'en') {
          return language;
        }
      }
    }
  } catch (error) {
    console.error('Failed to get language from localStorage:', error);
  }
  return 'en'; // 默认返回英文
}

// 添加一个强制刷新语言的函数
export function forceRefreshLanguage(): void {
  // 强制重新加载页面以应用新的语言设置
  window.location.reload();
}

// 设置当前语言并立即应用（不需要刷新页面）
export function setCurrentLanguage(language: 'en' | 'zh'): void {
  // 将语言设置保存到临时存储中，以便立即生效
  localStorage.setItem('current-language', language);
  
  // 触发一个自定义事件，通知应用语言已更改
  window.dispatchEvent(new CustomEvent('language-changed', { detail: { language } }));
}

// 翻译函数
export function t(text: string | React.ReactNode): string {
  if (typeof text !== 'string') {
    return '';
  }
  
  // 尝试从localStorage直接获取当前语言设置
  let currentLanguage = 'en';
  try {
    // 首先检查是否有临时存储的语言设置
    const tempLanguage = localStorage.getItem('current-language');
    if (tempLanguage && (tempLanguage === 'zh' || tempLanguage === 'en')) {
      currentLanguage = tempLanguage;
      console.log('Using temporary language setting:', currentLanguage);
    } else {
      // 否则使用常规方法获取语言设置
      currentLanguage = getCurrentLanguageSync();
      console.log('Using language from settings:', currentLanguage);
    }
  } catch (error) {
    console.error('Error getting language setting:', error);
    currentLanguage = 'en'; // 出错时默认使用英文
  }
  
  // 如果当前语言是英文，直接返回原文本
  if (currentLanguage === 'en') {
    return text;
  }
  
  // 如果当前语言是中文，返回翻译后的文本
  const translated = translationsMap['zh'][text] || text;
  
  // 如果没有找到翻译，记录日志以便调试
  if (currentLanguage === 'zh' && translated === text && text.trim() !== '') {
    console.log(`Missing translation for: "${text}"`);
  }
  
  return translated;
}

// 语言选项
import { languageOptions } from './translations';

// 获取翻译后的语言选项
export function getTranslatedLanguageOptions() {
  // 尝试从localStorage直接获取当前语言设置
  let currentLanguage = 'en';
  try {
    // 首先检查是否有临时存储的语言设置
    const tempLanguage = localStorage.getItem('current-language');
    if (tempLanguage && (tempLanguage === 'zh' || tempLanguage === 'en')) {
      currentLanguage = tempLanguage;
      console.log('Using temporary language setting in options:', currentLanguage);
    } else {
      // 否则使用常规方法获取语言设置
      currentLanguage = getCurrentLanguageSync();
      console.log('Using language from settings in options:', currentLanguage);
    }
  } catch (error) {
    console.error('Error getting language setting in options:', error);
    currentLanguage = 'en'; // 出错时默认使用英文
  }
  
  // 如果当前语言是英文，直接返回原始选项
  if (currentLanguage === 'en') {
    return languageOptions;
  }
  
  // 如果当前语言是中文，翻译选项标签
  return languageOptions.map(option => ({
    value: option.value,
    label: option.value === 'en' ? 'English' : '中文'
  }));
}
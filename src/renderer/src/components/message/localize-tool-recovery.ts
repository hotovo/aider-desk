import { isToolRecoveryNotice, type ToolRecoveryCode } from '@common/tool-recovery';

export const localizeToolRecoveryContent = (content: string, translate: (key: string) => string): string => {
  const localize = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(localize);
    }
    if (typeof value !== 'object' || value === null) {
      return value;
    }
    const result = Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, localize(entry)]));
    if (isToolRecoveryNotice(value)) {
      result.message = translate('durability.notices.' + value.aiderDeskRecovery);
    }
    return result;
  };
  try {
    return JSON.stringify(localize(JSON.parse(content)));
  } catch {
    return content;
  }
};

export const getToolRecoveryCodes = (content: string): ToolRecoveryCode[] => {
  const codes = new Set<ToolRecoveryCode>();
  const collect = (value: unknown): void => {
    if (typeof value !== 'object' || value === null) {
      return;
    }
    if (isToolRecoveryNotice(value)) {
      codes.add(value.aiderDeskRecovery);
    }
    Object.values(value).forEach(collect);
  };
  try {
    collect(JSON.parse(content));
    return [...codes];
  } catch {
    return [];
  }
};

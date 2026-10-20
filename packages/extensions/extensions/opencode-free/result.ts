import type { JSONValue } from '@ai-sdk/provider';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const contentText = (value: unknown): string | undefined => {
  if (!Array.isArray(value) || !value.every((part) => isRecord(part) && part.type === 'text' && typeof part.text === 'string')) {
    return undefined;
  }
  return value.map((part) => part.text).join('');
};

const unwrapResult = (value: unknown): unknown => {
  if (isRecord(value)) {
    if (['text', 'json', 'error-text', 'error-json'].includes(String(value.type)) && 'value' in value) {
      return unwrapResult(value.value);
    }
    if (Array.isArray(value.content)) {
      return contentText(value.content) ?? value;
    }
  }
  return contentText(value) ?? value;
};

export const normalizeProviderResult = (result: unknown): unknown => {
  const value = unwrapResult(result);
  if (typeof value !== 'string') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

export const nativeResultText = (result: unknown): string => {
  const value = unwrapResult(result);
  if (typeof value === 'string') {
    return value;
  }
  if (isRecord(value) && typeof value.output === 'string') {
    return value.output;
  }
  return JSON.stringify(value) ?? '';
};

export const nativeShellResult = (result: unknown, isError?: boolean): { stdout: string; stderr: string; exitCode: number } => {
  const value = unwrapResult(result);
  const exitCode = isRecord(value) && typeof value.exit === 'number' ? value.exit : isError ? 1 : 0;
  return { stdout: isError ? '' : nativeResultText(result), stderr: isError ? nativeResultText(result) : '', exitCode };
};
export const asToolResult = (value: unknown): NonNullable<JSONValue> => {
  if (value == null) {
    return '';
  }
  try {
    const json = JSON.stringify(value);
    return json === undefined ? '' : ((JSON.parse(json) ?? '') as NonNullable<JSONValue>);
  } catch {
    return String(value);
  }
};

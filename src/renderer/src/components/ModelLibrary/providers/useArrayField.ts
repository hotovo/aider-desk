import { useCallback, useMemo } from 'react';
import { OpenRouterProvider } from '@common/agent';

export const useArrayField = (
  provider: OpenRouterProvider,
  field: keyof Pick<OpenRouterProvider, 'order' | 'only' | 'ignore' | 'quantizations'>,
  onChange: (updated: OpenRouterProvider) => void,
) => {
  const value = useMemo(() => {
    const arrayValue = provider[field];
    if (Array.isArray(arrayValue)) {
      return arrayValue.join(',');
    }
    return '';
  }, [provider, field]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      onChange({
        ...provider,
        [field]: newValue,
      });
    },
    [provider, field, onChange],
  );

  return { value, onChange: handleChange };
};

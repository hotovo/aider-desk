import { useState, useEffect } from 'react';
import { OpenRouterProvider } from '@aider-desk/common/agent';

export const useArrayField = (
  provider: OpenRouterProvider,
  field: keyof Pick<OpenRouterProvider, 'order' | 'only' | 'ignore' | 'quantizations'>,
  onChange: (updated: OpenRouterProvider) => void,
) => {
  const [draftValue, setDraftValue] = useState('');

  useEffect(() => {
    const arrayValue = provider[field];
    if (Array.isArray(arrayValue)) {
      setDraftValue(arrayValue.join(','));
    } else {
      setDraftValue('');
    }
  }, [provider, field]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDraftValue(e.target.value);
  };

  const handleBlur = () => {
    const newValue = draftValue
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    onChange({
      ...provider,
      [field]: newValue,
    });
  };

  return { value: draftValue, onChange: handleChange, onBlur: handleBlur };
};

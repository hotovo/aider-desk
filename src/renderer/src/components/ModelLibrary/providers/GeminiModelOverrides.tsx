import { getDefaultProviderParams, GeminiProvider } from '@common/agent';

import { GeminiAdvancedSettings } from './GeminiAdvancedSettings';

type Props = {
  overrides: Partial<GeminiProvider>;
  onChange: (overrides: Record<string, unknown>) => void;
};

export const GeminiModelOverrides = ({ overrides, onChange }: Props) => {
  // Convert overrides to GeminiProvider format for AdvancedSettings
  const provider: GeminiProvider = {
    ...getDefaultProviderParams('gemini'),
    ...overrides,
  };

  // Convert GeminiProvider back to overrides format
  const handleProviderChange = (updatedProvider: GeminiProvider) => {
    const newOverrides = {
      thinkingBudget: updatedProvider.thinkingBudget,
      includeThoughts: updatedProvider.includeThoughts,
      useSearchGrounding: updatedProvider.useSearchGrounding,
    };

    // Remove undefined values
    const cleanedOverrides = Object.fromEntries(Object.entries(newOverrides).filter(([_, value]) => value !== undefined));

    onChange(cleanedOverrides);
  };

  return (
    <div className="space-y-4">
      <GeminiAdvancedSettings provider={provider} onChange={handleProviderChange} />
    </div>
  );
};

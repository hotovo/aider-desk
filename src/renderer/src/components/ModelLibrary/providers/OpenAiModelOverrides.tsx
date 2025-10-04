import { getDefaultProviderParams, OpenAiProvider } from '@common/agent';

import { OpenAiAdvancedSettings } from './OpenAiAdvancedSettings';

type Props = {
  overrides: Partial<OpenAiProvider>;
  onChange: (overrides: Record<string, unknown>) => void;
};

export const OpenAiModelOverrides = ({ overrides, onChange }: Props) => {
  // Convert overrides to OpenAiProvider format for AdvancedSettings
  const provider: OpenAiProvider = {
    ...getDefaultProviderParams('openai'),
    ...overrides,
  };

  // Convert OpenAiProvider back to overrides format
  const handleProviderChange = (updatedProvider: OpenAiProvider) => {
    const newOverrides = {
      reasoningEffort: updatedProvider.reasoningEffort,
    };

    // Remove undefined values
    const cleanedOverrides = Object.fromEntries(Object.entries(newOverrides).filter(([_, value]) => value !== undefined));

    onChange(cleanedOverrides);
  };

  return (
    <div className="space-y-4">
      <OpenAiAdvancedSettings provider={provider} onChange={handleProviderChange} />
    </div>
  );
};

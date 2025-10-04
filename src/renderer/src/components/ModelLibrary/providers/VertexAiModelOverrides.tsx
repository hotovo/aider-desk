import { getDefaultProviderParams, VertexAiProvider } from '@common/agent';

import { VertexAiAdvancedSettings } from './VertexAiAdvancedSettings';

type Props = {
  overrides: Partial<VertexAiProvider>;
  onChange: (overrides: Record<string, unknown>) => void;
};

export const VertexAiModelOverrides = ({ overrides, onChange }: Props) => {
  // Convert overrides to VertexAiProvider format for AdvancedSettings
  const provider: VertexAiProvider = {
    ...getDefaultProviderParams('vertex-ai'),
    ...overrides,
  };

  // Convert VertexAiProvider back to overrides format
  const handleProviderChange = (updatedProvider: VertexAiProvider) => {
    const newOverrides = {
      thinkingBudget: updatedProvider.thinkingBudget,
      includeThoughts: updatedProvider.includeThoughts,
    };

    // Remove undefined values
    const cleanedOverrides = Object.fromEntries(Object.entries(newOverrides).filter(([_, value]) => value !== undefined));

    onChange(cleanedOverrides);
  };

  return (
    <div className="space-y-4">
      <VertexAiAdvancedSettings provider={provider} onChange={handleProviderChange} />
    </div>
  );
};

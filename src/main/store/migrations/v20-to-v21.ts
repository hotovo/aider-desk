import { ProviderProfile } from '@common/types';

export const migrateProvidersV20toV21 = (providers: ProviderProfile[]): ProviderProfile[] => {
  return providers.filter((p) => p.provider.name !== 'claude-agent-sdk' && p.provider.name !== 'auggie');
};

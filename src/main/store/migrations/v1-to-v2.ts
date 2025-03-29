/* eslint-disable @typescript-eslint/no-explicit-any */
import { DEFAULT_SETTINGS } from '../store';

export const migrateSettingsV1toV2 = (settings: any): any => ({
  ...settings,
  mcpAgent: {
    ...settings.mcpConfig,
    systemPrompt: DEFAULT_SETTINGS.mcpAgent.systemPrompt,
    maxTokens: 1000,
  },
  mcpConfig: undefined,
});

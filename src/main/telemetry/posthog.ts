import { PostHogTraceExporter } from '@posthog/ai/otel';

import type { SpanExporter } from '@opentelemetry/sdk-trace-base';
import type { SettingsData } from '@common/types';

import { getEffectiveEnvironmentVariable } from '@/utils/environment';
import logger from '@/logger';

export const initializePostHogExporter = (): SpanExporter | undefined => {
  const posthogApiKey = getEffectiveEnvironmentVariable('POSTHOG_API_KEY');
  const posthogHost = getEffectiveEnvironmentVariable('POSTHOG_HOST');

  if (posthogApiKey) {
    logger.info('Initializing PostHog Trace Exporter...');
    return new PostHogTraceExporter({
      apiKey: posthogApiKey.value,
      host: posthogHost?.value || 'https://us.i.posthog.com',
    });
  }

  return undefined;
};

export const getPostHogAiderEnvironmentVariables = (baseDir: string, settings: SettingsData): Record<string, unknown> => {
  return {
    POSTHOG_API_KEY: getEffectiveEnvironmentVariable('POSTHOG_API_KEY', settings, baseDir)?.value,
    POSTHOG_API_URL: getEffectiveEnvironmentVariable('POSTHOG_HOST', settings, baseDir)?.value,
  };
};

import { LangfuseExporter } from 'langfuse-vercel';

import type { SpanExporter } from '@opentelemetry/sdk-trace-base';
import type { SettingsData } from '@common/types';

import { getEffectiveEnvironmentVariable } from '@/utils/environment';
import logger from '@/logger';

export const initializeLangfuseExporter = (): SpanExporter | undefined => {
  const langfusePublicKey = getEffectiveEnvironmentVariable('LANGFUSE_PUBLIC_KEY');
  const langfuseSecretKey = getEffectiveEnvironmentVariable('LANGFUSE_SECRET_KEY');
  const langfuseHost = getEffectiveEnvironmentVariable('LANGFUSE_HOST');

  if (langfusePublicKey && langfuseSecretKey) {
    logger.info('Initializing Langfuse Exporter...');
    return new LangfuseExporter({
      publicKey: langfusePublicKey.value,
      secretKey: langfuseSecretKey.value,
      baseUrl: langfuseHost?.value || 'https://cloud.langfuse.com',
    });
  }

  return undefined;
};

export const getLangfuseEnvironmentVariables = (baseDir: string, settings: SettingsData): Record<string, unknown> => {
  return {
    LANGFUSE_PUBLIC_KEY: getEffectiveEnvironmentVariable('LANGFUSE_PUBLIC_KEY', baseDir, settings)?.value,
    LANGFUSE_SECRET_KEY: getEffectiveEnvironmentVariable('LANGFUSE_SECRET_KEY', baseDir, settings)?.value,
    LANGFUSE_HOST: getEffectiveEnvironmentVariable('LANGFUSE_HOST', baseDir, settings)?.value,
  };
};

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

import { initializeLangfuseExporter } from './langfuse';

import type { SpanExporter } from '@opentelemetry/sdk-trace-base';

import logger from '@/logger';

const traceExporter: SpanExporter | undefined = initializeLangfuseExporter();

if (traceExporter) {
  logger.info('Initializing OpenTelemetry...');

  const sdk = new NodeSDK({
    serviceName: 'aider-desk',
    traceExporter,
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();
  logger.info('OpenTelemetry initialized.');

  // Graceful shutdown
  process.on('SIGTERM', () => {
    sdk
      .shutdown()
      .then(() => logger.info('OpenTelemetry SDK terminated'))
      .catch((error) => logger.error('Error terminating OpenTelemetry SDK', error))
      .finally(() => process.exit(0));
  });

  process.on('SIGINT', () => {
    sdk
      .shutdown()
      .then(() => logger.info('OpenTelemetry SDK terminated'))
      .catch((error) => logger.error('Error terminating OpenTelemetry SDK', error))
      .finally(() => process.exit(0));
  });
}

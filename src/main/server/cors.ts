import { Store } from '@/store';
import { CORS_ALLOWED_ORIGINS } from '@/constants';

export const createCorsOriginValidator =
  (store: Store) =>
  (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void): void => {
    if (CORS_ALLOWED_ORIGINS) {
      const origins = CORS_ALLOWED_ORIGINS.split(',')
        .map((o) => o.trim())
        .filter(Boolean);
      if (!origin || origins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
      return;
    }

    const corsSettings = store.getSettings().server.cors;
    if (!corsSettings.enabled || corsSettings.origins.length === 0) {
      callback(null, false);
      return;
    }
    if (!origin || corsSettings.origins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  };

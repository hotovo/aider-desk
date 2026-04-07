/**
 * Providers Quota Extension
 *
 * Displays API quota information for Synthetic and Z.AI providers in the task status bar.
 * Shows quota based on the active agent profile's provider.
 *
 * Setup:
 * 1. Copy this extension folder to ~/.aider-desk/extensions/providers-quota-extension/
 * 2. Create a .env file in the extension folder with:
 *    SYNTHETIC_API_KEY=your_api_key_here
 *    ZAI_API_KEY=your_zai_api_key_here
 * 3. Restart AiderDesk
 *
 * The extension will display quota usage based on the active provider.
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env files from extension directory (in order of priority)
const envFiles = ['.env', '.env.local', `.env.${process.env.NODE_ENV || 'development'}`, `.env.${process.env.NODE_ENV || 'development'}.local`];

for (const file of envFiles) {
  const envPath = join(__dirname, file);
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true });
  }
}

import type { Extension, ExtensionContext, UIComponentDefinition, PromptFinishedEvent } from '@aiderdesk/extensions';

// Cache management
const CACHE_DURATION = 60000; // 1 minute

interface CachedData<T> {
  data: T | null;
  lastFetchTime: number;
}

const syntheticCache: CachedData<SyntheticQuotaData> = { data: null, lastFetchTime: 0 };
const zaiCache: CachedData<ZaiQuotaData> = { data: null, lastFetchTime: 0 };

// Synthetic API types
interface SyntheticQuotaData {
  used: number;
  limit: number;
  percentage: number;
  renewsAt?: string;
}

interface SyntheticApiResponse {
  subscription?: {
    limit: number;
    requests: number;
    renewsAt: string;
  };
}

// Z.AI API types
interface ZaiQuotaData {
  hourlyPercentage: number;
  weeklyPercentage: number;
  hourlyNextResetTime?: number;
  weeklyNextResetTime?: number;
}

interface ZaiLimit {
  type: string;
  unit: number;
  number: number;
  percentage: number;
  nextResetTime?: number;
}

interface ZaiApiResponse {
  code: number;
  msg: string;
  data?: {
    limits: ZaiLimit[];
    level: string;
  };
  success: boolean;
}

const fetchSyntheticQuota = async (): Promise<SyntheticQuotaData | null> => {
  const apiKey = process.env.SYNTHETIC_API_KEY;

  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch("https://api.synthetic.new/v2/quotas", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error(
        `[Providers Quota] Synthetic API request failed: ${response.status} ${response.statusText}`,
      );
      return null;
    }

    const data: SyntheticApiResponse = await response.json();

    if (data.subscription) {
      const used = data.subscription.requests;
      const limit = data.subscription.limit;
      return {
        used,
        limit,
        percentage: limit > 0 ? Math.round((used / limit) * 100) : 0,
        renewsAt: data.subscription.renewsAt,
      };
    }

    return null;
  } catch (error) {
    console.error("[Providers Quota] Failed to fetch Synthetic quota:", error);
    return null;
  }
};

const fetchZaiQuota = async (): Promise<ZaiQuotaData | null> => {
  const apiKey = process.env.ZAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch(
      "https://api.z.ai/api/monitor/usage/quota/limit",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      console.error(
        `[Providers Quota] Z.AI API request failed: ${response.status} ${response.statusText}`,
      );
      return null;
    }

    const data = await response.json() as ZaiApiResponse;

    if (data.success && data.data?.limits) {
      // unit 3 = hourly, unit 6 = weekly (based on API response)
      const hourlyLimit = data.data.limits.find(
        (l) => l.type === "TOKENS_LIMIT" && l.unit === 3,
      );
      const weeklyLimit = data.data.limits.find(
        (l) => l.type === "TOKENS_LIMIT" && l.unit === 6,
      );

      return {
        hourlyPercentage: hourlyLimit?.percentage ?? 0,
        weeklyPercentage: weeklyLimit?.percentage ?? 0,
        hourlyNextResetTime: hourlyLimit?.nextResetTime,
        weeklyNextResetTime: weeklyLimit?.nextResetTime,
      };
    }

    return null;
  } catch (error) {
    console.error("[Providers Quota] Failed to fetch Z.AI quota:", error);
    return null;
  }
};

const getSyntheticQuota = async function (): Promise<SyntheticQuotaData | null> {
  const now = Date.now();

  if (syntheticCache.data && now - syntheticCache.lastFetchTime < CACHE_DURATION) {
    return syntheticCache.data;
  }

  syntheticCache.data = await fetchSyntheticQuota();
  syntheticCache.lastFetchTime = now;
  return syntheticCache.data;
};

const getZaiQuota = async function (): Promise<ZaiQuotaData | null> {
  const now = Date.now();

  if (zaiCache.data && now - zaiCache.lastFetchTime < CACHE_DURATION) {
    return zaiCache.data;
  }

  zaiCache.data = await fetchZaiQuota();
  zaiCache.lastFetchTime = now;
  return zaiCache.data;
};

const STATUS_BAR_COMPONENT_ID = 'providers-quota-indicator';

export default class ProvidersQuotaExtension implements Extension {
  static metadata = {
    name: 'Providers Quota',
    version: '1.3.0',
    description: 'Displays API quota information for Synthetic and Z.AI providers in the task status bar',
    author: 'wladimiiir',
    iconUrl: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/providers-quota-extension/icon.png',
    capabilities: ['ui'],
  };

  async onLoad(context: ExtensionContext): Promise<void> {
    const syntheticKey = process.env.SYNTHETIC_API_KEY;
    const zaiKey = process.env.ZAI_API_KEY;

    const keys: string[] = [];
    if (syntheticKey) {
      keys.push('Synthetic');
    }
    if (zaiKey) {
      keys.push('Z.AI');
    }

    if (keys.length > 0) {
      context.log(`Providers Quota Extension loaded (${keys.join(', ')})`, 'info');
    } else {
      context.log('Providers Quota Extension loaded (no API keys configured)', 'warn');
    }

    // Pre-fetch quota data
    if (syntheticKey) {
      await getSyntheticQuota();
    }
    if (zaiKey) {
      await getZaiQuota();
    }
  }

  async onPromptFinished(_event: PromptFinishedEvent, context: ExtensionContext): Promise<void> {
    // Invalidate caches to ensure fresh data after prompt
    syntheticCache.data = null;
    syntheticCache.lastFetchTime = 0;
    zaiCache.data = null;
    zaiCache.lastFetchTime = 0;

    // Trigger UI refresh
    context.triggerUIDataRefresh(STATUS_BAR_COMPONENT_ID);
  }

  getUIComponents(_context: ExtensionContext): UIComponentDefinition[] {
    const jsxTemplate = readFileSync(join(__dirname, './StatusBarComponent.jsx'), 'utf-8');

    const STATUS_BAR_COMPONENT: UIComponentDefinition = {
      id: STATUS_BAR_COMPONENT_ID,
      placement: 'task-usage-info-bottom',
      jsx: jsxTemplate,
      loadData: true,
    };

    return [STATUS_BAR_COMPONENT];
  }

  async getUIExtensionData(componentId: string): Promise<unknown> {
    if (componentId !== STATUS_BAR_COMPONENT_ID) {
      return undefined;
    }

    const hasSynthetic = !!process.env.SYNTHETIC_API_KEY;
    const hasZai = !!process.env.ZAI_API_KEY;

    // Fetch all available quotas in parallel
    const [syntheticQuota, zaiQuota] = await Promise.all([hasSynthetic ? getSyntheticQuota() : null, hasZai ? getZaiQuota() : null]);

    return {
      synthetic: syntheticQuota,
      zai: zaiQuota,
      hasSynthetic,
      hasZai,
    };
  }
}

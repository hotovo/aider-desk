/**
 * Providers Quota Extension
 *
 * Displays API quota information for Synthetic, Z.AI, Neuralwatt, and DeepSeek providers in the task status bar.
 * Shows quota based on the active agent profile's provider.
 *
 * API keys are automatically loaded from AiderDesk provider settings.
 * To override, set environment variables in a .env file in the extension directory.
 *
 * Setup:
 * 1. Copy this extension folder to ~/.aider-desk/extensions/providers-quota-extension/
 * 2. (Optional) Create a .env file in the extension folder to override API keys:
 *    SYNTHETIC_API_KEY=your_api_key_here
 *    ZAI_API_KEY=your_zai_api_key_here
 *    NEURALWATT_API_KEY=your_neuralwatt_api_key_here
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

import type { Extension, ExtensionContext, UIComponentDefinition, PromptFinishedEvent, ProviderProfile } from '@aiderdesk/extensions';

// Cache management
const CACHE_DURATION = 60000; // 1 minute

interface CachedData<T> {
  data: T | null;
  lastFetchTime: number;
}

const syntheticCache: CachedData<SyntheticQuotaData> = { data: null, lastFetchTime: 0 };
const zaiCache: CachedData<ZaiQuotaData> = { data: null, lastFetchTime: 0 };
const neuralwattCache: CachedData<NeuralwattQuotaData> = { data: null, lastFetchTime: 0 };
const deepseekCache: CachedData<DeepseekQuotaData> = { data: null, lastFetchTime: 0 };

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

// Neuralwatt API types
interface NeuralwattQuotaData {
  isSubscription: boolean;
  // Subscription fields
  kwhUsed?: number;
  kwhIncluded?: number;
  kwhPercentage?: number;
  currentPeriodEnd?: string;
  plan?: string;
  inOverage?: boolean;
  // Pay-as-you-go fields
  creditsRemaining?: number;
  creditsTotal?: number;
  creditsPercentage?: number;
  accountingMethod?: string;
}

interface NeuralwattApiResponse {
  snapshot_at: string;
  balance: {
    credits_remaining_usd: number;
    total_credits_usd: number;
    credits_used_usd: number;
    accounting_method: string;
  };
  usage: {
    lifetime: { cost_usd: number; requests: number; tokens: number; energy_kwh: number };
    current_month: { cost_usd: number; requests: number; tokens: number; energy_kwh: number };
  };
  limits: {
    overage_limit_usd: number | null;
    rate_limit_tier: string;
  };
  subscription: {
    plan: string;
    status: string;
    billing_interval: string | null;
    current_period_start: string | null;
    current_period_end: string | null;
    auto_renew: boolean | null;
    kwh_included: number | null;
    kwh_used: number | null;
    kwh_remaining: number | null;
    in_overage: boolean | null;
  } | null;
  key: {
    name: string | null;
    allowance: {
      limit_usd: number;
      period: string;
      spent_usd: number;
      remaining_usd: number;
      blocked: boolean;
    } | null;
  };
}

// DeepSeek API types
interface DeepseekBalanceInfo {
  currency: string;
  total_balance: string;
  granted_balance: string;
  topped_up_balance: string;
}

interface DeepseekApiResponse {
  is_available: boolean;
  balance_infos: DeepseekBalanceInfo[];
}

interface DeepseekQuotaData {
  isAvailable: boolean;
  balance?: DeepseekBalanceInfo;
}

// API key resolution: env var override → AiderDesk provider settings
const getApiKey = (envVarName: string, providerName: string, context?: ExtensionContext): string | undefined => {
  const envKey = process.env[envVarName];
  if (envKey) {
    return envKey;
  }

  if (context) {
    try {
      const providers = context.getProviders();
      const profile = providers.find((p: ProviderProfile) => {
        const provider = p.provider as Record<string, unknown>;
        return provider && provider.name === providerName;
      });
      if (profile) {
        const provider = profile.provider as Record<string, unknown>;
        return (provider.apiKey as string) || undefined;
      }
    } catch {
      // Provider not found or not accessible
    }
  }

  return undefined;
};

const fetchSyntheticQuota = async (context?: ExtensionContext): Promise<SyntheticQuotaData | null> => {
  const apiKey = getApiKey('SYNTHETIC_API_KEY', 'synthetic', context);

  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch('https://api.synthetic.new/v2/quotas', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[Providers Quota] Synthetic API request failed: ${response.status} ${response.statusText}`);
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
    console.error('[Providers Quota] Failed to fetch Synthetic quota:', error);
    return null;
  }
};

const fetchZaiQuota = async (context?: ExtensionContext): Promise<ZaiQuotaData | null> => {
  const apiKey = getApiKey('ZAI_API_KEY', 'zai-plan', context);

  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch('https://api.z.ai/api/monitor/usage/quota/limit', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[Providers Quota] Z.AI API request failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = (await response.json()) as ZaiApiResponse;

    if (data.success && data.data?.limits) {
      // unit 3 = hourly, unit 6 = weekly (based on API response)
      const hourlyLimit = data.data.limits.find((l) => l.type === 'TOKENS_LIMIT' && l.unit === 3);
      const weeklyLimit = data.data.limits.find((l) => l.type === 'TOKENS_LIMIT' && l.unit === 6);

      return {
        hourlyPercentage: hourlyLimit?.percentage ?? 0,
        weeklyPercentage: weeklyLimit?.percentage ?? 0,
        hourlyNextResetTime: hourlyLimit?.nextResetTime,
        weeklyNextResetTime: weeklyLimit?.nextResetTime,
      };
    }

    return null;
  } catch (error) {
    console.error('[Providers Quota] Failed to fetch Z.AI quota:', error);
    return null;
  }
};

const fetchNeuralwattQuota = async (context?: ExtensionContext): Promise<NeuralwattQuotaData | null> => {
  const apiKey = getApiKey('NEURALWATT_API_KEY', 'neuralwatt', context);

  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch('https://api.neuralwatt.com/v1/quota', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[Providers Quota] Neuralwatt API request failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const data: NeuralwattApiResponse = await response.json();

    if (data.subscription && data.subscription.status === 'active') {
      const kwhUsed = data.subscription.kwh_used ?? 0;
      const kwhIncluded = data.subscription.kwh_included ?? 0;
      return {
        isSubscription: true,
        kwhUsed,
        kwhIncluded,
        kwhPercentage: kwhIncluded > 0 ? Math.round((kwhUsed / kwhIncluded) * 100) : 0,
        currentPeriodEnd: data.subscription.current_period_end ?? undefined,
        plan: data.subscription.plan,
        inOverage: data.subscription.in_overage ?? false,
      };
    }

    return {
      isSubscription: false,
      creditsRemaining: data.balance.credits_remaining_usd,
      creditsTotal: data.balance.total_credits_usd,
      creditsPercentage: data.balance.total_credits_usd > 0 ? Math.round((data.balance.credits_remaining_usd / data.balance.total_credits_usd) * 100) : 0,
      accountingMethod: data.balance.accounting_method,
    };
  } catch (error) {
    console.error('[Providers Quota] Failed to fetch Neuralwatt quota:', error);
    return null;
  }
};

const getSyntheticQuota = async (context?: ExtensionContext): Promise<SyntheticQuotaData | null> => {
  const now = Date.now();

  if (syntheticCache.data && now - syntheticCache.lastFetchTime < CACHE_DURATION) {
    return syntheticCache.data;
  }

  syntheticCache.data = await fetchSyntheticQuota(context);
  syntheticCache.lastFetchTime = now;
  return syntheticCache.data;
};

const getZaiQuota = async (context?: ExtensionContext): Promise<ZaiQuotaData | null> => {
  const now = Date.now();

  if (zaiCache.data && now - zaiCache.lastFetchTime < CACHE_DURATION) {
    return zaiCache.data;
  }

  zaiCache.data = await fetchZaiQuota(context);
  zaiCache.lastFetchTime = now;
  return zaiCache.data;
};

const fetchDeepseekBalance = async (context?: ExtensionContext): Promise<DeepseekQuotaData | null> => {
  const apiKey = getApiKey('DEEPSEEK_API_KEY', 'deepseek', context);

  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch('https://api.deepseek.com/user/balance', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[Providers Quota] DeepSeek API request failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = (await response.json()) as DeepseekApiResponse;

    return {
      isAvailable: data.is_available,
      balance: data.balance_infos?.[0],
    };
  } catch (error) {
    console.error('[Providers Quota] Failed to fetch DeepSeek balance:', error);
    return null;
  }
};

const getDeepseekBalance = async (context?: ExtensionContext): Promise<DeepseekQuotaData | null> => {
  const now = Date.now();

  if (deepseekCache.data && now - deepseekCache.lastFetchTime < CACHE_DURATION) {
    return deepseekCache.data;
  }

  deepseekCache.data = await fetchDeepseekBalance(context);
  deepseekCache.lastFetchTime = now;
  return deepseekCache.data;
};

const getNeuralwattQuota = async (context?: ExtensionContext): Promise<NeuralwattQuotaData | null> => {
  const now = Date.now();

  if (neuralwattCache.data && now - neuralwattCache.lastFetchTime < CACHE_DURATION) {
    return neuralwattCache.data;
  }

  neuralwattCache.data = await fetchNeuralwattQuota(context);
  neuralwattCache.lastFetchTime = now;
  return neuralwattCache.data;
};

const STATUS_BAR_COMPONENT_ID = 'providers-quota-indicator';

export default class ProvidersQuotaExtension implements Extension {
  static metadata = {
    name: 'Providers Quota',
    version: '1.5.1',
    description: 'Displays API quota information for Synthetic, Z.AI, Neuralwatt, and DeepSeek providers in the task status bar',
    author: 'wladimiiir',
    iconUrl: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/providers-quota-extension/icon.png',
    capabilities: ['ui'],
  };

  async onLoad(context: ExtensionContext): Promise<void> {
    const syntheticKey = getApiKey('SYNTHETIC_API_KEY', 'synthetic', context);
    const zaiKey = getApiKey('ZAI_API_KEY', 'zai-plan', context);
    const neuralwattKey = getApiKey('NEURALWATT_API_KEY', 'neuralwatt', context);
    const deepseekKey = getApiKey('DEEPSEEK_API_KEY', 'deepseek', context);

    const keys: string[] = [];
    if (syntheticKey) {
      keys.push('Synthetic');
    }
    if (zaiKey) {
      keys.push('Z.AI');
    }
    if (neuralwattKey) {
      keys.push('Neuralwatt');
    }
    if (deepseekKey) {
      keys.push('DeepSeek');
    }

    if (keys.length > 0) {
      context.log(`Providers Quota Extension loaded (${keys.join(', ')})`, 'info');
    } else {
      context.log('Providers Quota Extension loaded (no API keys configured)', 'warn');
    }

    // Pre-fetch quota data
    if (syntheticKey) {
      await getSyntheticQuota(context);
    }
    if (zaiKey) {
      await getZaiQuota(context);
    }
    if (neuralwattKey) {
      await getNeuralwattQuota(context);
    }
    if (deepseekKey) {
      await getDeepseekBalance(context);
    }
  }

  async onPromptFinished(_event: PromptFinishedEvent, context: ExtensionContext): Promise<void> {
    // Invalidate caches to ensure fresh data after prompt
    syntheticCache.data = null;
    syntheticCache.lastFetchTime = 0;
    zaiCache.data = null;
    zaiCache.lastFetchTime = 0;
    neuralwattCache.data = null;
    neuralwattCache.lastFetchTime = 0;
    deepseekCache.data = null;
    deepseekCache.lastFetchTime = 0;

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

  async getUIExtensionData(componentId: string, context: ExtensionContext): Promise<unknown> {
    if (componentId !== STATUS_BAR_COMPONENT_ID) {
      return undefined;
    }

    const hasSynthetic = !!getApiKey('SYNTHETIC_API_KEY', 'synthetic', context);
    const hasZai = !!getApiKey('ZAI_API_KEY', 'zai-plan', context);
    const hasNeuralwatt = !!getApiKey('NEURALWATT_API_KEY', 'neuralwatt', context);
    const hasDeepseek = !!getApiKey('DEEPSEEK_API_KEY', 'deepseek', context);

    // Fetch all available quotas in parallel
    const [syntheticQuota, zaiQuota, neuralwattQuota, deepseekQuota] = await Promise.all([
      hasSynthetic ? getSyntheticQuota(context) : null,
      hasZai ? getZaiQuota(context) : null,
      hasNeuralwatt ? getNeuralwattQuota(context) : null,
      hasDeepseek ? getDeepseekBalance(context) : null,
    ]);

    return {
      synthetic: syntheticQuota,
      zai: zaiQuota,
      neuralwatt: neuralwattQuota,
      deepseek: deepseekQuota,
      hasSynthetic,
      hasZai,
      hasNeuralwatt,
      hasDeepseek,
    };
  }
}

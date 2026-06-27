export type NativeToolsMode = 'reject' | 'redirect' | 'native'

export interface CursorProxyConfig {
  nativeToolsMode: NativeToolsMode
  maxMode: boolean
  fast: boolean
  thinking: boolean
  maxRetries: number
}

export const DEFAULT_CONFIG: Readonly<CursorProxyConfig> = {
  nativeToolsMode: 'reject',
  maxMode: false,
  fast: false,
  thinking: true,
  maxRetries: 2,
}

const MAX_RETRIES_CAP = 10

const VALID_NATIVE_TOOLS_MODES: ReadonlySet<string> = new Set(['reject', 'redirect', 'native'])

export function isNativeToolsMode(v: unknown): v is NativeToolsMode {
  return typeof v === 'string' && VALID_NATIVE_TOOLS_MODES.has(v)
}

export function validateConfig(raw: Record<string, unknown>): CursorProxyConfig {
  return {
    nativeToolsMode: isNativeToolsMode(raw.nativeToolsMode) ? raw.nativeToolsMode : DEFAULT_CONFIG.nativeToolsMode,
    maxMode: typeof raw.maxMode === 'boolean' ? raw.maxMode : DEFAULT_CONFIG.maxMode,
    fast: typeof raw.fast === 'boolean' ? raw.fast : DEFAULT_CONFIG.fast,
    thinking: typeof raw.thinking === 'boolean' ? raw.thinking : DEFAULT_CONFIG.thinking,
    maxRetries:
      typeof raw.maxRetries === 'number' && Number.isFinite(raw.maxRetries) && raw.maxRetries >= 0
        ? Math.min(Math.floor(raw.maxRetries), MAX_RETRIES_CAP)
        : DEFAULT_CONFIG.maxRetries,
  }
}

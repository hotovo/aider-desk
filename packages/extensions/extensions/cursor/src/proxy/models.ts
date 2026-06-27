/**
 * Cursor model discovery via AvailableModels RPC (aiserver.v1).
 *
 * Cursor's API returns normalized models with `legacySlugs` listing the
 * old effort/fast/thinking-suffixed model IDs. The proxy uses these slugs
 * to determine available effort levels and fast support per model, then
 * sends legacy slug IDs at request time.
 */
import { create, fromBinary, toBinary } from '@bufbuild/protobuf'

import {
  AvailableModelsRequestSchema,
  type AvailableModelsResponse,
  type AvailableModelsResponse_AvailableModel,
  AvailableModelsResponseSchema,
} from '../proto/aiserver_pb'
import { decodeConnectUnaryBody } from './connect-protocol'
import { callCursorUnaryRpc } from './cursor-session'

const AVAILABLE_MODELS_PATH = '/aiserver.v1.AiService/AvailableModels'

const DEFAULT_CONTEXT_WINDOW = 200_000
const DEFAULT_MAX_TOKENS = 64_000

export interface CursorModel {
  id: string
  name: string
  reasoning: boolean
  contextWindow: number
  /** Larger context tier from the API (`contextTokenLimitForMaxMode`). Used to register long-context model variants. */
  contextWindowMaxMode?: number
  maxTokens: number
  supportsImages: boolean
  supportsMaxMode: boolean
  /** Old suffixed model IDs. Used to build effort/fast metadata and resolve at request time. */
  legacySlugs?: string[]
}

// ---------------------------------------------------------------------------
// Name formatting
// ---------------------------------------------------------------------------

const PRETTY_NAME_OVERRIDES: Record<string, string> = {
  'composer-1': 'Composer 1',
  'composer-1.5': 'Composer 1.5',
  'composer-2': 'Composer 2',
}

const RAW_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/

function prettyCursorModelName(modelId: string): string {
  const normalizedId = modelId.trim().toLowerCase()
  if (!normalizedId) {
    return modelId
  }

  const overridden = PRETTY_NAME_OVERRIDES[normalizedId]
  if (overridden) {
    return overridden
  }

  const parts = normalizedId.split('-').filter(Boolean)
  if (parts.length === 0) {
    return modelId
  }

  switch (parts[0]) {
    case 'claude': {
      return formatClaudeName(parts.slice(1))
    }
    case 'gpt': {
      return formatGptName(parts.slice(1))
    }
    case 'gemini': {
      return formatPrefixedName('Gemini', parts.slice(1))
    }
    case 'composer': {
      return formatPrefixedName('Composer', parts.slice(1))
    }
    default: {
      return parts.map(formatToken).join(' ')
    }
  }
}

function resolveCursorModelName(modelId: string, discoveredName?: string): string {
  const preferredName = discoveredName?.trim()
  if (preferredName && !looksLikeRawModelName(preferredName, modelId)) {
    return preferredName
  }
  return prettyCursorModelName(modelId)
}

function looksLikeRawModelName(name: string, modelId: string): boolean {
  const normalizedName = name.trim()
  if (!normalizedName) {
    return true
  }
  if (normalizedName.toLowerCase() === modelId.trim().toLowerCase()) {
    return true
  }
  return RAW_NAME_PATTERN.test(normalizedName)
}

function formatClaudeName(parts: string[]): string {
  const [version, family, ...rest] = parts
  return ['Claude', family ? formatToken(family) : '', version || '', ...rest.map(formatToken)]
    .filter(Boolean)
    .join(' ')
}

function formatGptName(parts: string[]): string {
  const [version, ...rest] = parts
  return [`GPT${version ? `-${version}` : ''}`, ...rest.map(formatToken)].filter(Boolean).join(' ')
}

function formatPrefixedName(prefix: string, parts: string[]): string {
  return [prefix, ...parts.map(formatToken)].join(' ')
}

function formatToken(token: string): string {
  if (/^\d+(\.\d+)?$/.test(token)) {
    return token
  }
  if (/^\d+m$/.test(token)) {
    return `${token.slice(0, -1)}M`
  }
  if (token === 'xhigh') {
    return 'XHigh'
  }
  if (token === 'gpt') {
    return 'GPT'
  }
  return token.charAt(0).toUpperCase() + token.slice(1)
}

// ---------------------------------------------------------------------------
// Protobuf decoding
// ---------------------------------------------------------------------------

function decodeConnectResponse<T>(schema: Parameters<typeof fromBinary>[0], payload: Uint8Array): T | null {
  try {
    return fromBinary(schema, payload) as T
  } catch {
    const framedBody = decodeConnectUnaryBody(payload)
    if (!framedBody) {
      return null
    }
    try {
      return fromBinary(schema, framedBody) as T
    } catch {
      return null
    }
  }
}

// ---------------------------------------------------------------------------
// Model normalization
// ---------------------------------------------------------------------------

function normalizeAvailableModel(m: AvailableModelsResponse_AvailableModel): CursorModel | null {
  const id = m.name.trim()
  if (!id) {
    return null
  }
  if (m.isHidden || m.isChatOnly || m.onlySupportsCmdK) {
    return null
  }

  return {
    id,
    name: resolveCursorModelName(id, m.clientDisplayName),
    reasoning: m.supportsThinking === true,
    contextWindow: m.contextTokenLimit ?? DEFAULT_CONTEXT_WINDOW,
    contextWindowMaxMode: m.contextTokenLimitForMaxMode ?? undefined,
    maxTokens: DEFAULT_MAX_TOKENS,
    supportsImages: m.supportsImages === true,
    supportsMaxMode: m.supportsMaxMode === true,
    legacySlugs: m.legacySlugs.length > 0 ? [...m.legacySlugs] : undefined,
  }
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

/** Discovers all usable Cursor models via the AvailableModels RPC. */
export async function discoverCursorModels(accessToken: string): Promise<CursorModel[]> {
  try {
    const req = create(AvailableModelsRequestSchema, {
      includeLongContextModels: true,
      includeHiddenModels: true,
    })

    const responseBytes = await callCursorUnaryRpc({
      accessToken,
      rpcPath: AVAILABLE_MODELS_PATH,
      requestBody: toBinary(AvailableModelsRequestSchema, req),
    })

    if (responseBytes.length === 0) {
      return []
    }

    const decoded = decodeConnectResponse<AvailableModelsResponse>(AvailableModelsResponseSchema, responseBytes)
    if (!decoded || decoded.models.length === 0) {
      return []
    }

    // --- DEBUG: Capture param comparison when enabled ---
    if (process.env.PI_CURSOR_CAPTURE_PARAMS === '1') {
      void captureModelParameters(accessToken, decoded).catch((error) =>
        console.error('[models] param capture failed:', error instanceof Error ? error.message : String(error)),
      )
    }

    const models = decoded.models
      .map((m) => normalizeAvailableModel(m))
      .filter((m): m is CursorModel => m !== null)
      .sort((a, b) => a.id.localeCompare(b.id))

    // Log distinct context tiers for diagnostics
    const distinctContextLimits = new Set(
      decoded.models.filter((m) => m.contextTokenLimit !== undefined).map((m) => m.contextTokenLimit),
    )
    if (distinctContextLimits.size > 2) {
      console.error(
        `[models] Found ${String(distinctContextLimits.size)} distinct context token limits: ` +
          `${[...distinctContextLimits].sort((a, b) => (a ?? 0) - (b ?? 0)).join(', ')}`,
      )
    }

    console.error(`[models] Discovered ${String(models.length)} models`)
    return models
  } catch (error) {
    console.error('[models] AvailableModels RPC failed:', error instanceof Error ? error.message : String(error))
    return []
  }
}

// ---------------------------------------------------------------------------
// DEBUG: Capture useModelParameters response for investigation
// ---------------------------------------------------------------------------

async function captureModelParameters(accessToken: string, oldResponse: AvailableModelsResponse): Promise<void> {
  const { writeFileSync, mkdirSync } = await import('node:fs')
  const { join } = await import('node:path')
  const { homedir } = await import('node:os')

  const outDir = join(homedir(), '.pi', 'agent', 'cursor-captures')
  mkdirSync(outDir, { recursive: true })
  const ts = new Date().toISOString().replaceAll(':', '-').slice(0, 19)

  const serialize = (m: AvailableModelsResponse_AvailableModel) => ({
    name: m.name,
    clientDisplayName: m.clientDisplayName,
    supportsMaxMode: m.supportsMaxMode,
    supportsNonMaxMode: m.supportsNonMaxMode,
    supportsThinking: m.supportsThinking,
    supportsImages: m.supportsImages,
    contextTokenLimit: m.contextTokenLimit,
    contextTokenLimitForMaxMode: m.contextTokenLimitForMaxMode,
    serverModelName: m.serverModelName,
    inputboxShortModelName: m.inputboxShortModelName,
    tagline: m.tagline,
    legacySlugs: m.legacySlugs,
    idAliases: m.idAliases,
    supportsAgent: m.supportsAgent,
    supportsPlanMode: m.supportsPlanMode,
    supportsSandboxing: m.supportsSandboxing,
    isChatOnly: m.isChatOnly,
    isHidden: m.isHidden,
    defaultOn: m.defaultOn,
  })

  writeFileSync(join(outDir, `${ts}-old.json`), JSON.stringify(oldResponse.models.map(serialize), null, 2))

  // Fetch with useModelParameters=true
  const reqParams = create(AvailableModelsRequestSchema, {
    includeLongContextModels: true,
    includeHiddenModels: true,
    useModelParameters: true,
  })
  const respBytes = await callCursorUnaryRpc({
    accessToken,
    rpcPath: AVAILABLE_MODELS_PATH,
    requestBody: toBinary(AvailableModelsRequestSchema, reqParams),
  })
  const decoded = decodeConnectResponse<AvailableModelsResponse>(AvailableModelsResponseSchema, respBytes)
  if (decoded) {
    writeFileSync(join(outDir, `${ts}-with-params.json`), JSON.stringify(decoded.models.map(serialize), null, 2))
    console.error(`[models] Wrote captures to ${outDir}`)
  }

  // Also try with variantsWillBeShownInExplodedList=true
  const reqExploded = create(AvailableModelsRequestSchema, {
    includeLongContextModels: true,
    includeHiddenModels: true,
    useModelParameters: true,
    variantsWillBeShownInExplodedList: true,
  })
  const respExplodedBytes = await callCursorUnaryRpc({
    accessToken,
    rpcPath: AVAILABLE_MODELS_PATH,
    requestBody: toBinary(AvailableModelsRequestSchema, reqExploded),
  })
  const decodedExploded = decodeConnectResponse<AvailableModelsResponse>(
    AvailableModelsResponseSchema,
    respExplodedBytes,
  )
  if (decodedExploded) {
    writeFileSync(join(outDir, `${ts}-exploded.json`), JSON.stringify(decodedExploded.models.map(serialize), null, 2))
  }
}

import type { CursorModel } from './models'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Effort suffixes found in Cursor legacy slug model IDs */
export type CursorEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'

/** Result of parsing a legacy slug into its components */
export interface ParsedSlug {
  /** Base model name without any suffixes */
  base: string
  /** Effort level suffix if present */
  effort: CursorEffort | null
  /** Whether -thinking suffix was present */
  thinking: boolean
  /** Whether -fast suffix was present */
  fast: boolean
}

/** Per-model metadata extracted from legacy slugs */
export interface ModelMeta {
  /** Available effort levels for this model */
  efforts: Set<CursorEffort | 'default'>
  /** Whether this model has fast variants */
  supportsFast: boolean
  /** Whether this model has thinking variants */
  supportsThinking: boolean
}

/** The complete normalized model set */
export interface NormalizedModelSet {
  /** Deduplicated models for the /v1/models endpoint */
  models: CursorModel[]
  /** Per-model metadata keyed by model ID */
  modelMeta: Map<string, ModelMeta>
  /** Effort maps keyed by model ID */
  effortMaps: Map<string, Record<string, string>>
  /**
   * Slug resolution table: maps "(modelId)|(effort)|(fast)|(thinking)" to the
   * legacy slug that Cursor's server accepts.
   */
  slugLookup: Map<string, string>
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EFFORT_SUFFIXES: ReadonlySet<string> = new Set(['none', 'low', 'medium', 'high', 'xhigh', 'max'])

// ---------------------------------------------------------------------------
// parseSlug
// ---------------------------------------------------------------------------

/**
 * Parse a legacy slug by stripping suffixes in order:
 * 1. Strip `-fast` → speed variant
 * 2. Strip `-thinking` → thinking variant
 * 3. Parse effort from last remaining segment
 * 4. Remaining segments → base name
 */
export function parseSlug(slug: string): ParsedSlug {
  let remaining = slug

  // 1. Strip -fast
  let fast = false
  if (remaining.endsWith('-fast')) {
    fast = true
    remaining = remaining.slice(0, -5)
  }

  // 2. Strip -thinking
  let thinking = false
  if (remaining.endsWith('-thinking')) {
    thinking = true
    remaining = remaining.slice(0, -9)
  }

  // 3. Parse effort from last segment
  let effort: CursorEffort | null = null
  const segments = remaining.split('-')
  if (segments.length > 1) {
    const lastSegment = segments.at(-1) ?? ''
    if (EFFORT_SUFFIXES.has(lastSegment)) {
      effort = lastSegment as CursorEffort
      segments.pop()
      remaining = segments.join('-')
    }
  }

  return { base: remaining, effort, thinking, fast }
}

// ---------------------------------------------------------------------------
// buildEffortMap
// ---------------------------------------------------------------------------

/**
 * Map Pi's effort levels to the best available Cursor effort suffix.
 *
 * - minimal → none if available, else low, else lowest available
 * - low → low if available, else none, else lowest available
 * - medium → medium if available, else 'default' (no suffix)
 * - high → high if available, else highest below xhigh
 * - xhigh → max if available, else xhigh, else high
 */
export function buildEffortMap(availableEfforts: Set<CursorEffort | 'default'>): Record<string, string> {
  const orderedEfforts: (CursorEffort | 'default')[] = ['none', 'low', 'default', 'medium', 'high', 'xhigh', 'max']
  const available = orderedEfforts.filter((e) => availableEfforts.has(e))

  if (available.length === 0) {
    return { minimal: '', low: '', medium: '', high: '', xhigh: '' }
  }

  const lowest = available.at(0) ?? 'default'
  const highest = available.at(-1) ?? 'default'

  function pick(preferred: (CursorEffort | 'default')[], fallback: CursorEffort | 'default'): string {
    for (const p of preferred) {
      if (availableEfforts.has(p)) {
        return effortToSuffix(p)
      }
    }
    return effortToSuffix(fallback)
  }

  const highFallback: CursorEffort | 'default' = highest === 'max' || highest === 'xhigh' ? 'high' : highest

  return {
    minimal: pick(['none', 'low'], lowest),
    low: pick(['low', 'none'], lowest),
    medium: pick(['medium', 'default'], lowest),
    high: pick(['high'], highFallback),
    xhigh: pick(['max', 'xhigh', 'high'], highest),
  }
}

function effortToSuffix(effort: CursorEffort | 'default'): string {
  return effort === 'default' ? '' : effort
}

// ---------------------------------------------------------------------------
// processModels
// ---------------------------------------------------------------------------

/**
 * Build the normalized model set from discovered models.
 *
 * Parses each model's `legacySlugs` to determine available effort levels,
 * fast support, and thinking support. Builds effort maps and a slug
 * resolution table for request-time model ID reconstruction.
 */
export function processModels(rawModels: CursorModel[]): NormalizedModelSet {
  const modelMeta = new Map<string, ModelMeta>()
  const effortMaps = new Map<string, Record<string, string>>()
  const slugLookup = new Map<string, string>()

  for (const model of rawModels) {
    const meta: ModelMeta = {
      efforts: new Set(['default']),
      supportsFast: false,
      supportsThinking: false,
    }

    if (model.legacySlugs) {
      for (const slug of model.legacySlugs) {
        const parsed = parseSlug(slug)

        if (parsed.effort) {
          meta.efforts.add(parsed.effort)
        }
        if (parsed.fast) {
          meta.supportsFast = true
        }
        if (parsed.thinking) {
          meta.supportsThinking = true
        }

        // Build slug lookup key: "modelId|effort|fast|thinking"
        const effort = parsed.effort ?? 'default'
        const key = `${model.id}|${effort}|${String(parsed.fast)}|${String(parsed.thinking)}`
        slugLookup.set(key, slug)
      }
    }

    modelMeta.set(model.id, meta)

    // Build effort map if model has effort variants
    const hasEffortVariants = meta.efforts.size > 1 || (meta.efforts.size === 1 && !meta.efforts.has('default'))
    if (hasEffortVariants) {
      effortMaps.set(model.id, buildEffortMap(meta.efforts))
    }
  }

  return { models: rawModels, modelMeta, effortMaps, slugLookup }
}

// ---------------------------------------------------------------------------
// resolveModelId
// ---------------------------------------------------------------------------

/**
 * Resolve a requested model ID + settings into the model ID that
 * Cursor's server accepts.
 *
 * Exact discovered model IDs are returned unchanged. For unknown IDs the
 * legacy slug resolution table is consulted; if no match, returns the
 * model ID as-is.
 */
export function resolveModelId(
  modelId: string,
  effort: string | null,
  fast: boolean,
  thinking: boolean,
  modelSet: NormalizedModelSet,
): string {
  // Cursor's server rejects legacy slugs with `not_found` — discovered model
  // IDs (which already encode thinking/effort/fast variants, e.g.
  // "claude-sonnet-5-thinking-high") must be sent exactly as-is.
  if (modelSet.modelMeta.has(modelId)) {
    return modelId
  }

  const meta = modelSet.modelMeta.get(modelId)
  if (!meta) {
    return modelId
  }

  // Resolve effort suffix from effort map
  let resolvedEffort = 'default'
  if (effort) {
    const effortMap = modelSet.effortMaps.get(modelId)
    if (effortMap && Object.hasOwn(effortMap, effort)) {
      const suffix = effortMap[effort]
      resolvedEffort = suffix || 'default'
    } else if (EFFORT_SUFFIXES.has(effort)) {
      resolvedEffort = effort
    }
  }

  // Silently ignore flags the model doesn't support
  const effectiveFast = fast && meta.supportsFast
  const effectiveThinking = thinking && meta.supportsThinking

  // Look up the legacy slug
  const key = `${modelId}|${resolvedEffort}|${String(effectiveFast)}|${String(effectiveThinking)}`
  const slug = modelSet.slugLookup.get(key)
  if (slug) {
    return slug
  }

  // Fallback: try without thinking
  if (effectiveThinking) {
    const keyNoThinking = `${modelId}|${resolvedEffort}|${String(effectiveFast)}|false`
    const slugNoThinking = modelSet.slugLookup.get(keyNoThinking)
    if (slugNoThinking) {
      return slugNoThinking
    }
  }

  // Fallback: try without fast
  if (effectiveFast) {
    const keyNoFast = `${modelId}|${resolvedEffort}|false|${String(effectiveThinking)}`
    const slugNoFast = modelSet.slugLookup.get(keyNoFast)
    if (slugNoFast) {
      return slugNoFast
    }
  }

  // Fallback: try bare effort only
  if (resolvedEffort !== 'default') {
    const keyBare = `${modelId}|${resolvedEffort}|false|false`
    const slugBare = modelSet.slugLookup.get(keyBare)
    if (slugBare) {
      return slugBare
    }
  }

  // No slug found — return model ID as-is (e.g. gemini models with no legacy slugs)
  return modelId
}

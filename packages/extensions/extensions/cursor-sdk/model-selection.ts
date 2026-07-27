import type { ModelListItem, ModelParameterValue, ModelSelection } from '@cursor/sdk';

const EFFORT_PARAM_ID = 'effort';
const REASONING_PARAM_ID = 'reasoning';
const THINKING_PARAM_ID = 'thinking';
const CONTEXT_PARAM_ID = 'context';
const FAST_PARAM_ID = 'fast';
const FAST_MODEL_SUFFIX = '-fast';
const LEGACY_MODEL_PARAMS_SEPARATOR = '#cursor-sdk-params=';

type ModelAlias = {
  id: string;
  selection: ModelSelection;
};

const normalizeParams = (params: ModelParameterValue[]): ModelParameterValue[] =>
  [...params].sort((left, right) => left.id.localeCompare(right.id));

const getDefaultParams = (model: ModelListItem): ModelParameterValue[] => {
  const defaultVariant = model.variants?.find((variant) => variant.isDefault);
  if (defaultVariant) {
    return normalizeParams(defaultVariant.params);
  }

  return normalizeParams(
    (model.parameters ?? []).flatMap((parameter) => {
      const defaultValue = parameter.values[0];
      return defaultValue ? [{ id: parameter.id, value: defaultValue.value }] : [];
    }),
  );
};

const getSelectionKey = (selection: ModelSelection): string =>
  JSON.stringify({ id: selection.id, params: normalizeParams(selection.params ?? []) });

const getParamValue = (params: ModelParameterValue[], id: string): string | undefined =>
  params.find((param) => param.id === id)?.value;

const getReasoningLevel = (params: ModelParameterValue[]): string | undefined =>
  getParamValue(params, EFFORT_PARAM_ID) ?? getParamValue(params, REASONING_PARAM_ID);

const supportsVisibleThinking = (params: ModelParameterValue[]): boolean => {
  const reasoningLevel = getReasoningLevel(params);
  if (!reasoningLevel) return true;

  return reasoningLevel !== 'none' && getParamValue(params, THINKING_PARAM_ID) !== 'false';
};

const createAliasId = (modelId: string, params: ModelParameterValue[]): string => {
  const reasoningLevel = getReasoningLevel(params);
  const isFast = getParamValue(params, FAST_PARAM_ID) === 'true';
  const hasOneMillionContext = getParamValue(params, CONTEXT_PARAM_ID) === '1m';
  const suffix = [reasoningLevel, isFast ? 'fast' : undefined].filter(Boolean).join('-');

  return `${modelId}${suffix ? `-${suffix}` : ''}${hasOneMillionContext ? '[1m]' : ''}`;
};

export const createModelAliases = (model: ModelListItem): ModelAlias[] => {
  const defaultParams = getDefaultParams(model);
  const candidates: ModelSelection[] = [
    ...((defaultParams.length > 0 || !model.variants?.length)
      ? [{ id: model.id, ...(defaultParams.length > 0 ? { params: defaultParams } : {}) }]
      : []),
    ...(model.variants ?? []).map((variant) => ({
      id: model.id,
      params: normalizeParams(variant.params),
    })),
  ];

  if (!model.variants?.length && defaultParams.length > 0) {
    for (const parameter of model.parameters ?? []) {
      for (const value of parameter.values) {
        candidates.push({
          id: model.id,
          params: normalizeParams([
            ...defaultParams.filter((defaultParam) => defaultParam.id !== parameter.id),
            { id: parameter.id, value: value.value },
          ]),
        });
      }
    }
  }

  const aliases = new Map<string, ModelAlias>();
  const usedAliases = new Map<string, number>();
  const seenSelections = new Set<string>();

  for (const candidate of candidates) {
    const selectionKey = getSelectionKey(candidate);
    if (seenSelections.has(selectionKey)) continue;
    seenSelections.add(selectionKey);

    const params = candidate.params ?? [];
    if (!supportsVisibleThinking(params)) continue;

    const aliasBase = createAliasId(candidate.id, params);
    const duplicateNumber = usedAliases.get(aliasBase) ?? 0;
    usedAliases.set(aliasBase, duplicateNumber + 1);
    const id = duplicateNumber === 0 ? aliasBase : `${aliasBase}-${duplicateNumber + 1}`;
    aliases.set(id, { id, selection: candidate });
  }

  return [...aliases.values()];
};

export const resolveModelSelection = (
  modelId: string,
  aliases: Map<string, ModelSelection>,
): ModelSelection => {
  const selection = aliases.get(modelId);
  if (selection) return selection;

  const legacyParamsIndex = modelId.lastIndexOf(LEGACY_MODEL_PARAMS_SEPARATOR);
  if (legacyParamsIndex !== -1) {
    try {
      const id = modelId.slice(0, legacyParamsIndex);
      const params = modelId.slice(legacyParamsIndex + LEGACY_MODEL_PARAMS_SEPARATOR.length)
        .split('&')
        .flatMap((pair) => {
          const equalsIndex = pair.indexOf('=');
          if (equalsIndex === -1) return [];
          return [{
            id: decodeURIComponent(pair.slice(0, equalsIndex)),
            value: decodeURIComponent(pair.slice(equalsIndex + 1)),
          }];
        });
      return { id, params: normalizeParams(params) };
    } catch {
      return { id: modelId };
    }
  }

  if (modelId.endsWith(FAST_MODEL_SUFFIX)) {
    return {
      id: modelId.slice(0, -FAST_MODEL_SUFFIX.length),
      params: [{ id: FAST_PARAM_ID, value: 'true' }],
    };
  }

  return { id: modelId };
};

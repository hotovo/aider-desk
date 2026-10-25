export type TruncatedToolResult = {
  truncated: true;
  note: string;
  originalLength?: number;
  preview?: string;
};

export const getTruncatedToolResult = (value: unknown): TruncatedToolResult | null => {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('truncated' in value) ||
    value.truncated !== true ||
    !('note' in value) ||
    typeof value.note !== 'string'
  ) {
    return null;
  }

  if ('preview' in value && typeof value.preview !== 'string') {
    return null;
  }

  if ('originalLength' in value && (typeof value.originalLength !== 'number' || !Number.isFinite(value.originalLength) || value.originalLength < 0)) {
    return null;
  }

  return value as TruncatedToolResult;
};

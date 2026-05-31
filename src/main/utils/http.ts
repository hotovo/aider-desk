const DEFAULT_FETCH_TIMEOUT_MS = 120_000;

export const fetchWithTimeout = async (url: string, timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

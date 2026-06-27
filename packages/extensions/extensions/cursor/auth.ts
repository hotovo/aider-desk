const CURSOR_API_URL = 'https://api2.cursor.sh'
const CURSOR_EXCHANGE_ENDPOINT = '/auth/exchange_user_api_key'

interface TokenCache {
  accessToken: string
  expiresAt: number
}

let cachedToken: TokenCache | null = null

function getTokenExpiry(token: string): number {
  try {
    const parts = token.split('.')
    if (parts.length !== 3 || !parts[1]) {
      return Date.now() + 3600 * 1000
    }
    const decoded: unknown = JSON.parse(
      Buffer.from(parts[1], 'base64').toString('utf-8'),
    )
    if (
      typeof decoded === 'object' &&
      decoded !== null &&
      'exp' in decoded &&
      typeof (decoded as { exp: unknown }).exp === 'number'
    ) {
      return (decoded as { exp: number }).exp * 1000 - 5 * 60 * 1000
    }
  } catch {
    // Ignore parse errors
  }
  return Date.now() + 3600 * 1000
}

export async function exchangeApiKeyForAccessToken(apiKey: string): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.accessToken
  }

  const response = await fetch(`${CURSOR_API_URL}${CURSOR_EXCHANGE_ENDPOINT}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    if (response.status === 401) {
      throw new Error(`Invalid Cursor API key. Please check your API key and try again.`)
    }
    throw new Error(
      `API key exchange failed with status ${response.status}: ${errorText || response.statusText}`,
    )
  }

  const data = (await response.json()) as { accessToken?: string }
  if (typeof data.accessToken !== 'string' || data.accessToken.length === 0) {
    throw new Error('API key exchange succeeded but returned no access token.')
  }

  cachedToken = {
    accessToken: data.accessToken,
    expiresAt: getTokenExpiry(data.accessToken),
  }

  return cachedToken.accessToken
}

export function clearCachedToken(): void {
  cachedToken = null
}

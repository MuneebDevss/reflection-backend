const MAX_METADATA_SIZE = 100_000 // 100kb safety cap
const DEFAULT_CACHE_TTL_SECONDS = 3600
const MAX_CACHE_TTL_SECONDS = 86400

export interface ResolvedClient {
  clientId: string
  redirectUris: string[]
  scopes: string[]
  clientName?: string
}

export function isClientIdUrl(clientId: string): boolean {
  try {
    const url = new URL(clientId)
    return url.protocol === 'https:' && url.pathname !== '' && url.pathname !== '/'
  } catch {
    return false
  }
}

export async function fetchClientMetadataDocument(
  clientIdUrl: string,
): Promise<{ doc: ResolvedClient; ttlSeconds: number }> {
  const res = await fetch(clientIdUrl, {
    headers: { Accept: 'application/json' },
    redirect: 'manual', // the URL itself must BE the doc — no redirect chasing
  })

  if (!res.ok) {
    throw new Error(`invalid_client_metadata: fetch failed with ${res.status}`)
  }

  const text = await res.text()
  if (text.length > MAX_METADATA_SIZE) {
    throw new Error('invalid_client_metadata: document too large')
  }

  let raw: any
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('invalid_client_metadata: not valid JSON')
  }

  if (raw.client_id !== clientIdUrl) {
    throw new Error('invalid_client_metadata: client_id field must match the fetch URL')
  }
  if (!Array.isArray(raw.redirect_uris) || raw.redirect_uris.length === 0) {
    throw new Error('invalid_client_metadata: redirect_uris required')
  }

  const ttlSeconds = parseCacheTtl(res.headers.get('cache-control'))

  return {
    doc: {
      clientId: clientIdUrl,
      redirectUris: raw.redirect_uris,
      scopes: raw.scope ? raw.scope.split(' ') : ['tasks:read', 'tasks:write'],
      clientName: raw.client_name,
    },
    ttlSeconds,
  }
}

function parseCacheTtl(cacheControl: string | null): number {
  const match = cacheControl?.match(/max-age=(\d+)/)
  if (!match) return DEFAULT_CACHE_TTL_SECONDS
  return Math.min(Number(match[1]), MAX_CACHE_TTL_SECONDS)
}
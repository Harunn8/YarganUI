export interface JwtPayload {
  sub?: string
  unique_name?: string
  name?: string
  exp?: number
  iat?: number
  iss?: string
  [claim: string]: unknown
}

const NAME_CLAIM = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'
const ROLE_CLAIMS = ['role', 'roles', 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role']

function base64UrlDecode(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function decodeJwt(token: string): JwtPayload | null {
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    return JSON.parse(base64UrlDecode(parts[1])) as JwtPayload
  } catch {
    return null
  }
}

export function getUserName(payload: JwtPayload | null): string {
  if (!payload) return 'Operatör'
  const value = payload.unique_name ?? payload.name ?? payload[NAME_CLAIM] ?? payload.sub
  return typeof value === 'string' && value ? value : 'Operatör'
}

export function getRoles(payload: JwtPayload | null): string[] {
  if (!payload) return []
  for (const key of ROLE_CLAIMS) {
    const value = payload[key]
    if (typeof value === 'string') return [value]
    if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string')
  }
  return []
}

/** exp yoksa token'ın süresiz olduğu varsayılır. */
export function isExpired(payload: JwtPayload | null, skewSeconds = 15): boolean {
  if (!payload?.exp) return false
  return payload.exp * 1000 <= Date.now() + skewSeconds * 1000
}

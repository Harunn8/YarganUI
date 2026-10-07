import axios from 'axios'
import { loginClient, services, tokenStore, type ServiceName } from './http'

/** LoginAPI token'ı düz metin ya da JSON string olarak döndürebilir. */
function normalizeToken(raw: unknown): string {
  let token = typeof raw === 'string' ? raw.trim() : ''
  if (token.startsWith('"') && token.endsWith('"')) {
    try {
      token = JSON.parse(token) as string
    } catch {
      token = token.slice(1, -1)
    }
  }
  return token
}

export async function login(username: string, password: string): Promise<string> {
  const { data } = await loginClient.post('/Login/Login', { username, password }, {
    responseType: 'text',
    transformResponse: (body: unknown) => body,
  })
  const token = normalizeToken(data)
  if (token.split('.').length !== 3) throw new Error('Login API geçerli bir token döndürmedi.')
  return token
}

export interface HealthResult {
  service: ServiceName
  ok: boolean
  status?: number
  latencyMs: number
}

export async function checkHealth(service: ServiceName): Promise<HealthResult> {
  const started = performance.now()
  const token = tokenStore.get()
  try {
    const res = await axios.get(`/svc/${service}/health`, {
      timeout: 5000,
      responseType: 'text',
      validateStatus: () => true,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
    return {
      service,
      ok: res.status >= 200 && res.status < 300,
      status: res.status,
      latencyMs: Math.round(performance.now() - started),
    }
  } catch {
    return { service, ok: false, latencyMs: Math.round(performance.now() - started) }
  }
}

export const checkAllHealth = () => Promise.all(services.map((s) => checkHealth(s.name)))

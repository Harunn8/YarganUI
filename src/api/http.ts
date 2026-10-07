import axios, { type AxiosInstance, type AxiosResponse } from 'axios'
import type { ApiEnvelope } from './types'

export type ServiceName = 'device' | 'rule' | 'satops' | 'user' | 'login'

export const services: { name: ServiceName; label: string; description: string }[] = [
  { name: 'satops', label: 'Satops API', description: 'TLE ve geçiş planlama' },
  { name: 'device', label: 'Device API', description: 'Cihaz ve PAG yönetimi' },
  { name: 'rule', label: 'Rule API', description: 'Script ve cron politikaları' },
  { name: 'user', label: 'User API', description: 'Kullanıcı yönetimi' },
  { name: 'login', label: 'Login API', description: 'Kimlik doğrulama' },
]

const TOKEN_KEY = 'yargan.token'

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set(token: string) {
    try {
      localStorage.setItem(TOKEN_KEY, token)
    } catch {
      // Gizli pencere vb. durumlarda token yalnızca bellekte kalır.
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      // yok say
    }
  },
}

let unauthorizedHandler: (() => void) | null = null

/** 401 alındığında çağrılacak işleyiciyi kaydeder (oturumu kapatıp girişe yönlendirir). */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler
}

function createClient(service: ServiceName): AxiosInstance {
  const client = axios.create({
    baseURL: `/svc/${service}/api`,
    timeout: 20_000,
    headers: { 'Content-Type': 'application/json' },
  })

  client.interceptors.request.use((config) => {
    const token = tokenStore.get()
    if (token) config.headers.set('Authorization', `Bearer ${token}`)
    return config
  })

  client.interceptors.response.use(undefined, (error) => {
    // Giriş isteğindeki 401 "yanlış şifre" demektir, oturum düşmesi değil.
    if (axios.isAxiosError(error) && error.response?.status === 401 && service !== 'login') {
      unauthorizedHandler?.()
    }
    return Promise.reject(error)
  })

  return client
}

export const deviceClient = createClient('device')
export const ruleClient = createClient('rule')
export const satopsClient = createClient('satops')
export const userClient = createClient('user')
export const loginClient = createClient('login')

export class ApiError extends Error {
  status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** DeviceAPI zarfını açar; zarftaki durum 2xx değilse hata fırlatır. */
export async function unwrapEnvelope<T>(request: Promise<AxiosResponse<ApiEnvelope<T>>>): Promise<T> {
  const { data } = await request
  if (data && typeof data === 'object' && 'status' in data) {
    if (data.status >= 200 && data.status < 300) return data.result
    throw new ApiError(data.message || 'İşlem başarısız oldu', data.status)
  }
  return data as unknown as T
}

/** DeviceAPI liste uçları boş listede 404/400 döner; bunu boş liste olarak yorumlar. */
export async function unwrapList<T>(request: Promise<AxiosResponse<ApiEnvelope<T[] | null>>>): Promise<T[]> {
  try {
    return (await unwrapEnvelope(request)) ?? []
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return []
    throw error
  }
}

/** Rule/Satops liste uçları boşken HTTP 404 döner. */
export async function listOr404<T>(request: Promise<AxiosResponse<T[] | null>>): Promise<T[]> {
  try {
    const { data } = await request
    return Array.isArray(data) ? data : []
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return []
    throw error
  }
}

export async function nullOr404<T>(request: Promise<AxiosResponse<T>>): Promise<T | null> {
  try {
    const { data } = await request
    return data ?? null
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return null
    throw error
  }
}

export const data = <T>(request: Promise<AxiosResponse<T>>): Promise<T> => request.then((r) => r.data)

/** Kullanıcıya gösterilecek hata metni. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return error.code === 'ECONNABORTED' ? 'İstek zaman aşımına uğradı.' : 'Servise ulaşılamadı. API çalışıyor mu?'
    }
    const body: unknown = error.response.data
    if (typeof body === 'string' && body.trim() && !body.trim().startsWith('<')) {
      // Geliştirme ortamında 500 yanıtı yığın izi içerir; yalnızca ilk satırı göster.
      const firstLine = body.trim().split(/\r?\n|\s+at\s+/)[0]
      return firstLine.length > 200 ? `${firstLine.slice(0, 200)}…` : firstLine
    }
    if (Array.isArray(body)) {
      const messages = body
        .map((item) => (item && typeof item === 'object' && 'errorMessage' in item ? String(item.errorMessage) : null))
        .filter(Boolean)
      if (messages.length) return messages.join(' ')
    }
    if (body && typeof body === 'object') {
      const record = body as Record<string, unknown>
      if (typeof record.message === 'string' && record.message) return record.message
      if (record.errors && typeof record.errors === 'object') {
        const flat = Object.values(record.errors as Record<string, unknown>).flat().filter((v) => typeof v === 'string')
        if (flat.length) return flat.join(' ')
      }
      if (typeof record.title === 'string') return record.title
    }
    const status = error.response.status
    if (status === 401) return 'Oturum geçersiz ya da süresi dolmuş.'
    if (status >= 500) return `Sunucu hatası (HTTP ${status}).`
    return `İstek başarısız (HTTP ${status}).`
  }
  if (error instanceof Error) return error.message
  return 'Beklenmeyen bir hata oluştu.'
}

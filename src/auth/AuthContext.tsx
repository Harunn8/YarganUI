import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { login as loginRequest } from '../api/auth'
import { setUnauthorizedHandler, tokenStore } from '../api/http'
import { decodeJwt, getRoles, getUserName, isExpired } from '../lib/jwt'

interface AuthContextValue {
  token: string | null
  userName: string
  roles: string[]
  expiresAt: Date | null
  login: (username: string, password: string) => Promise<void>
  logout: (reason?: 'expired' | 'manual') => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readStoredToken(): string | null {
  const token = tokenStore.get()
  if (!token) return null
  if (isExpired(decodeJwt(token))) {
    tokenStore.clear()
    return null
  }
  return token
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(readStoredToken)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const logout = useCallback(
    (reason: 'expired' | 'manual' = 'manual') => {
      tokenStore.clear()
      setToken(null)
      queryClient.clear()
      navigate('/login', { replace: true, state: reason === 'expired' ? { expired: true } : undefined })
    },
    [navigate, queryClient],
  )

  const login = useCallback(async (username: string, password: string) => {
    const newToken = await loginRequest(username, password)
    tokenStore.set(newToken)
    setToken(newToken)
  }, [])

  // Herhangi bir API 401 dönerse oturumu kapat.
  useEffect(() => {
    if (!token) return
    setUnauthorizedHandler(() => logout('expired'))
    return () => setUnauthorizedHandler(null)
  }, [token, logout])

  const payload = useMemo(() => (token ? decodeJwt(token) : null), [token])

  // Token süresi dolduğunda otomatik çıkış.
  useEffect(() => {
    if (!payload?.exp) return
    const remaining = payload.exp * 1000 - Date.now()
    if (remaining > 2 ** 31 - 1) return
    const timer = setTimeout(() => logout('expired'), Math.max(0, remaining))
    return () => clearTimeout(timer)
  }, [payload, logout])

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      userName: getUserName(payload),
      roles: getRoles(payload),
      expiresAt: payload?.exp ? new Date(payload.exp * 1000) : null,
      login,
      logout,
    }),
    [token, payload, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth, AuthProvider içinde kullanılmalı')
  return ctx
}

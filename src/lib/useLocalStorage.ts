import { useCallback, useState } from 'react'

/** Tarayıcıda hatırlanan küçük tercihler (harita modu, katmanlar vb.). Depolama yoksa bellekte kalır. */
export function useLocalStorageState<T>(key: string, initial: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw === null) return initial
      const parsed = JSON.parse(raw) as T
      // Nesne tercihlerinde yeni eklenen alanlar varsayılandan gelsin.
      if (initial && typeof initial === 'object' && !Array.isArray(initial)) return { ...initial, ...parsed }
      return parsed
    } catch {
      return initial
    }
  })

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
        try {
          localStorage.setItem(key, JSON.stringify(resolved))
        } catch {
          // yok say
        }
        return resolved
      })
    },
    [key],
  )

  return [value, update]
}

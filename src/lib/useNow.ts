import { useEffect, useState } from 'react'

/**
 * Belirli aralıklarla güncellenen "şimdi". Saniyelik güncellemeler saniye
 * sınırına hizalanır, böylece saatler ve geri sayımlar aynı anda değişir.
 */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      setNow(new Date())
      const drift = intervalMs >= 1000 ? Date.now() % 1000 : 0
      timer = setTimeout(tick, intervalMs - drift)
    }
    timer = setTimeout(tick, intervalMs - (intervalMs >= 1000 ? Date.now() % 1000 : 0))
    return () => clearTimeout(timer)
  }, [intervalMs])

  return now
}

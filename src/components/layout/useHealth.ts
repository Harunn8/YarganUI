import { useQuery } from '@tanstack/react-query'
import { checkAllHealth } from '../../api/auth'

/** Tüm servislerin /health durumu; kenar çubuğu ve panel aynı önbelleği paylaşır. */
export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: checkAllHealth,
    refetchInterval: 30_000,
    staleTime: 20_000,
  })
}

import { data, listOr404, nullOr404, satopsClient as c } from './http'
import type {
  ActiveTleResponse,
  AddSatellitePassModel,
  AddTleModel,
  Guid,
  SatellitePassFromTle,
  SatellitePassResponse,
  TleResponse,
} from './types'

export const passApi = {
  getAll: () => listOr404(c.get<SatellitePassResponse[]>('/SatellitePass/getallpasses')),
  getById: (id: Guid) => data(c.get<SatellitePassResponse>(`/SatellitePass/getpassbyid/${id}`)),
  add: (model: AddSatellitePassModel) => data(c.post<SatellitePassResponse>('/SatellitePass/addpass', model)),
  /** Birden çok geçişi planlamaya ekler (backend'deki adı "getpassbyrange"). */
  addMany: (models: AddSatellitePassModel[]) =>
    data(c.post<SatellitePassResponse[]>('/SatellitePass/getpassbyrange', models)),
  /** Otomatik planlayıcıyı başlatır/durdurur. Backend mevcut durumu sorgulayan bir uç sunmuyor. */
  autoSchedule: (status: boolean) =>
    data(c.put<boolean>('/SatellitePass/autostartorstop', null, { params: { status } })),
}

export const tleApi = {
  get: () => nullOr404(c.get<TleResponse>('/Tle')),
  /** Mevcut yapılandırmanın yerine geçer ve hesaplanan geçişleri döndürür. */
  save: (model: AddTleModel) => data(c.post<SatellitePassFromTle[]>('/Tle', model)),
  passes: () => listOr404(c.get<SatellitePassFromTle[]>('/Tle/gettlewithpasses')),
  /** Uydu adına göre güncel TLE arar (backend dış TLE servisine sorar). */
  search: (satelliteName: string) =>
    listOr404(c.get<ActiveTleResponse[]>('/Tle/getactivetle', { params: { satelliteName } })),
}

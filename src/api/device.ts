import { deviceClient as c, unwrapEnvelope, unwrapList } from './http'
import type {
  AddPagDeviceModel,
  AddPagModel,
  AddSnmpDeviceModel,
  AddTcpDeviceModel,
  ApiEnvelope,
  DeviceResponse,
  Guid,
  PagDeviceResponse,
  PagResponse,
  UpdateDeviceModel,
  UpdatePagDeviceModel,
  UpdatePagModel,
} from './types'

type Env<T> = ApiEnvelope<T>

export const deviceApi = {
  getAll: () => unwrapList(c.get<Env<DeviceResponse[]>>('/Device/getall')),
  getById: (id: Guid) => unwrapEnvelope(c.get<Env<DeviceResponse>>(`/Device/getbyid/${id}`)),
  getSnmp: () => unwrapList(c.get<Env<DeviceResponse[]>>('/Device/getsnmpdevices')),
  getTcp: () => unwrapList(c.get<Env<DeviceResponse[]>>('/Device/gettcpdevices')),
  addSnmp: (model: AddSnmpDeviceModel) => unwrapEnvelope(c.post<Env<DeviceResponse>>('/Device/addsnmpdevice', model)),
  addTcp: (model: AddTcpDeviceModel) => unwrapEnvelope(c.post<Env<DeviceResponse>>('/Device', model)),
  update: (model: UpdateDeviceModel) => unwrapEnvelope(c.put<Env<DeviceResponse>>('/Device/update', model)),
  remove: (id: Guid) => unwrapEnvelope(c.delete<Env<boolean>>('/Device', { params: { id } })),
}

export const pagApi = {
  getAll: () => unwrapList(c.get<Env<PagResponse[]>>('/Pag/getall')),
  getByDeviceId: (deviceId: Guid) => unwrapEnvelope(c.get<Env<PagResponse>>(`/Pag/getbydeviceid/${deviceId}`)),
  add: (model: AddPagModel) => unwrapEnvelope(c.post<Env<PagResponse>>('/Pag', model)),
  update: (model: UpdatePagModel) => unwrapEnvelope(c.put<Env<PagResponse>>('/Pag', model)),
  remove: (id: Guid) => unwrapEnvelope(c.delete<Env<boolean>>('/Pag', { params: { id } })),
}

export const pagDeviceApi = {
  getAll: () => unwrapList(c.get<Env<PagDeviceResponse[]>>('/PagDevice/getall')),
  /** Bakımda olmayan (DCM'nin haberleştiği) cihazlar. */
  getActive: () => unwrapList(c.get<Env<PagDeviceResponse[]>>('/PagDevice/getactive')),
  getById: (id: Guid) => unwrapEnvelope(c.get<Env<PagDeviceResponse>>(`/PagDevice/getbyid/${id}`)),
  getByPagId: (pagId: Guid) => unwrapList(c.get<Env<PagDeviceResponse[]>>(`/PagDevice/getbypagid/${pagId}`)),
  getByDeviceId: (deviceId: Guid) =>
    unwrapList(c.get<Env<PagDeviceResponse[]>>(`/PagDevice/getbydeviceid/${deviceId}`)),
  add: (model: AddPagDeviceModel) => unwrapEnvelope(c.post<Env<PagDeviceResponse>>('/PagDevice', model)),
  update: (model: UpdatePagDeviceModel) => unwrapEnvelope(c.put<Env<PagDeviceResponse>>('/PagDevice/update', model)),
  startOrStop: (id: Guid, isStart: boolean) =>
    unwrapEnvelope(c.put<Env<boolean>>('/PagDevice/startorstop', null, { params: { id, isStart } })),
  startOrStopMany: (ids: Guid[], isStart: boolean) =>
    unwrapEnvelope(c.put<Env<boolean>>('/PagDevice/startorstopmulti', ids, { params: { isStart } })),
  remove: (id: Guid) => unwrapEnvelope(c.delete<Env<boolean>>('/PagDevice', { params: { id } })),
}

// Backend modellerinin JSON karşılıkları (ASP.NET Core camelCase serileştirir,
// enum'lar sayı olarak gelir). Alan adlarındaki yazım hataları backend'den geliyor.

export type Guid = string

/** DeviceAPI tüm yanıtları bu zarfla döner; HTTP kodu hep 200'dür, asıl durum `status` alanındadır. */
export interface ApiEnvelope<T> {
  status: number
  message: string | null
  result: T
}

// ---------------------------------------------------------------- Device API

export const CommunicationType = { SNMP: 0, TCP: 1, UDP: 2, Ping: 3 } as const
export type CommunicationType = (typeof CommunicationType)[keyof typeof CommunicationType]

export const communicationTypeLabel: Record<number, string> = {
  0: 'SNMP',
  1: 'TCP',
  2: 'UDP',
  3: 'Ping',
}

export const SnmpVersion = { V1: 1, V2: 2, V3: 3 } as const
export type SnmpVersion = (typeof SnmpVersion)[keyof typeof SnmpVersion]

export interface PagEntity {
  id: Guid
  name: string
  deviceId?: Guid[] | null
  device?: DeviceEntity[] | null
  updateDate?: string
}

export interface DeviceEntity {
  id: Guid
  name: string
  communicationData: string | null
  communicationType: CommunicationType
  version?: string | null
  versionNote?: string | null
  pagId: Guid
  pag?: PagEntity | null
}

export interface DeviceResponse {
  id: Guid
  name: string
  pagId: Guid
  pag: PagEntity | null
  communicationType: CommunicationType
  communicationData: string | null
}

export interface PagResponse {
  id: Guid
  name: string
  deviceId: Guid[] | null
  device: DeviceEntity[] | null
}

export interface PagDeviceResponse {
  id: Guid
  name: string
  deviceId: Guid
  device: DeviceEntity | null
  pagId: Guid
  pag: PagEntity | null
  /** Backend'deki yazımıyla (InMaitenance). */
  inMaitenance?: boolean
  inMaintenance?: boolean
  ipAddress: string
  port: number
  timeout: number
}

export interface QueryModel {
  query: string
  parameterId: Guid
  parameterName: string
}

export interface AddSnmpDeviceModel {
  name: string
  pagId: Guid
  snmpVersion: SnmpVersion
  readCommunity: string
  writeCommunity?: string | null
  version?: string | null
  versionNote?: string | null
  queries: QueryModel[]
}

export interface AddTcpDeviceModel {
  name: string
  pagId: Guid
  queries: QueryModel[]
  version?: string | null
  versionNote?: string | null
}

export interface UpdateDeviceModel {
  id: Guid
  name: string
  pagId: Guid
  communicationType: CommunicationType
  version?: string | null
  versionNote?: string | null
  communicationData: string
}

export interface AddPagModel {
  name: string
}

export interface UpdatePagModel extends AddPagModel {
  id: Guid
}

export interface AddPagDeviceModel {
  name: string
  ipAddress: string
  port: number
  deviceId: Guid
  pagId: Guid
  inMaintenance: boolean
  timeOut: number
}

export interface UpdatePagDeviceModel extends AddPagDeviceModel {
  id: Guid
}

/** Device.CommunicationData: backend, ekleme modelini Newtonsoft ile (PascalCase) serileştirip saklıyor. */
export interface CommunicationData {
  Name?: string
  PagId?: Guid
  SNMPVersion?: number
  ReadCommunity?: string
  WriteCommunity?: string | null
  Version?: string | null
  VersionNote?: string | null
  Queries?: { Query: string; ParameterId: Guid; ParameterName: string }[]
}

// ---------------------------------------------------------------- Rule API

export interface ScriptEntity {
  id: Guid
  name: string
  script: string
  createdDate?: string
  isRunning?: boolean
  updateDate?: string
}

export interface PolicyScriptResponse {
  id: Guid
  name: string
  script: string
  updateDate: string
}

export interface AddScriptModel {
  name: string
  script: string
}

export interface UpdateScriptModel extends AddScriptModel {
  id: Guid
}

export interface CronPolicyResponse {
  id: Guid
  name: string
  cronFormat: string | null
  forOnce: boolean
  policyScriptId: Guid
  updateDate: string
  startAt: string
  endAt: string | null
  isRunning: boolean
  policyScript: ScriptEntity | null
}

export interface AddCronPolicyModel {
  name: string
  cronFormat: string | null
  forOnce: boolean
  startAt: string
  endAt: string | null
  policyScriptId: Guid
}

export interface UpdateCronPolicyModel extends AddCronPolicyModel {
  id: Guid
}

// ---------------------------------------------------------------- Satops API

export const PassStatus = {
  SelectTracking: 0,
  Queued: 1,
  Tracking: 2,
  Completed: 3,
  Failed: 4,
  Canceled: 5,
  Skipped: 6,
} as const
export type PassStatus = (typeof PassStatus)[keyof typeof PassStatus]

export interface TleData {
  satelliteName: string
  line1: string
  line2: string
}

export interface TleResponse {
  id: Guid
  name: string
  latitude: number
  longitude: number
  /** metre */
  altitude: number
  minElevation: number
  tleData: TleData[]
  setupInterval: number
}

export interface AddTleModel {
  name: string
  latitude: number
  longitude: number
  altitude: number
  minElevation: number
  tleData: TleData[]
  startAt: string
  endAt: string
  setupInterval: number
}

export interface SatellitePassResponse {
  id: Guid
  name: string
  /** dakika */
  duration: number
  aos: string
  los: string
  isTracked: boolean
  status: PassStatus
  updateDate: string
  isImportant: boolean
}

export interface SatellitePassFromTle {
  name: string
  duration: number
  aos: string
  los: string
}

export interface AddSatellitePassModel {
  name: string
  duration: number
  aos: string
  los: string
  maxElevation: number
  isImportant: boolean
}

export interface ActiveTleResponse {
  satelliteName: string
  line1: string
  line2: string
}

// ---------------------------------------------------------------- User API

export interface UserResponse {
  id: Guid
  userName: string
  /** Backend hash'i de döndürüyor; arayüzde gösterilmez. */
  password?: string
  name: string
  email: string
  surname: string
  roleId: Guid
}

export interface AddUserModel {
  userName: string
  password: string
  name: string
  email: string
  surname: string
  roleId: Guid
}

export interface UpdateUserModel extends AddUserModel {
  id: Guid
}

export const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'

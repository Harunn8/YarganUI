import type { CommunicationData, DeviceResponse, QueryModel } from '../../api/types'

/** Device.CommunicationData alanını (Newtonsoft/PascalCase JSON) güvenli biçimde okur. */
export function parseCommunication(device: Pick<DeviceResponse, 'communicationData'>): CommunicationData {
  if (!device.communicationData) return {}
  try {
    const parsed = JSON.parse(device.communicationData) as CommunicationData
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function queriesOf(device: Pick<DeviceResponse, 'communicationData'>): QueryModel[] {
  return (parseCommunication(device).Queries ?? []).map((q) => ({
    query: q.Query,
    parameterId: q.ParameterId,
    parameterName: q.ParameterName,
  }))
}

/** Güncelleme için CommunicationData'yı backend'in eklemede kullandığı biçimde üretir. */
export function buildCommunicationData(input: {
  name: string
  pagId: string
  protocol: 'snmp' | 'tcp'
  snmpVersion: number
  readCommunity: string
  writeCommunity: string | null
  version: string | null
  versionNote: string | null
  queries: QueryModel[]
}): string {
  const Queries = input.queries.map((q) => ({ Query: q.query, ParameterId: q.parameterId, ParameterName: q.parameterName }))
  if (input.protocol === 'snmp') {
    return JSON.stringify({
      Name: input.name,
      PagId: input.pagId,
      SNMPVersion: input.snmpVersion,
      ReadCommunity: input.readCommunity,
      WriteCommunity: input.writeCommunity,
      VersionNote: input.versionNote,
      Version: input.version,
      Queries,
    })
  }
  return JSON.stringify({
    Name: input.name,
    PagId: input.pagId,
    Queries,
    Version: input.version,
    VersionNote: input.versionNote,
  })
}

export const snmpVersionLabel: Record<number, string> = { 1: 'v1', 2: 'v2c', 3: 'v3' }

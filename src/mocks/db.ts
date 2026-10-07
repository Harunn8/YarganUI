import type {
  CronPolicyResponse,
  DeviceEntity,
  PagEntity,
  PolicyScriptResponse,
  SatellitePassResponse,
  TleResponse,
  UserResponse,
} from '../api/types'
import { PassStatus } from '../api/types'
import { buildSatellites, predictPasses, stationFromTle } from '../features/satops/orbit'
import { toApiDate } from '../lib/format'
import { makeTle, trackedSpecs } from './tleGen'

const uuid = () => crypto.randomUUID()
const minutes = (n: number) => n * 60_000

export interface PagDeviceRecord {
  id: string
  name: string
  deviceId: string
  pagId: string
  ipAddress: string
  port: number
  timeout: number
  inMaintenance: boolean
}

export interface ScriptRecord extends PolicyScriptResponse {
  createdDate: string
  isRunning: boolean
}

export type CronRecord = Omit<CronPolicyResponse, 'policyScript'>

const now = new Date()

// ------------------------------------------------------------------ Satops
const tle: TleResponse = {
  id: uuid(),
  name: 'Ankara Yer İstasyonu',
  latitude: 39.925,
  longitude: 32.837,
  altitude: 938,
  minElevation: 5,
  setupInterval: 120,
  tleData: trackedSpecs.map((spec) => makeTle(spec, now)),
}

export function computePasses(config: TleResponse, from: Date, hours: number) {
  const station = stationFromTle(config)!
  return buildSatellites(config.tleData)
    .flatMap((s) => predictPasses(s, station, from, hours))
    .filter((p) => !p.continuous)
    .sort((a, b) => a.aos.getTime() - b.aos.getTime())
}

function seedPasses(): SatellitePassResponse[] {
  const predicted = computePasses(tle, new Date(now.getTime() - minutes(10 * 60)), 40)
  let lastEnd = 0
  return predicted.map((p, index) => {
    const aos = p.aos.getTime()
    const los = p.los.getTime()
    const important = /İMECE|ISS/.test(p.name) && p.maxElevation > 35
    let status: PassStatus
    if (los < now.getTime()) status = index % 6 === 4 ? PassStatus.Failed : PassStatus.Completed
    else if (aos <= now.getTime()) status = PassStatus.Tracking
    else if (aos - now.getTime() < minutes(180)) status = PassStatus.Queued
    else status = PassStatus.SelectTracking
    if (aos > now.getTime() && aos < lastEnd + tle.setupInterval * 1000 && !important) status = PassStatus.Skipped
    if (status !== PassStatus.Skipped) lastEnd = Math.max(lastEnd, los)
    return {
      id: uuid(),
      name: p.name,
      duration: Math.round(((los - aos) / 60_000) * 100) / 100,
      aos: toApiDate(p.aos),
      los: toApiDate(p.los),
      isTracked: status !== PassStatus.SelectTracking,
      status,
      updateDate: toApiDate(now),
      isImportant: important,
    }
  })
}

// ------------------------------------------------------------------ Device
const pagAnten = uuid()
const pagRf = uuid()
const pagNet = uuid()

const pags: PagEntity[] = [
  { id: pagAnten, name: 'Anten Sistemi' },
  { id: pagRf, name: 'RF Zinciri' },
  { id: pagNet, name: 'Zamanlama ve Ağ' },
]

function snmpData(name: string, pagId: string, version: number, community: string, queries: [string, string][]) {
  return JSON.stringify({
    Name: name,
    PagId: pagId,
    SNMPVersion: version,
    ReadCommunity: community,
    WriteCommunity: null,
    VersionNote: null,
    Version: '1.0',
    Queries: queries.map(([ParameterName, Query]) => ({ Query, ParameterId: uuid(), ParameterName })),
  })
}

function tcpData(name: string, pagId: string, queries: [string, string][]) {
  return JSON.stringify({
    Name: name,
    PagId: pagId,
    Queries: queries.map(([ParameterName, Query]) => ({ Query, ParameterId: uuid(), ParameterName })),
    Version: '2.3',
    VersionNote: null,
  })
}

const devAcu = uuid()
const devLna = uuid()
const devHpa = uuid()
const devSa = uuid()
const devGps = uuid()
const devModem = uuid()

const devices: DeviceEntity[] = [
  {
    id: devAcu,
    name: 'ACU-7 Anten Kontrol Ünitesi',
    pagId: pagAnten,
    communicationType: 0,
    version: '4.2.1',
    versionNote: 'X/S bant, program track',
    communicationData: snmpData('ACU-7 Anten Kontrol Ünitesi', pagAnten, 2, 'public', [
      ['Azimut', '1.3.6.1.4.1.5000.1.1.0'],
      ['Elevasyon', '1.3.6.1.4.1.5000.1.2.0'],
      ['Sürücü durumu', '1.3.6.1.4.1.5000.1.9.0'],
    ]),
  },
  {
    id: devLna,
    name: 'LNA-X Düşük Gürültülü Yükselteç',
    pagId: pagRf,
    communicationType: 0,
    version: '2.0',
    communicationData: snmpData('LNA-X Düşük Gürültülü Yükselteç', pagRf, 2, 'rfmon', [
      ['Kazanç', '1.3.6.1.4.1.6100.2.1.0'],
      ['Sıcaklık', '1.3.6.1.4.1.6100.2.4.0'],
    ]),
  },
  {
    id: devHpa,
    name: 'HPA-200 Yüksek Güçlü Yükselteç',
    pagId: pagRf,
    communicationType: 0,
    version: '1.8',
    communicationData: snmpData('HPA-200 Yüksek Güçlü Yükselteç', pagRf, 3, 'hpa-ro', [
      ['Çıkış gücü', '1.3.6.1.4.1.6200.1.1.0'],
      ['Yansıyan güç', '1.3.6.1.4.1.6200.1.2.0'],
      ['Alarm', '1.3.6.1.4.1.6200.1.8.0'],
    ]),
  },
  {
    id: devSa,
    name: 'SA-9 Spektrum Analizörü',
    pagId: pagRf,
    communicationType: 1,
    version: '3.1',
    communicationData: tcpData('SA-9 Spektrum Analizörü', pagRf, [
      ['Merkez frekans', ':FREQ:CENT?'],
      ['Tepe seviye', ':CALC:MARK:Y?'],
    ]),
  },
  {
    id: devGps,
    name: 'GNSS Zaman Sunucusu',
    pagId: pagNet,
    communicationType: 0,
    version: '5.0',
    communicationData: snmpData('GNSS Zaman Sunucusu', pagNet, 2, 'public', [
      ['Senkron durumu', '1.3.6.1.4.1.7000.1.1.0'],
      ['Uydu sayısı', '1.3.6.1.4.1.7000.1.3.0'],
    ]),
  },
  {
    id: devModem,
    name: 'CDM-625 Uydu Modemi',
    pagId: pagRf,
    communicationType: 1,
    version: '1.6',
    communicationData: tcpData('CDM-625 Uydu Modemi', pagRf, [
      ['Eb/No', '<0/EBN?'],
      ['Kilit durumu', '<0/RSL?'],
    ]),
  },
]

const pagDevices: PagDeviceRecord[] = [
  { id: uuid(), name: 'ACU-01', deviceId: devAcu, pagId: pagAnten, ipAddress: '10.20.1.11', port: 161, timeout: 2000, inMaintenance: false },
  { id: uuid(), name: 'ACU-02', deviceId: devAcu, pagId: pagAnten, ipAddress: '10.20.1.12', port: 161, timeout: 2000, inMaintenance: true },
  { id: uuid(), name: 'LNA-S', deviceId: devLna, pagId: pagRf, ipAddress: '10.20.2.21', port: 161, timeout: 1500, inMaintenance: false },
  { id: uuid(), name: 'LNA-X', deviceId: devLna, pagId: pagRf, ipAddress: '10.20.2.22', port: 161, timeout: 1500, inMaintenance: false },
  { id: uuid(), name: 'HPA-01', deviceId: devHpa, pagId: pagRf, ipAddress: '10.20.2.31', port: 161, timeout: 3000, inMaintenance: false },
  { id: uuid(), name: 'SA-01', deviceId: devSa, pagId: pagRf, ipAddress: '10.20.2.40', port: 5025, timeout: 5000, inMaintenance: false },
  { id: uuid(), name: 'MODEM-01', deviceId: devModem, pagId: pagRf, ipAddress: '10.20.2.15', port: 2000, timeout: 2500, inMaintenance: true },
  { id: uuid(), name: 'NTP-01', deviceId: devGps, pagId: pagNet, ipAddress: '10.20.3.5', port: 161, timeout: 1000, inMaintenance: false },
]

// ------------------------------------------------------------------ Rule
const scriptPark = uuid()
const scriptPrep = uuid()
const scriptSnr = uuid()
const scriptHealth = uuid()

const scripts: ScriptRecord[] = [
  {
    id: scriptPrep,
    name: 'Geçiş öncesi hazırlık',
    updateDate: toApiDate(new Date(now.getTime() - minutes(60 * 26))),
    createdDate: toApiDate(new Date(now.getTime() - minutes(60 * 24 * 9))),
    isRunning: false,
    script: `// AOS'tan önce anteni başlangıç konumuna alır ve RF zincirini hazırlar.
SendMqttMessage("Satops/Jobs", "Pass preparation started");
var acu = GetData("ACU-01");
if (acu == null)
{
    WriteLogToConsole("ACU-01 yanıt vermiyor, hazırlık durduruldu.");
    return;
}
SendMqttMessage("DCM/Command", "ACU-01:STOW_RELEASE");
SendMqttMessage("DCM/Command", "LNA-X:ENABLE");
WriteLogToConsole($"Hazırlık tamamlandı: {DateTime.UtcNow:HH:mm:ss}");`,
  },
  {
    id: scriptSnr,
    name: 'SNR izleme',
    updateDate: toApiDate(new Date(now.getTime() - minutes(60 * 5))),
    createdDate: toApiDate(new Date(now.getTime() - minutes(60 * 24 * 20))),
    isRunning: false,
    script: `// Geçiş boyunca SNR değerini izler, eşik altına düşerse alarm üretir.
var snr = GetData("MODEM-01/EbNo");
if (snr == null)
{
    WriteLogToConsole("SNR okunamadı.");
}
else if (snr < 4.5)
{
    SendMqttMessage("RuleEngine/SetAlarm", "SNR_LOW");
    WriteLogToConsole($"SNR düşük: {snr} dB");
}`,
  },
  {
    id: scriptPark,
    name: 'Anten park pozisyonu',
    updateDate: toApiDate(new Date(now.getTime() - minutes(60 * 24 * 3))),
    createdDate: toApiDate(new Date(now.getTime() - minutes(60 * 24 * 30))),
    isRunning: false,
    script: `// Rüzgâr ve bakım durumlarında anteni zenit park konumuna alır.
SendMqttMessage("DCM/Command", "ACU-01:GOTO AZ=0 EL=90");
WriteLogToConsole("Anten park konumuna gönderildi.");`,
  },
  {
    id: scriptHealth,
    name: 'Günlük sağlık kontrolü',
    updateDate: toApiDate(new Date(now.getTime() - minutes(60 * 24))),
    createdDate: toApiDate(new Date(now.getTime() - minutes(60 * 24 * 45))),
    isRunning: true,
    script: `// Tüm PAG cihazlarının erişilebilirliğini kontrol eder ve özet yayınlar.
var devices = new[] { "ACU-01", "LNA-X", "HPA-01", "SA-01", "NTP-01" };
var down = 0;
foreach (var d in devices)
{
    if (GetData(d) == null) down++;
}
SendMqttMessage("Health/Daily", $"{devices.Length - down}/{devices.Length} cihaz erişilebilir");`,
  },
]

const tomorrow3 = new Date(now)
tomorrow3.setDate(tomorrow3.getDate() + 1)
tomorrow3.setHours(3, 0, 0, 0)

const cronPolicies: CronRecord[] = [
  {
    id: uuid(),
    name: 'Günlük sağlık kontrolü',
    cronFormat: '0 6 * * *',
    forOnce: false,
    policyScriptId: scriptHealth,
    updateDate: toApiDate(new Date(now.getTime() - minutes(60 * 24))),
    startAt: toApiDate(new Date(now.getTime() - minutes(60 * 24 * 40))),
    endAt: null,
    isRunning: true,
  },
  {
    id: uuid(),
    name: 'SNR izleme (15 dk)',
    cronFormat: '*/15 * * * *',
    forOnce: false,
    policyScriptId: scriptSnr,
    updateDate: toApiDate(new Date(now.getTime() - minutes(60 * 5))),
    startAt: toApiDate(new Date(now.getTime() - minutes(60 * 24 * 10))),
    endAt: toApiDate(new Date(now.getTime() + minutes(60 * 24 * 30))),
    isRunning: true,
  },
  {
    id: uuid(),
    name: 'Bakım için anten parkı',
    cronFormat: null,
    forOnce: true,
    policyScriptId: scriptPark,
    updateDate: toApiDate(new Date(now.getTime() - minutes(60 * 3))),
    startAt: toApiDate(tomorrow3),
    endAt: toApiDate(new Date(tomorrow3.getTime() + minutes(30))),
    isRunning: false,
  },
]

// ------------------------------------------------------------------ User
const roleAdmin = '5b1c4f0e-1a2b-4c3d-9e8f-000000000001'
const roleOperator = '5b1c4f0e-1a2b-4c3d-9e8f-000000000002'

const users: UserResponse[] = [
  { id: uuid(), userName: 'ayse.yilmaz', name: 'Ayşe', surname: 'Yılmaz', email: 'ayse.yilmaz@yargan.local', roleId: roleAdmin, password: 'hash' },
  { id: uuid(), userName: 'mehmet.demir', name: 'Mehmet', surname: 'Demir', email: 'mehmet.demir@yargan.local', roleId: roleOperator, password: 'hash' },
  { id: uuid(), userName: 'elif.kaya', name: 'Elif', surname: 'Kaya', email: 'elif.kaya@yargan.local', roleId: roleOperator, password: 'hash' },
  { id: uuid(), userName: 'nobet', name: 'Nöbetçi', surname: 'Operatör', email: 'nobet@yargan.local', roleId: roleOperator, password: 'hash' },
]

export const db = {
  tle: tle as TleResponse | null,
  passes: seedPasses(),
  pags,
  devices,
  pagDevices,
  scripts,
  cronPolicies,
  users,
}

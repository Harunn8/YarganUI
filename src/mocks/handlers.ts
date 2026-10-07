import { delay, http, HttpResponse } from 'msw'
import type {
  AddCronPolicyModel,
  AddPagDeviceModel,
  AddSatellitePassModel,
  AddScriptModel,
  AddSnmpDeviceModel,
  AddTcpDeviceModel,
  AddTleModel,
  AddUserModel,
  DeviceEntity,
  PagDeviceResponse,
  UpdateCronPolicyModel,
  UpdateDeviceModel,
  UpdatePagDeviceModel,
  UpdatePagModel,
  UpdateScriptModel,
  UpdateUserModel,
} from '../api/types'
import { PassStatus } from '../api/types'
import { toApiDate } from '../lib/format'
import { computePasses, db, type PagDeviceRecord } from './db'
import { catalogSpecs, makeTle } from './tleGen'

const uuid = () => crypto.randomUUID()
const latency = () => delay(90 + Math.random() * 220)
const text = (body: string, status: number) =>
  new HttpResponse(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })

// DeviceAPI zarfı
const ok = <T,>(result: T) => HttpResponse.json({ status: 200, message: null, result })
const fail = (status: number, message: string) => HttpResponse.json({ status, message, result: null })

const D = '/svc/device/api'
const R = '/svc/rule/api'
const S = '/svc/satops/api'
const U = '/svc/user/api'

// ------------------------------------------------------------------ yardımcılar
function base64Url(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach((b) => (binary += String.fromCharCode(b)))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fakeJwt(username: string) {
  const iat = Math.floor(Date.now() / 1000)
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = base64Url(
    JSON.stringify({ sub: username, unique_name: username, jti: uuid(), nbf: iat, exp: iat + 2 * 3600, iat, iss: 'https://yargan.com', aud: 'https://yargan.com' }),
  )
  return `${header}.${payload}.bW9jay1zaWduYXR1cmU`
}

const ascii = (s: string) =>
  s
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

const pagOf = (id: string) => db.pags.find((p) => p.id === id) ?? null
const deviceOf = (id: string) => db.devices.find((d) => d.id === id) ?? null

function pagView(id: string) {
  const pag = pagOf(id)
  if (!pag) return null
  const list = db.devices.filter((d) => d.pagId === id)
  return { id: pag.id, name: pag.name, deviceId: list.map((d) => d.id), device: list.map((d) => ({ ...d, pag: null })) }
}

function deviceView(d: DeviceEntity) {
  return { id: d.id, name: d.name, pagId: d.pagId, pag: pagOf(d.pagId), communicationType: d.communicationType, communicationData: d.communicationData }
}

// Backend'deki gibi: yanıttaki "InMaitenance" alanı eşlenmediği için hep false döner.
function pagDeviceView(p: PagDeviceRecord): PagDeviceResponse {
  return {
    id: p.id,
    name: p.name,
    deviceId: p.deviceId,
    device: deviceOf(p.deviceId),
    pagId: p.pagId,
    pag: pagOf(p.pagId),
    inMaitenance: false,
    ipAddress: p.ipAddress,
    port: p.port,
    timeout: p.timeout,
  }
}

function scriptsWithRelations() {
  return db.cronPolicies.map((c) => {
    const script = db.scripts.find((s) => s.id === c.policyScriptId) ?? null
    return { ...c, policyScript: script ? { id: script.id, name: script.name, script: script.script, createdDate: script.createdDate, isRunning: script.isRunning } : null }
  })
}

export const handlers = [
  // ---------------------------------------------------------------- Health & Login
  http.get('/svc/:service/health', async () => {
    await delay(15 + Math.random() * 60)
    return text('Healthy', 200)
  }),

  http.post('/svc/login/api/Login/Login', async ({ request }) => {
    await delay(450)
    const body = (await request.json()) as { username?: string; password?: string }
    if (!body.username?.trim() || !body.password) return new HttpResponse(null, { status: 401 })
    return HttpResponse.json(fakeJwt(body.username.trim()))
  }),

  // ---------------------------------------------------------------- Satops: TLE
  http.get(`${S}/Tle`, async () => {
    await latency()
    return db.tle ? HttpResponse.json(db.tle) : text('Tle data not found', 404)
  }),

  http.post(`${S}/Tle`, async ({ request }) => {
    await delay(700)
    const model = (await request.json()) as AddTleModel
    db.tle = {
      id: uuid(),
      name: model.name,
      latitude: model.latitude,
      longitude: model.longitude,
      altitude: model.altitude,
      minElevation: model.minElevation,
      setupInterval: model.setupInterval,
      tleData: model.tleData,
    }
    const start = new Date(model.startAt)
    const hours = (new Date(model.endAt).getTime() - start.getTime()) / 3_600_000
    const passes = computePasses(db.tle, start, Math.max(1, hours)).map((p) => ({
      name: p.name,
      duration: Math.round(((p.los.getTime() - p.aos.getTime()) / 60_000) * 100) / 100,
      aos: toApiDate(p.aos),
      los: toApiDate(p.los),
    }))
    return HttpResponse.json(passes)
  }),

  http.get(`${S}/Tle/gettlewithpasses`, async () => {
    await delay(500)
    if (!db.tle) return text('Passes or tle data not found', 404)
    const passes = computePasses(db.tle, new Date(), 24).map((p) => ({
      name: p.name,
      duration: Math.round(((p.los.getTime() - p.aos.getTime()) / 60_000) * 100) / 100,
      aos: toApiDate(p.aos),
      los: toApiDate(p.los),
    }))
    return passes.length ? HttpResponse.json(passes) : text('Passes or tle data not found', 404)
  }),

  http.get(`${S}/Tle/getactivetle`, async ({ request }) => {
    await delay(400)
    const q = ascii(new URL(request.url).searchParams.get('satelliteName') ?? '')
    const now = new Date()
    const results = catalogSpecs
      .filter((s) => q && ascii(s.name).includes(q))
      .map((s) => {
        const t = makeTle(s, now)
        return { satelliteName: t.satelliteName, line1: t.line1, line2: t.line2 }
      })
    return results.length ? HttpResponse.json(results) : text('Tle not found', 404)
  }),

  // ---------------------------------------------------------------- Satops: geçişler
  http.get(`${S}/SatellitePass/getallpasses`, async () => {
    await latency()
    return db.passes.length ? HttpResponse.json(db.passes) : text('Could not pass find', 404)
  }),

  http.get(`${S}/SatellitePass/getpassbyid/:id`, async ({ params }) => {
    await latency()
    const pass = db.passes.find((p) => p.id === params.id)
    return pass ? HttpResponse.json(pass) : text('Pass could not find', 404)
  }),

  http.post(`${S}/SatellitePass/addpass`, async ({ request }) => {
    await latency()
    const m = (await request.json()) as AddSatellitePassModel
    const pass = { id: uuid(), name: m.name, duration: m.duration, aos: m.aos, los: m.los, isTracked: false, status: PassStatus.SelectTracking, updateDate: toApiDate(new Date()), isImportant: m.isImportant }
    db.passes.push(pass)
    return HttpResponse.json(pass)
  }),

  http.post(`${S}/SatellitePass/getpassbyrange`, async ({ request }) => {
    await delay(500)
    const models = (await request.json()) as AddSatellitePassModel[]
    const added = models.map((m) => ({ id: uuid(), name: m.name, duration: m.duration, aos: m.aos, los: m.los, isTracked: false, status: PassStatus.SelectTracking, updateDate: toApiDate(new Date()), isImportant: m.isImportant }))
    db.passes.push(...added)
    return added.length ? HttpResponse.json(added) : text('Passes could not add', 400)
  }),

  http.put(`${S}/SatellitePass/autostartorstop`, async ({ request }) => {
    await delay(600)
    const start = new URL(request.url).searchParams.get('status') === 'true'
    const now = Date.now()
    if (start) {
      const eligible = db.passes.filter((p) => p.status === PassStatus.SelectTracking && new Date(p.aos).getTime() > now)
      if (!eligible.length) return HttpResponse.json(false, { status: 400 })
      eligible.forEach((p) => {
        p.status = PassStatus.Queued
        p.isTracked = true
      })
      return HttpResponse.json(true)
    }
    const active = db.passes.filter((p) => p.status === PassStatus.Queued || p.status === PassStatus.Tracking || p.status === PassStatus.SelectTracking)
    if (!active.length) return HttpResponse.json(false, { status: 400 })
    active.forEach((p) => (p.status = PassStatus.Canceled))
    return HttpResponse.json(true)
  }),

  // ---------------------------------------------------------------- Device
  http.get(`${D}/Device/getall`, async () => {
    await latency()
    return db.devices.length ? ok(db.devices.map(deviceView)) : fail(404, 'Devices not found')
  }),
  http.get(`${D}/Device/getbyid/:id`, async ({ params }) => {
    await latency()
    const d = deviceOf(String(params.id))
    return d ? ok(deviceView(d)) : fail(404, 'Device not found')
  }),
  http.get(`${D}/Device/getsnmpdevices`, async () => {
    await latency()
    const list = db.devices.filter((d) => d.communicationType === 0)
    return list.length ? ok(list.map(deviceView)) : fail(404, 'Devices not found')
  }),
  http.get(`${D}/Device/gettcpdevices`, async () => {
    await latency()
    const list = db.devices.filter((d) => d.communicationType === 1)
    return list.length ? ok(list.map(deviceView)) : fail(404, 'Devices not found')
  }),
  http.post(`${D}/Device/addsnmpdevice`, async ({ request }) => {
    await latency()
    const m = (await request.json()) as AddSnmpDeviceModel
    const device: DeviceEntity = {
      id: uuid(),
      name: m.name,
      pagId: m.pagId,
      communicationType: 0,
      version: m.version,
      versionNote: m.versionNote,
      communicationData: JSON.stringify({
        Name: m.name,
        PagId: m.pagId,
        SNMPVersion: m.snmpVersion,
        ReadCommunity: m.readCommunity,
        WriteCommunity: m.writeCommunity ?? null,
        VersionNote: m.versionNote ?? null,
        Version: m.version ?? null,
        Queries: m.queries.map((q) => ({ Query: q.query, ParameterId: q.parameterId, ParameterName: q.parameterName })),
      }),
    }
    db.devices.push(device)
    return ok(deviceView(device))
  }),
  http.post(`${D}/Device`, async ({ request }) => {
    await latency()
    const m = (await request.json()) as AddTcpDeviceModel
    const device: DeviceEntity = {
      id: uuid(),
      name: m.name,
      pagId: m.pagId,
      communicationType: 1,
      version: m.version,
      versionNote: m.versionNote,
      communicationData: JSON.stringify({
        Name: m.name,
        PagId: m.pagId,
        Queries: m.queries.map((q) => ({ Query: q.query, ParameterId: q.parameterId, ParameterName: q.parameterName })),
        Version: m.version ?? null,
        VersionNote: m.versionNote ?? null,
      }),
    }
    db.devices.push(device)
    return ok(deviceView(device))
  }),
  http.put(`${D}/Device/update`, async ({ request }) => {
    await latency()
    const m = (await request.json()) as UpdateDeviceModel
    const d = deviceOf(m.id)
    if (!d) return fail(400, 'Device could not update')
    Object.assign(d, { name: m.name, pagId: m.pagId, communicationType: m.communicationType, version: m.version, versionNote: m.versionNote, communicationData: m.communicationData })
    return ok(deviceView(d))
  }),
  http.delete(`${D}/Device`, async ({ request }) => {
    await latency()
    const id = new URL(request.url).searchParams.get('id')
    const before = db.devices.length
    db.devices = db.devices.filter((d) => d.id !== id)
    return db.devices.length < before ? ok(true) : fail(400, 'Device could not delete')
  }),

  http.get(`${D}/Pag/getall`, async () => {
    await latency()
    return db.pags.length ? ok(db.pags.map((p) => pagView(p.id))) : fail(400, 'Pags not found')
  }),
  http.get(`${D}/Pag/getbydeviceid/:deviceId`, async ({ params }) => {
    await latency()
    const d = deviceOf(String(params.deviceId))
    return d ? ok(pagView(d.pagId)) : fail(400, 'Pag not found')
  }),
  http.post(`${D}/Pag`, async ({ request }) => {
    await latency()
    const m = (await request.json()) as { name: string }
    const pag = { id: uuid(), name: m.name }
    db.pags.push(pag)
    return ok(pagView(pag.id))
  }),
  http.put(`${D}/Pag`, async ({ request }) => {
    await latency()
    const m = (await request.json()) as UpdatePagModel
    const pag = pagOf(m.id)
    if (!pag) return fail(400, 'Pag could not update')
    pag.name = m.name
    return ok(pagView(pag.id))
  }),
  http.delete(`${D}/Pag`, async ({ request }) => {
    await latency()
    const id = new URL(request.url).searchParams.get('id')
    const before = db.pags.length
    db.pags = db.pags.filter((p) => p.id !== id)
    return db.pags.length < before ? ok(true) : fail(400, 'Pag could not delete')
  }),

  http.get(`${D}/PagDevice/getall`, async () => {
    await latency()
    return db.pagDevices.length ? ok(db.pagDevices.map(pagDeviceView)) : fail(404, 'Pag devices not found')
  }),
  http.get(`${D}/PagDevice/getactive`, async () => {
    await latency()
    const list = db.pagDevices.filter((p) => !p.inMaintenance)
    return list.length ? ok(list.map(pagDeviceView)) : fail(400, 'Pag devices not found')
  }),
  http.get(`${D}/PagDevice/getbyid/:id`, async ({ params }) => {
    await latency()
    const p = db.pagDevices.find((x) => x.id === params.id)
    return p ? ok(pagDeviceView(p)) : fail(404, 'Pag device not found')
  }),
  http.get(`${D}/PagDevice/getbypagid/:pagId`, async ({ params }) => {
    await latency()
    const list = db.pagDevices.filter((x) => x.pagId === params.pagId)
    return list.length ? ok(list.map(pagDeviceView)) : fail(404, 'Pag devices not found')
  }),
  http.post(`${D}/PagDevice`, async ({ request }) => {
    await latency()
    const m = (await request.json()) as AddPagDeviceModel
    const rec: PagDeviceRecord = { id: uuid(), name: m.name, deviceId: m.deviceId, pagId: m.pagId, ipAddress: m.ipAddress, port: m.port, timeout: m.timeOut, inMaintenance: m.inMaintenance }
    db.pagDevices.push(rec)
    return ok(pagDeviceView(rec))
  }),
  http.put(`${D}/PagDevice/update`, async ({ request }) => {
    await latency()
    const m = (await request.json()) as UpdatePagDeviceModel
    const rec = db.pagDevices.find((p) => p.id === m.id)
    if (!rec) return fail(400, 'Pag device could not update')
    Object.assign(rec, { name: m.name, deviceId: m.deviceId, pagId: m.pagId, ipAddress: m.ipAddress, port: m.port, timeout: m.timeOut, inMaintenance: m.inMaintenance })
    return ok(pagDeviceView(rec))
  }),
  // Backend'deki davranış birebir taklit ediliyor: isStart=true cihazı bakıma (InMaintenance=true) alır.
  http.put(`${D}/PagDevice/startorstop`, async ({ request }) => {
    await latency()
    const url = new URL(request.url)
    const isStart = url.searchParams.get('isStart') === 'true'
    const rec = db.pagDevices.find((p) => p.id === url.searchParams.get('id') && p.inMaintenance !== isStart)
    if (!rec) return fail(400, `Pag device could not ${isStart ? 'started' : 'stopped'}`)
    rec.inMaintenance = isStart
    return ok(true)
  }),
  http.put(`${D}/PagDevice/startorstopmulti`, async ({ request }) => {
    await latency()
    const isStart = new URL(request.url).searchParams.get('isStart') === 'true'
    const ids = (await request.json()) as string[]
    db.pagDevices.filter((p) => ids.includes(p.id)).forEach((p) => (p.inMaintenance = isStart))
    return ok(true)
  }),
  http.delete(`${D}/PagDevice`, async ({ request }) => {
    await latency()
    const id = new URL(request.url).searchParams.get('id')
    const before = db.pagDevices.length
    db.pagDevices = db.pagDevices.filter((p) => p.id !== id)
    return db.pagDevices.length < before ? ok(true) : fail(400, 'Pag devices could not delete')
  }),

  // ---------------------------------------------------------------- Rule: scriptler
  http.get(`${R}/PolicyScript/getall`, async () => {
    await latency()
    return db.scripts.length
      ? HttpResponse.json(db.scripts.map(({ id, name, script, updateDate }) => ({ id, name, script, updateDate })))
      : text('No Policy Script Found', 404)
  }),
  http.get(`${R}/PolicyScript/getbyid/:id`, async ({ params }) => {
    await latency()
    const s = db.scripts.find((x) => x.id === params.id)
    return s ? HttpResponse.json(s) : text('No Policy Script Found', 404)
  }),
  http.post(`${R}/PolicyScript/add`, async ({ request }) => {
    await latency()
    const m = (await request.json()) as AddScriptModel
    const now = toApiDate(new Date())
    const s = { id: uuid(), name: m.name, script: m.script, updateDate: now, createdDate: now, isRunning: false }
    db.scripts.push(s)
    return HttpResponse.json(s)
  }),
  http.put(`${R}/PolicyScript/update`, async ({ request }) => {
    await latency()
    const m = (await request.json()) as UpdateScriptModel
    const s = db.scripts.find((x) => x.id === m.id)
    if (!s) return text('Failed to update Policy Script', 400)
    Object.assign(s, { name: m.name, script: m.script, updateDate: toApiDate(new Date()) })
    return HttpResponse.json(s)
  }),
  http.put(`${R}/PolicyScript/runpolicyscript/:id`, async ({ params }) => {
    await delay(500)
    return db.scripts.some((x) => x.id === params.id) ? HttpResponse.json(true) : text('Failed to start or stop Policy Script', 400)
  }),
  http.delete(`${R}/PolicyScript/delete/:id`, async ({ params }) => {
    await latency()
    const before = db.scripts.length
    db.scripts = db.scripts.filter((x) => x.id !== params.id)
    return db.scripts.length < before ? HttpResponse.json(true) : text('Failed to delete Policy Script', 400)
  }),

  // ---------------------------------------------------------------- Rule: cron
  http.get(`${R}/CronPolicy/getall`, async () => {
    await latency()
    return HttpResponse.json(scriptsWithRelations())
  }),
  http.get(`${R}/CronPolicy/getactivejobs`, async () => {
    await latency()
    return HttpResponse.json(scriptsWithRelations().filter((c) => c.isRunning))
  }),
  http.get(`${R}/CronPolicy/getbyid/:id`, async ({ params }) => {
    await latency()
    return HttpResponse.json(scriptsWithRelations().find((c) => c.id === params.id) ?? null)
  }),
  http.post(`${R}/CronPolicy/add`, async ({ request }) => {
    await latency()
    const m = (await request.json()) as AddCronPolicyModel
    const rec = { id: uuid(), ...m, updateDate: toApiDate(new Date()), isRunning: false }
    db.cronPolicies.push(rec)
    return HttpResponse.json({ ...rec, policyScript: null })
  }),
  http.put(`${R}/CronPolicy/update`, async ({ request }) => {
    await latency()
    const m = (await request.json()) as UpdateCronPolicyModel
    const rec = db.cronPolicies.find((c) => c.id === m.id)
    if (!rec) return HttpResponse.json(null)
    Object.assign(rec, m, { updateDate: toApiDate(new Date()) })
    return HttpResponse.json({ ...rec, policyScript: null })
  }),
  http.put(`${R}/CronPolicy/startorstop/:pair`, async ({ params }) => {
    await latency()
    const [id, flag] = String(params.pair).split(',')
    const rec = db.cronPolicies.find((c) => c.id === id)
    if (!rec) return HttpResponse.json(false)
    rec.isRunning = flag === 'true'
    return HttpResponse.json(true)
  }),
  http.delete(`${R}/CronPolicy/delete/:id`, async ({ params }) => {
    await latency()
    const before = db.cronPolicies.length
    db.cronPolicies = db.cronPolicies.filter((c) => c.id !== params.id)
    return HttpResponse.json(db.cronPolicies.length < before)
  }),

  // ---------------------------------------------------------------- User
  http.get(`${U}/User/GetAllUser`, async () => {
    await latency()
    return HttpResponse.json(db.users)
  }),
  http.get(`${U}/User/GetUserById/:id`, async ({ params }) => {
    await latency()
    return HttpResponse.json(db.users.find((u) => u.id === params.id) ?? null)
  }),
  http.post(`${U}/User/AddUser`, async ({ request }) => {
    await latency()
    const m = (await request.json()) as AddUserModel
    if (!m.userName || !m.email || !m.password || m.password.length < 6) {
      return HttpResponse.json([{ propertyName: 'Password', errorMessage: 'Password must be at least 6 characters long.' }], { status: 400 })
    }
    const user = { id: uuid(), ...m, password: 'hash' }
    db.users.push(user)
    return HttpResponse.json(user)
  }),
  http.put(`${U}/User/UpdateUser`, async ({ request }) => {
    await latency()
    const m = (await request.json()) as UpdateUserModel
    const user = db.users.find((u) => u.id === m.id)
    if (!user) return HttpResponse.json(null)
    Object.assign(user, m)
    return HttpResponse.json(user)
  }),
  http.delete(`${U}/User/DeleteUser/:id`, async ({ params }) => {
    await latency()
    const before = db.users.length
    db.users = db.users.filter((u) => u.id !== params.id)
    return db.users.length < before ? new HttpResponse(null, { status: 200 }) : new HttpResponse(null, { status: 404 })
  }),
]

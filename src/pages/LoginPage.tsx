import { Eye, EyeOff, FlaskConical, Lock, LogIn, Orbit, Radar, ShieldCheck, User } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { errorMessage } from '../api/http'
import { useAuth } from '../auth/AuthContext'
import { Logo } from '../components/layout/Logo'
import { Button } from '../components/ui/Button'
import { Field, Input } from '../components/ui/Form'
import { formatUtcTime } from '../lib/format'
import { useNow } from '../lib/useNow'

function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function OrbitIllustration() {
  const stars = useMemo(() => {
    const rand = seeded(42)
    return Array.from({ length: 90 }, () => ({
      x: rand() * 600,
      y: rand() * 600,
      r: rand() * 1.1 + 0.2,
      o: rand() * 0.6 + 0.15,
    }))
  }, [])

  const orbits = [
    { rx: 170, ry: 58, rot: -22, dur: 14, color: '#22d3ee', sat: '#a5f3fc' },
    { rx: 225, ry: 92, rot: 18, dur: 22, color: '#a78bfa', sat: '#ddd6fe' },
    { rx: 280, ry: 70, rot: -6, dur: 31, color: '#38bdf8', sat: '#f0abfc' },
  ]

  return (
    <svg viewBox="0 0 600 600" className="h-full w-full" aria-hidden>
      <defs>
        <radialGradient id="lg-earth" cx="36%" cy="30%" r="80%">
          <stop offset="0" stopColor="#7dd3fc" />
          <stop offset="0.45" stopColor="#0369a1" />
          <stop offset="1" stopColor="#071a33" />
        </radialGradient>
        <radialGradient id="lg-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0.62" stopColor="#38bdf8" stopOpacity="0.35" />
          <stop offset="1" stopColor="#38bdf8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="lg-shade" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0.45" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.65" />
        </linearGradient>
        <filter id="lg-blur">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>

      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#cbd5e1" opacity={s.o} />
      ))}

      <circle cx="300" cy="300" r="165" fill="url(#lg-glow)" />
      <circle cx="300" cy="300" r="118" fill="url(#lg-earth)" />
      {/* Stilize kıtalar */}
      <g fill="#0ea5e9" opacity="0.28">
        <path d="M245 238c18-14 46-10 58 4 9 11-4 22-16 24-14 2-12 18-28 20-16 2-30-10-30-24 0-10 6-17 16-24z" />
        <path d="M320 300c16-6 38 2 44 18 5 14-8 30-24 34-14 3-22 18-34 12-12-6-6-22-4-34 2-14 6-24 18-30z" />
        <path d="M236 318c10-4 22 4 22 14s-10 18-20 16-14-8-12-16 4-12 10-14z" />
      </g>
      <circle cx="300" cy="300" r="118" fill="url(#lg-shade)" />
      <circle cx="300" cy="300" r="118" fill="none" stroke="#7dd3fc" strokeOpacity="0.35" />

      {/* Yer istasyonu */}
      <g transform="translate(262 252)">
        <circle r="10" fill="#f59e0b" opacity="0.18">
          <animate attributeName="r" values="4;16;4" dur="2.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0;0.5" dur="2.6s" repeatCount="indefinite" />
        </circle>
        <path d="M0 -5 L5 0 L0 5 L-5 0 Z" fill="#fbbf24" />
      </g>

      {orbits.map((o, i) => {
        const d = `M ${300 - o.rx} 300 a ${o.rx} ${o.ry} 0 1 0 ${o.rx * 2} 0 a ${o.rx} ${o.ry} 0 1 0 ${-o.rx * 2} 0`
        return (
          <g key={i} transform={`rotate(${o.rot} 300 300)`}>
            <path id={`lg-orbit-${i}`} d={d} fill="none" stroke={o.color} strokeOpacity="0.35" strokeDasharray="2 5" />
            <g>
              <circle r="9" fill={o.color} opacity="0.35" filter="url(#lg-blur)" />
              <rect x="-7" y="-1.5" width="14" height="3" rx="1" fill={o.color} opacity="0.85" />
              <rect x="-2.5" y="-2.5" width="5" height="5" rx="1" fill={o.sat} />
              <animateMotion dur={`${o.dur}s`} repeatCount="indefinite" rotate="auto" begin={`-${i * 4}s`}>
                <mpath href={`#lg-orbit-${i}`} />
              </animateMotion>
            </g>
          </g>
        )
      })}
    </svg>
  )
}

export default function LoginPage() {
  const { token, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as { from?: string; expired?: boolean } | null
  const now = useNow()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (token) return <Navigate to={state?.from ?? '/dashboard'} replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) {
      setError('Kullanıcı adı ve şifre gerekli.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await login(username.trim(), password)
      navigate(state?.from ?? '/dashboard', { replace: true })
    } catch (err) {
      setError(
        axios.isAxiosError(err) && err.response?.status === 401
          ? 'Kullanıcı adı veya şifre hatalı.'
          : errorMessage(err),
      )
    } finally {
      setSubmitting(false)
    }
  }

  const features = [
    { icon: Orbit, title: 'Canlı uydu takibi', text: 'SGP4 ile anlık konum, yer izi ve kapsama alanı' },
    { icon: Radar, title: 'Geçiş planlama', text: 'TLE’den geçiş hesabı ve otomatik planlayıcı' },
    { icon: ShieldCheck, title: 'Cihaz & kural yönetimi', text: 'PAG cihazları, scriptler ve cron politikaları' },
  ]

  return (
    <div className="relative flex min-h-full overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_30%_40%,rgb(14_165_233/0.12),transparent)]" />

      <section className="relative hidden flex-1 flex-col justify-between p-10 lg:flex">
        <Logo />
        <div className="relative mx-auto aspect-square w-full max-w-[560px]">
          <OrbitIllustration />
        </div>
        <div className="max-w-xl">
          <h1 className="text-3xl leading-tight font-semibold tracking-tight text-ink-100">
            Yer istasyonunuzu <span className="bg-gradient-to-r from-cyan-300 to-violet-300 bg-clip-text text-transparent">tek ekrandan</span> yönetin.
          </h1>
          <div className="mt-6 grid grid-cols-3 gap-4">
            {features.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-xl bg-white/[0.03] p-3.5 ring-1 ring-white/8">
                <Icon className="size-4 text-cyan-300" />
                <div className="mt-2 text-[13px] font-medium text-ink-100">{title}</div>
                <div className="mt-1 text-xs leading-relaxed text-ink-400">{text}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative flex w-full items-center justify-center p-6 lg:w-[520px] lg:border-l lg:border-white/6 lg:bg-ink-900/40 lg:backdrop-blur-xl">
        <div className="w-full max-w-sm animate-rise">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <div className="label-caps text-cyan-300/80">Operatör girişi</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Tekrar hoş geldiniz</h2>
          <p className="mt-1.5 text-sm text-ink-400">Devam etmek için hesabınızla oturum açın.</p>

          {state?.expired && (
            <div className="mt-5 rounded-lg bg-amber-400/10 px-3 py-2.5 text-sm text-amber-200 ring-1 ring-amber-400/25">
              Oturumunuzun süresi doldu. Lütfen tekrar giriş yapın.
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <Field label="Kullanıcı adı">
              {(id) => (
                <Input
                  id={id}
                  autoFocus
                  autoComplete="username"
                  leading={<User className="size-4" />}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="kullanici.adi"
                />
              )}
            </Field>
            <Field label="Şifre">
              {(id) => (
                <div className="relative">
                  <Input
                    id={id}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    leading={<Lock className="size-4" />}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-1 text-ink-400 hover:text-ink-200"
                    aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              )}
            </Field>

            {error && (
              <div className="rounded-lg bg-rose-500/10 px-3 py-2.5 text-sm text-rose-200 ring-1 ring-rose-400/25">{error}</div>
            )}

            <Button type="submit" variant="primary" className="w-full" loading={submitting} icon={<LogIn className="size-4" />}>
              Giriş yap
            </Button>
          </form>

          {import.meta.env.VITE_MOCK === 'true' && (
            <div className="mt-5 flex items-start gap-2 rounded-lg bg-fuchsia-400/8 px-3 py-2.5 text-xs text-fuchsia-200/90 ring-1 ring-fuchsia-400/20">
              <FlaskConical className="mt-0.5 size-3.5 shrink-0" />
              Demo modu: herhangi bir kullanıcı adı ve şifreyle giriş yapabilirsiniz.
            </div>
          )}

          <div className="mt-10 flex items-center justify-between text-xs text-ink-500">
            <span>Yargan Ground Segment</span>
            <span className="num">UTC {formatUtcTime(now)}</span>
          </div>
        </div>
      </section>
    </div>
  )
}

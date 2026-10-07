import { rmSync } from 'node:fs'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin, type ProxyOptions } from 'vite'

// Arayüz API'lere doğrudan değil, /svc/<servis> önekiyle aynı origin üzerinden gider.
// Geliştirmede bu proxy, production'da nginx (nginx/default.conf.template) aynı işi yapar;
// böylece API'lerde CORS ayarı gerekmez.
const services = {
  device: { env: 'DEVICE_API_URL', fallback: 'http://localhost:5098' },
  rule: { env: 'RULE_API_URL', fallback: 'http://localhost:5165' },
  satops: { env: 'SATOPS_API_URL', fallback: 'http://localhost:5131' },
  user: { env: 'USER_API_URL', fallback: 'http://localhost:5050' },
  login: { env: 'LOGIN_API_URL', fallback: 'http://localhost:5002' },
} as const

/** Demo modu dışındaki build'lerde MSW worker dosyasını çıktıdan kaldırır. */
function stripMockWorker(mode: string): Plugin {
  return {
    name: 'yargan:strip-mock-worker',
    apply: 'build',
    closeBundle() {
      if (mode !== 'mock') rmSync(resolve(import.meta.dirname, 'dist/mockServiceWorker.js'), { force: true })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const proxy: Record<string, ProxyOptions> = {}
  for (const [name, { env: key, fallback }] of Object.entries(services)) {
    const prefix = `/svc/${name}`
    proxy[prefix] = {
      target: env[key] || fallback,
      changeOrigin: true,
      secure: false,
      rewrite: (path) => path.slice(prefix.length) || '/',
    }
  }

  return {
    plugins: [react(), tailwindcss(), stripMockWorker(mode)],
    server: { port: 5173, proxy },
    preview: { port: 4173, proxy },
    build: {
      chunkSizeWarningLimit: 900,
    },
    // satellite.js 7, kullanılmasa da WASM/worker girişini paketletiyor; bu worker
    // top-level await içerdiği için ES modül formatında derlenmeli.
    worker: { format: 'es' },
  }
})

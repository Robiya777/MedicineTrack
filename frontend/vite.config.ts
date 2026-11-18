import path from 'node:path'
import { fileURLToPath } from 'node:url'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { z } from 'zod'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const proxyTargetSchema = z.string().refine((value) => {
  const url = URL.parse(value)
  return (
    url !== null &&
    (url.protocol === 'http:' || url.protocol === 'https:') &&
    !url.username && !url.password && url.href === `${url.origin}/`
  )
})

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'API_PROXY_TARGET')
  const target = proxyTargetSchema.safeParse(env.API_PROXY_TARGET ?? 'http://127.0.0.1:8000')

  if (!target.success) {
    throw new Error('API_PROXY_TARGET HTTP yoki HTTPS origin bo‘lishi kerak. Masalan, http://127.0.0.1:8000.')
  }

  const backend = { target: target.data, changeOrigin: true }

  return {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    plugins: [
      tanstackRouter({ target: 'react', autoCodeSplitting: true }),
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      tailwindcss(),
    ],
    server: {
      proxy: {
        '^/api(?:/|$)': backend,
        '^/health(?:/|$)': backend,
      },
    },
  }
})

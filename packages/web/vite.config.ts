import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

const webRoot = resolve(__dirname)

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, webRoot, '')

  const devPort = parseInt(env.VITE_DEV_PORT || '5183', 10)
  const apiBase = env.VITE_API_BASE_URL || '/api'
  const proxyTarget = env.VITE_DEV_API_PROXY || 'http://localhost:3400'

  return {
    plugins: [vue()],
    envDir: webRoot,
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    server: {
      port: devPort,
      host: '0.0.0.0',
      proxy: {
        [apiBase]: {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})

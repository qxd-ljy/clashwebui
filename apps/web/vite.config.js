import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  publicDir: path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../docs'),
  resolve: {
    alias: {
      '@': path.resolve(path.dirname(new URL(import.meta.url).pathname), './src'),
    },
  },
  server: {
    host: true, // Listen on all addresses (0.0.0.0)
    strictPort: true,
    port: parseInt(process.env.PORT) || 5173, // 从环境变量读取端口，默认 5173
    hmr: {
      clientPort: parseInt(process.env.PORT) || 5173, // Force client to connect to the same port
    },
    proxy: {
      // Backend API (ClashWebUI后端)
      '/backend': {
        target: `http://127.0.0.1:${process.env.BACKEND_PORT || 3000}`,
        changeOrigin: true,
        ws: false,
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('[Vite Proxy Error /backend]', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('[Vite Proxy] /backend ->', req.url);
          });
        },
      },
      // Clash External Controller API (通过后端代理以添加认证)
      '/api': {
        target: `http://127.0.0.1:${process.env.BACKEND_PORT || 3000}`,
        changeOrigin: true,
        ws: true, // Enable WebSocket proxy
      },
    },
  },

})

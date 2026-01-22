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
    port: 5010,
    hmr: {
      clientPort: 5010, // Force client to connect to the same port
    },
    proxy: {
      '/api/memory': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/api\/memory/, '/memory'),
      },
      '/api': {
        target: 'http://127.0.0.1:9092',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/backend': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        // rewrite: (path) => path.replace(/^\/backend/, ''), // Backend now serves at /backend
      },
    },
  },


})

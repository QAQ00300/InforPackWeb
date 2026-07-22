import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  build: {
    sourcemap: 'hidden',
  },
  server: {
    host: '192.168.0.94',
    port: 8093,
    proxy: {
      '/api': {
        target: 'http://192.168.0.94:8092',
        changeOrigin: true,
      },
      '/files': {
        target: 'http://192.168.0.94:8092',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [
    react({
      babel: {
        plugins: [
          'react-dev-locator',
        ],
      },
    }),
  ],
})

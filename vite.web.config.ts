// Renderer only, in a plain browser (npm run dev:web). File IO falls back to
// upload/download (platform.ts). Used for fast UI iteration and live checks.
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@engine': resolve(__dirname, 'src/renderer/src/engine')
    }
  },
  plugins: [react()],
  server: { port: 5317, strictPort: true }
})

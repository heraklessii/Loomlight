import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@engine': resolve(__dirname, 'src/renderer/src/engine')
    }
  },
  test: { include: ['src/**/*.test.ts'], environment: 'node' }
})

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: ['src/test/e2e/**/*.e2e.test.ts'],
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    setupFiles: [],
  },
})

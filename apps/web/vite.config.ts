import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  envDir: path.resolve(__dirname, '../..'),
  resolve: {
    alias: {
      '@trip/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
})

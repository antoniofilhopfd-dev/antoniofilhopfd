import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/health': 'http://localhost:3333',
      '/auth': 'http://localhost:3333',
      '/users': 'http://localhost:3333',
    },
  },
})

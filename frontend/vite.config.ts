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
      '/metrics': 'http://localhost:3333',
      '/campaigns': 'http://localhost:3333',
      '/adsets': 'http://localhost:3333',
      '/ads': 'http://localhost:3333',
      '/integrations': 'http://localhost:3333',
      '/observations': 'http://localhost:3333',
      '/reports': 'http://localhost:3333',
      '/drafts': 'http://localhost:3333',
    },
  },
})

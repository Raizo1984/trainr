import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // Replit serveert de preview via een proxy op poort 5000 en met een
    // wisselende hostnaam; zonder deze drie regels blijft het voorbeeld leeg.
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true,
    // De backend draait in ontwikkeling apart. /api gaat daarheen, zodat de
    // API-sleutel ook lokaal nooit in de browser terechtkomt.
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
})

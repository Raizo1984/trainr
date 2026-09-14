import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        /**
         * React en de animatiebibliotheek veranderen zelden en zitten op elk
         * scherm. Een eigen bestand houdt ze in de cache staan wanneer de app
         * zelf wijzigt.
         *
         * Recharts staat hier bewust NIET bij. Een handmatige naam maakt van
         * die brok een onderdeel van de opstartgraaf, waarna Vite hem met
         * modulepreload alsnog bij het eerste scherm ophaalt. Precies wat het
         * lui laden moest voorkomen. Laat rolldown die brok zelf indelen.
         */
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return
          if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) return 'react'
          if (id.includes('node_modules/motion')) return 'motion'
          return undefined
        },
      },
    },
  },
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

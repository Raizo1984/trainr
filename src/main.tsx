import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

/*
 * De service worker maakt de app bruikbaar zonder bereik en zet hem op het
 * beginscherm van je telefoon. Registreren gebeurt pas na het laden, zodat het
 * eerste scherm er geen seconde langer over doet.
 *
 * Alleen in de gebouwde versie: tijdens ontwikkelen zou een cache je
 * wijzigingen opvreten, en dat kost meer tijd dan het oplevert.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Geen service worker betekent alleen: geen offline. De app werkt verder.
    })
  })
}

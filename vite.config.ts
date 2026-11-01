import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // basicSsl allows iPhone Safari to access camera and mic over local Wi-Fi IP
    process.env.VITE_HTTPS === 'true' ? basicSsl() : undefined,
  ].filter(Boolean),
  base: './',
  server: {
    port: 5173,
    host: true, // Listen on all network interfaces (0.0.0.0)
  },
  preview: {
    port: 5173,
    host: true,
  },
})

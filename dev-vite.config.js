// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/mml-api': {  // ← ilman trailing slashia tässä
        target: 'https://avoin-paikkatieto.maanmittauslaitos.fi',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/mml-api/, ''),  // poistaa /mml-api alusta
      },
    },
  },
})
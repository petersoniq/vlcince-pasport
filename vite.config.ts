import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages beží defaultne na https://<username>.github.io/<repo>/ (podpriečinok),
// zatiaľ čo Netlify beží na koreňovej doméne. VITE_BASE_PATH umožňuje appke fungovať
// na oboch bez úpravy kódu - nastavuje sa len v GitHub Actions workflow (.github/workflows/deploy.yml).
const basePath = process.env.VITE_BASE_PATH || '/';

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png'],
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
      manifest: {
        name: 'Vlčince – Pasport mobiliáru a zelene',
        short_name: 'Vlčince Pasport',
        description: 'Zber a vizualizácia dát o mobiliári a zeleni sídliska Vlčince',
        lang: 'sk',
        theme_color: '#047857',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: basePath,
        scope: basePath,
        icons: [
          { src: `${basePath}icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: `${basePath}icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: `${basePath}icons/icon-192-maskable.png`, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: `${basePath}icons/icon-512-maskable.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: {
    host: true,
  },
});

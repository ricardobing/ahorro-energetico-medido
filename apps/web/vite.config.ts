import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Kamai · Primer paso con ahorro medido (prototipo)',
        short_name: 'Kamai prototipo',
        lang: 'es',
        theme_color: '#1f3636',
        background_color: '#f2f2f2',
        display: 'standalone',
        start_url: '/',
        icons: [],
      },
      // Solo lo que usa la primera pantalla: el subconjunto latino de Mona Sans (sin las otras escrituras).
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,webmanifest}', 'assets/mona-sans-latin-wght-*.woff2'],
      },
    }),
  ],
  server: {
    port: 5180,
    proxy: {
      '/api': {
        target: 'http://localhost:4100',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
  preview: {
    port: 5180,
    proxy: {
      '/api': {
        target: 'http://localhost:4100',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    name: 'web',
    include: ['test/**/*.test.{ts,tsx}'],
    exclude: ['test/bundle-size.test.ts'],
    environment: 'jsdom',
    setupFiles: ['test/setup.ts'],
  },
});

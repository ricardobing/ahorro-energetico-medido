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
      workbox: { navigateFallback: '/index.html', globPatterns: ['**/*.{js,css,html,woff2,svg}'] },
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

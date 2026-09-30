/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'icons/atlas-32.png', 'icons/atlas-64.png', 'gui/*.png'],
      manifest: {
        name: 'CraftBot',
        short_name: 'CraftBot',
        description: 'Receitas, farms, drops e dicas do Minecraft Java 26.3, direto dos arquivos do jogo.',
        lang: 'pt-BR',
        theme_color: '#141517',
        background_color: '#141517',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/app-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/app-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/app-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,woff2,json}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/i\.ytimg\.com\/.*/,
            handler: 'CacheFirst',
            options: { cacheName: 'yt-thumbs', expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
});

/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite';
import type { ServerResponse } from 'node:http';
import { handleChat } from './api/_lib/chat';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import config from './craftbot.config.json';

// Versão exposta ao index.html (%VITE_MC_VERSION%).
process.env.VITE_MC_VERSION = config.minecraftVersion;

/** /api/chat também no `npm run dev` e no `vite preview` (lê a chave do .env.local). */
function apiChat(mode: string): Plugin {
  const env = loadEnv(mode, process.cwd(), '');
  const handler: Connect.NextHandleFunction = async (req, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const request = new Request(`http://localhost${req.url}`, {
      method: req.method,
      headers: { 'content-type': req.headers['content-type'] ?? 'application/json' },
      body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
    });
    const response = await handleChat(request, { key: env.OPENROUTER_API_KEY, model: env.OPENROUTER_MODEL });
    res.statusCode = response.status;
    response.headers.forEach((v, k) => res.setHeader(k, v));
    if (!response.body) return res.end();
    const reader = response.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  };
  return {
    name: 'craftbot-api-chat',
    configureServer: (server) => void server.middlewares.use('/api/chat', handler),
    configurePreviewServer: (server) => void server.middlewares.use('/api/chat', handler),
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [
    apiChat(mode),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'icons/atlas-32.png', 'icons/atlas-64.png', 'gui/*.png'],
      manifest: {
        name: 'CraftBot',
        short_name: 'CraftBot',
        description: `Receitas, farms, drops e dicas do Minecraft Java ${config.minecraftVersion}, direto dos arquivos do jogo.`,
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
}));

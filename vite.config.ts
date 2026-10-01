/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite';
import type { ServerResponse } from 'node:http';
import { handleChat } from './api/_lib/chat';
import { handleWeb } from './api/_lib/web';
import { handleWiki } from './api/_lib/wiki';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import config from './craftbot.config.json';
import vercel from './vercel.json';

/** Mesmos cabeçalhos de segurança da Vercel no `vite preview` (os testes E2E pegam CSP quebrada). */
const previewHeaders = Object.fromEntries(
  vercel.headers[0].headers
    .filter((h) => h.key !== 'Strict-Transport-Security')
    .map((h) => [h.key, h.key === 'Content-Security-Policy' ? h.value.replace(/;\s*upgrade-insecure-requests/, '') : h.value]),
);

// Versão exposta ao index.html (%VITE_MC_VERSION%).
process.env.VITE_MC_VERSION = config.minecraftVersion;

const HOP_HEADERS = new Set(['host', 'connection', 'content-length', 'transfer-encoding', 'keep-alive']);

/** /api/chat, /api/web e /api/wiki também no `npm run dev` e no `vite preview` (lê a chave do .env.local). */
function apiChat(mode: string): Plugin {
  const env = loadEnv(mode, process.cwd(), '');
  const route = (handle: (r: Request) => Promise<Response>): Connect.NextHandleFunction => async (req, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const request = new Request(`http://${req.headers.host ?? 'localhost'}${req.originalUrl ?? req.url}`, {
      method: req.method,
      // Repassa os cabeçalhos (Origin, Sec-Fetch-Site, Host) para as proteções do servidor.
      headers: Object.entries(req.headers).flatMap(([k, v]) => (typeof v === 'string' && !HOP_HEADERS.has(k) ? [[k, v] as [string, string]] : [])),
      body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
    });
    const response = await handle(request);
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
  const chat = route((r) => handleChat(r, { key: env.OPENROUTER_API_KEY, model: env.OPENROUTER_MODEL }));
  const web = route((r) => handleWeb(r, { key: env.OPENROUTER_API_KEY }));
  const wiki = route(handleWiki);
  return {
    name: 'craftbot-api',
    configureServer: (server) => {
      server.middlewares.use('/api/chat', chat);
      server.middlewares.use('/api/web', web);
      server.middlewares.use('/api/wiki', wiki);
    },
    configurePreviewServer: (server) => {
      server.middlewares.use('/api/chat', chat);
      server.middlewares.use('/api/web', web);
      server.middlewares.use('/api/wiki', wiki);
    },
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
  preview: { headers: previewHeaders },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
}));

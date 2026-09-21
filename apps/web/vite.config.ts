import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The monorepo keeps one .env at the repo root (covers Vite, the Cloudflare
// proxy, and Supabase function secrets) instead of one per workspace.
const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  envDir: repoRoot,
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    // Dev-only convenience mirroring functions/api/[[path]].ts's rewrite rules, so `npm run dev`
    // has working /api/* calls without also running `wrangler pages dev`. Not used in production —
    // the Cloudflare Pages Function is the real proxy; this just avoids needing two processes for
    // routine UI iteration. Keep the two rewrites in sync if the Function's routing ever changes.
    proxy: {
      '/api/organiser': {
        target: 'http://127.0.0.1:54321/functions/v1/organiser-api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/organiser/, ''),
      },
      '/api/polls': {
        target: 'http://127.0.0.1:54321/functions/v1/voter-api/polls',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/polls/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});

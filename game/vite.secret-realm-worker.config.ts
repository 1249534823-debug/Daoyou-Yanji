import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  ssr: { noExternal: true },
  resolve: {
    alias: {
      '@server': fileURLToPath(new URL('./src/server', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
    },
  },
  build: {
    ssr: './src/server/workers/secretRealmMatcher.worker.ts',
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      output: { entryFileNames: 'secret-realm-matcher.js' },
    },
  },
});

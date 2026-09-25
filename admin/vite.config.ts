import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// VITE_BASE: panel bir alt klasörde yayınlanacaksa (ör. /admin/) burada belirtin.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: env.VITE_BASE || '/',
    plugins: [react()],
    build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 900 },
    server: { port: 5173 },
    preview: { port: 4173 },
  };
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root,
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true, rollupOptions: { input: { sidepanel: resolve(root, 'index.html'), background: resolve(root, 'src/background.ts'), content: resolve(root, 'src/content/detect.ts') }, output: { entryFileNames: 'assets/[name].js' } } }
});

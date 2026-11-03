import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/worker.ts'),
      name: 'md2interact',
      formats: ['es'],
      fileName: () => 'md2interact.js',
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2020',
    rollupOptions: {
      output: {
        codeSplitting: false,
      },
    },
  },
});

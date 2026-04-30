import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/worker.ts'),
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
        // Ensure the worker is a single self-contained file
        inlineDynamicImports: true,
      },
    },
  },
});

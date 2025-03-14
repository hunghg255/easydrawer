import fs from 'node:fs';

import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs', 'iife'],
  treeshake: true,
  clean: true,
  platform: 'browser',
  dts: true,
  splitting: true,
  minify: true,
  sourcemap: process.env.NODE_ENV !== 'production',
  ignoreWatch: ['**/node_modules', '**/dist'],
  globalName: 'EasyDrawer',
  onSuccess: async () => {
    fs.renameSync('dist/index.global.js', 'dist/easydrawer.js');
  }
});

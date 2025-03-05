import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  treeshake: true,
  clean: true,
  platform: 'browser',
  dts: {
    entry: 'src/index.ts',
  },
  splitting: true,
  minify: true,
  sourcemap: false,
  ignoreWatch: ['**/node_modules', '**/dist'],
});

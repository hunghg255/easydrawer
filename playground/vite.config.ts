import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const src = fileURLToPath(new URL('../src', import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Use the library source directly: no build step, changes show up live.
    alias: [
      { find: /^easydrawer$/, replacement: `${src}/index.ts` },
      { find: /^~\//, replacement: `${src}/` },
    ],
  },
  server: {
    allowedHosts: true,
  },
});

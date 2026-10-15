import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitepress';

const src = fileURLToPath(new URL('../../src', import.meta.url));

export default defineConfig({
  title: 'EasyDrawer',
  description: 'Natural-feeling drawing & whiteboard library for the web, with stylus and tablet support.',
  head: [
    ['meta', { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' }],
  ],
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started', activeMatch: '/guide/' },
      { text: 'API', link: '/api/editor', activeMatch: '/api/' },
      { text: 'Playground', link: '/playground' },
      { text: 'AI Skills', link: '/skills' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Getting started', link: '/guide/getting-started' },
            { text: 'Tools', link: '/guide/tools' },
            { text: 'AI features', link: '/guide/ai' },
            { text: 'Frames & presenting', link: '/guide/frames' },
            { text: 'Natural ink', link: '/guide/natural-ink' },
            { text: 'Tablets & stylus', link: '/guide/tablets' },
            { text: 'Saving & loading', link: '/guide/saving' },
            { text: 'Frameworks (React, Vue)', link: '/guide/frameworks' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'API reference',
          items: [
            { text: 'Editor', link: '/api/editor' },
            { text: 'editor.tools', link: '/api/tools' },
            { text: 'Settings', link: '/api/settings' },
          ],
        },
      ],
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/hunghg255/easydrawer' }],
    search: { provider: 'local' },
    footer: { message: 'Released under the MIT License.' },
  },
  vite: {
    // Use the library source directly: no need to build it first, and changes show up live.
    resolve: {
      alias: [
        { find: /^easydrawer$/, replacement: `${src}/index.ts` },
        { find: /^~\//, replacement: `${src}/` },
      ],
    },
    ssr: { noExternal: ['easydrawer'] },
  },
});

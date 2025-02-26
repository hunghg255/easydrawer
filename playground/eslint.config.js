import { basic, react } from '@hunghg255/eslint-config';

export default [
  ...basic(),
  ...react(),
  {
    rules: {
      indent: 'warn',
    },
  },
  {
    ignores: [
      'dist/**/*.ts',
      'dist/**',
      'scripts/genColorCss.ts',
      'tailwind.config.ts',
      'src/styles/color/color.tailwind.ts',
    ],
  },
];

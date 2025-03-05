import { basic } from '@hunghg255/eslint-config';

export default [
  ...basic(),
  {
    rules: {
      indent: 'warn',
      "@typescript-eslint/no-unused-vars": 'warn',
      "@typescript-eslint/unbound-method": "off",
      "@typescript-eslint/no-empty-function": "off",
      quotes: ["error", "single"]
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

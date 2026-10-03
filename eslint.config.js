import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const sharedImportBoundaries = [
  '@server/*',
  '@app/*',
  '@daoyou/api*',
  '@daoyou/web*',
  'node:*',
  '**/apps/**',
  '@nestjs/**',
  'express',
  'pg',
  'drizzle-orm',
  'drizzle-orm/**',
  'ioredis',
  'nats',
  'react',
  'react-dom',
  'react-dom/**',
  'clsx',
  'tailwind-merge',
];

export default tseslint.config(
  { ignores: ['**/dist/**'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true, allowExportNames: ['loader'] },
      ],
    },
  },
  {
    files: ['packages/shared/src/**/*.{ts,tsx}', 'apps/web/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '@server/*',
            '@daoyou/api',
            '@daoyou/api/*',
            '@daoyou/web',
            '@daoyou/web/*',
            '**/apps/api/**',
            '**/apps/web/**',
          ],
        },
      ],
    },
  },
  {
    files: ['packages/shared/src/**/*.{ts,tsx}'],
    ignores: ['**/*.test.*', '**/*.spec.*'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: sharedImportBoundaries,
        },
      ],
    },
  },
  {
    files: ['apps/api/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['@app/*', '@daoyou/web*', '**/apps/web/**'] },
      ],
    },
  },
  {
    files: ['packages/shared/src/engine/combat-v6/**/*.ts'],
    ignores: ['**/*.test.*', '**/*.spec.*'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: sharedImportBoundaries },
            {
              regex: '(?:^|/)(?:battle-v5|creation-v2)(?:/|$)',
              message: 'V6 must not depend on retired engines.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/shared/src/engine/combat-v6/core/**/*.ts'],
    ignores: ['**/*.test.*', '**/*.spec.*'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: sharedImportBoundaries },
            {
              regex:
                '(?:^|/)(?:rules-daoyou|projection|content|battle-v5|creation-v2)(?:/|$)',
              message: 'Combat core receives rules and content from its host.',
            },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the battle RNG.' },
        {
          object: 'Date',
          property: 'now',
          message: 'Pass time from the host.',
        },
      ],
    },
  },
  {
    files: ['apps/api/src/lib/repositories/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@app/*', '@daoyou/web*', '**/apps/web/**'] },
            {
              group: [
                '@server/*/application/**',
                '@server/sects/organization/**',
              ],
              message: 'Repositories must not call application services.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/api/src/**/*.service.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: ['@app/*', '@daoyou/web*', '**/apps/web/**'],
          paths: [
            {
              name: '@server/lib/drizzle/db',
              importNames: ['db', 'getExecutor'],
              message:
                'Inject DRIZZLE_DATABASE in Nest services; pass it to repository calls.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/api/src/market/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@app/*', '@daoyou/web*', '**/apps/web/**'] },
            {
              group: [
                '@server/cultivator/application/**',
                '@server/inventory/application/**',
              ],
              message:
                'Market uses public character queries and inventory operations/providers.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/api/src/inventory/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@app/*', '@daoyou/web*', '**/apps/web/**'] },
            {
              group: ['@server/market/**', '**/market/application/**'],
              message:
                'Inventory owns recycling and must not depend on Market.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/api/src/lib/mq/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@app/*', '@daoyou/web*', '**/apps/web/**'] },
            {
              group: [
                '@server/*/application/**',
                '@server/sects/organization/**',
                '@server/runtime/**',
              ],
              message:
                'Business message registration belongs to Runtime; MQ libraries own transport.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', '**/__mocks__/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
);

import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

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
          patterns: [
            '@server/*',
            '@app/*',
            '@daoyou/api*',
            '@daoyou/web*',
            'node:*',
            '**/apps/**',
          ],
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
    files: ['**/*.test.{ts,tsx}', '**/__mocks__/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
);

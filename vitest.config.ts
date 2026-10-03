import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const alias = {
  '@daoyou/shared': fileURLToPath(
    new URL('./packages/shared/src', import.meta.url),
  ),
};

export default defineConfig({
  resolve: { alias },
  test: {
    environment: 'node',
    exclude: ['**/dist/**', 'node_modules/**'],
    globals: true,
    include: [
      'packages/shared/src/**/*.test.ts',
      'packages/shared/src/**/*.spec.ts',
      'packages/shared/src/**/*.test.tsx',
      'packages/shared/src/**/*.spec.tsx',
    ],
    restoreMocks: true,
  },
});

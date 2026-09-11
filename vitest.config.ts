import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@ai-eval/core': path.resolve(__dirname, './packages/core/src/index.ts'),
      '@ai-eval/providers': path.resolve(__dirname, './packages/providers/src/index.ts'),
      '@ai-eval/evaluators': path.resolve(__dirname, './packages/evaluators/src/index.ts'),
      '@ai-eval/datasets': path.resolve(__dirname, './packages/datasets/src/index.ts'),
      '@ai-eval/reporters': path.resolve(__dirname, './packages/reporters/src/index.ts'),
      'ai-eval-kit': path.resolve(__dirname, './packages/sdk/src/index.ts'),
    },
  },
});

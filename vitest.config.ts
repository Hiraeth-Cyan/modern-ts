// vitest.config.ts
import {defineConfig} from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      src: path.resolve(__dirname, './src'),
    },
  },
  test: {
    typecheck: {
      enabled: false,
      only: true,
      include: ['src/**/*test-d.ts'],
    },
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        '**/*.test-d.ts',
        'src/index.ts',
        'dist/**',
        'coverage/**',
        'node_modules/**',
        '**/*.d.ts',
        '**/*-types.ts',
        '**/types.ts',
        '**/types/**',
        '**/*.{test,spec}.{ts,tsx}',
        '**/__export*.ts',
      ],
    },
  },
});

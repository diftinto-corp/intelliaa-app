import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import path from 'path';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    // Test environment
    environment: 'jsdom',

    // Global test utilities
    globals: true,

    // Setup files
    setupFiles: ['./vitest.setup.ts'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json', 'lcov'],
      exclude: [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.spec.tsx',
        '**/node_modules/**',
        '**/dist/**',
        '**/.next/**',
        '**/coverage/**',
        '**/vitest.config.ts',
        '**/vitest.setup.ts',
        '**/__tests__/fixtures/**',
      ],
      include: [
        'src/**/*.ts',
        'src/**/*.tsx',
      ],
      // Coverage thresholds
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },

    // Timeout for tests
    testTimeout: 10000,

    // Watch mode configuration
    watch: false,

    // Exclude patterns
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
    ],

    // Include patterns
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
    ],
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

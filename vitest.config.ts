import { fileURLToPath } from 'node:url'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      // Required for using path aliases with vi.mock
      '#core': fileURLToPath(new URL('./packages/core/src', import.meta.url)),
    },
  },
  test: {
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['actions/**/src/**/*.ts', 'packages/core/src/**/*.ts', 'packages/cli/src/**/*.ts'],
      exclude: [
        '**/dist/**',
        '**/*.test.ts',
        '**/*.d.ts',
        // CLI helpers (context/deps wiring)
        'packages/core/src/cli-types.ts',
        // Entry points (minimal logic)
        'packages/cli/src/index.ts',
        // Barrel exports
        'packages/core/src/index.ts',
        // Type definitions only
        'packages/core/src/types/index.ts',
      ],
      /**
       * Coverage thresholds: 90% (error threshold)
       * - Error if below 90%
       * - 100% is not cost-effective and reduces test maintainability
       *
       * Reference: Google's standard considers 90% exemplary
       * @see https://testing.googleblog.com/2020/08/code-coverage-best-practices.html
       */
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
})

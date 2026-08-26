import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      // @ametie/vue-muza-devtools is an optional peer not installed in the test env.
      // This alias lets Vite resolve it at transform time; vi.mock() then intercepts it at runtime.
      "@ametie/vue-muza-devtools": resolve(__dirname, "tests/__mocks__/@ametie/vue-muza-devtools.ts"),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    // Tests live outside src/ — see tests/README.md
    include: ['tests/**/*.test.ts'],
  },
})

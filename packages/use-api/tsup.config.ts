import { defineConfig } from 'tsup'

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
    shims: true,
    splitting: true,
    external: ['vue', 'axios'],
    noExternal: ['@ametie/vue-muza-devtools'],
    outExtension({ format }) {
        return {
            js: format === 'cjs' ? '.cjs' : '.mjs',
        }
    },
})

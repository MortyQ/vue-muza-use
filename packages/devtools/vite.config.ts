import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import dts from "vite-plugin-dts";

export default defineConfig({
    plugins: [
        vue(),
        dts({ include: ["src"], rollupTypes: true }),
    ],
    build: {
        lib: {
            entry: "src/index.ts",
            formats: ["es"],
            fileName: "index",
        },
        rollupOptions: {
            external: ["vue"],
            output: {
                entryFileNames: "[name].mjs",
            },
        },
        cssCodeSplit: false,
    },
});

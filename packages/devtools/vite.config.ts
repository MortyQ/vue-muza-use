import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import dts from "vite-plugin-dts";
import cssInjectedByJs from "vite-plugin-css-injected-by-js";

export default defineConfig({
    plugins: [
        tailwindcss(),
        vue(),
        cssInjectedByJs(),
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

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import dts from "vite-plugin-dts";
import cssInjectedByJs from "vite-plugin-css-injected-by-js";

export default defineConfig({
    plugins: [
        tailwindcss(),
        vue(),
        // Queue ALL CSS (global + scoped) into window.__vmdPendingCss at module eval time.
        // mountDevtoolsPanel() drains this queue into the shadow root instead of <head>.
        cssInjectedByJs({
            injectCodeFunction: function(cssCode) {
                const w = window as unknown as { __vmdPendingCss?: string };
                w.__vmdPendingCss = (w.__vmdPendingCss ?? "") + cssCode;
            },
        }),
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

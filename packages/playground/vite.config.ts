import { resolve } from "path";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [tailwindcss(), vue()],
    resolve: {
        alias: {
            "@": resolve(__dirname, "src"),
            "@ametie/vue-muza-use": resolve(__dirname, "../use-api/src/index.ts"),
        },
    },
    server: {
        port: 5174,
        host: true,
    },
});

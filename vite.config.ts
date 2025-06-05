import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    plugins: [tailwindcss()],
    server: {
        allowedHosts: ["dev.cat5python.com"], // for hcaptcha
    },
    base: "/chat2/",
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, "index.html"),
                legal: resolve(__dirname, "legal.html"),
            },
        },
    },
});

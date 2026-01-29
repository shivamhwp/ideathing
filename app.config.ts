import { defineConfig } from "@tanstack/start/config";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  vite: {
    plugins: [viteTsConfigPaths(), tailwindcss()],
  },
  server: {
    preset: "vercel",
  },
});

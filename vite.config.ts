import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Served from https://andersonhall.github.io/tabletop-tunes/ in production.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/tabletop-tunes/" : "/",
  plugins: [react(), tailwindcss()],
}));

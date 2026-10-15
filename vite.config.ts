/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Each build gets an id. The app compares it with the published version.json
// to show a "new version available" banner.
const BUILD_ID = process.env.BUILD_ID ?? new Date().toISOString();

// BASE_PATH lets the app live in a subfolder, e.g. "/workouttracker/" on GitHub Pages.
export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [
    react(),
    {
      name: "version-file",
      generateBundle() {
        this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ build: BUILD_ID }) });
      },
    },
  ],
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:8787" },
  },
  preview: {
    port: 4173,
    proxy: { "/api": "http://localhost:8787" },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    setupFiles: ["fake-indexeddb/auto"],
  },
});

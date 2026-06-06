import { defineConfig } from "vite";

// Web-first build. Relative base so the same bundle works when wrapped by
// Capacitor for Android/iOS later (assets resolve from the app's local root).
export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    outDir: "dist",
  },
});

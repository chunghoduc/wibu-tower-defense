import { defineConfig } from "vite";
import { fileLog } from "./vite-plugin-filelog.ts";

// Web-first build. Relative base so the same bundle works when wrapped by
// Capacitor for Android/iOS later (assets resolve from the app's local root).
export default defineConfig({
  base: "./",
  plugins: [fileLog()], // dev/preview: persist client logs to logs/runtime.log
  build: {
    target: "es2022",
    outDir: "dist",
  },
});

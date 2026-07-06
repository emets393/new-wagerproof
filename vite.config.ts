import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import fs from "fs";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isDevelopment = mode === 'development';
  
  return {
    server: {
      host: "0.0.0.0",
      port: 8080,
      strictPort: true,
      // Disable HTTPS for now - can be re-enabled if certificates are added
      // https: false,
      watch: {
        // The repo also hosts the native apps and worker projects — hundreds of
        // thousands of files (iOS build dirs alone are ~10GB). Watching them
        // starves the dev server's threadpool and the app never loads.
        ignored: [
          "**/wagerproof-ios-native/**",
          "**/wagerproof-mobile/**",
          "**/agents-v3/**",
          "**/wagerproof-mcp/**",
          "**/wagerproof-tool-core/**",
          "**/research/**",
          "**/supabase/**",
          "**/.codex-venv/**",
          "**/dist/**",
        ],
      },
    },
    plugins: [
      react(),
      isDevelopment && componentTagger(),
    ].filter(Boolean),
    optimizeDeps: {
      // Without explicit entries Vite globs the ENTIRE repo for **/*.html —
      // including the iOS/mobile build trees (100k+ files) — and the dev
      // server starves before serving a single module.
      entries: ["index.html"],
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});

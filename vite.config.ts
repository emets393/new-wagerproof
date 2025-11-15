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
    },
    plugins: [
      react(),
      isDevelopment && componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});

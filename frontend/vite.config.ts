import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  build: {
    sourcemap: true
  },
  server: {
    host: "0.0.0.0",
    port: 80,
    // Proxy configuration for API requests
    proxy: {
      // Any request that starts with '/api' will be proxied to backend
      '/api': {
        target: 'http://223.130.132.136:6011',
        changeOrigin: true,
        // rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
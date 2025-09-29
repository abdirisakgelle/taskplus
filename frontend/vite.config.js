import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src")
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        // Silence deprecation warnings coming from dependencies (e.g., Bootstrap)
        quietDeps: true,
        // Explicitly silence the mixed-decls deprecation that Bootstrap triggers
        silenceDeprecations: ["mixed-decls"]
      }
    }
  }
});
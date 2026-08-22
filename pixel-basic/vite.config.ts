import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),       // Dashboard
        editor: resolve(__dirname, "editor.html"),    // IDE
        docs: resolve(__dirname, "docs.html"),        // Documentation
        market: resolve(__dirname, "market.html"),    // Marketplace
      },
    },
  },
});

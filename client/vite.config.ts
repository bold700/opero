import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Vite config for the Opero web client (replacing Next.js).
// - react(): JSX + Fast Refresh
// - tailwindcss(): Tailwind v4 via the official Vite plugin (no PostCSS config)
// - resolve.tsconfigPaths: native @/* and @opero/shared resolution from tsconfig
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    port: 3000,
  },
});

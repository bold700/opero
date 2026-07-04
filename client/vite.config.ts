import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// Vite config for the Opero web client (replacing Next.js).
// - react(): JSX + Fast Refresh
// - tailwindcss(): Tailwind v4 via the official Vite plugin (no PostCSS config)
// - VitePWA(): installable PWA — app-shell precache + web manifest. Online-only:
//   we precache the built shell/assets so the app launches instantly and installs
//   to the home screen, but API responses are NOT cached (no offline data).
// - resolve.tsconfigPaths: native @/* and @opero/shared resolution from tsconfig
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "icon.svg"],
      manifest: {
        name: "Opero — Werkbonnen",
        short_name: "Opero",
        description: "Werkbonnen, planning en klanten voor je isolatiebedrijf.",
        lang: "nl",
        theme_color: "#6750A4",
        background_color: "#F5F5F5",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "pwa-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Precache the built app shell (JS/CSS/HTML/icons/fonts) so it launches
        // offline-instant. SPA fallback to index.html (coexists with the Vercel
        // rewrite). API calls (/api/*) are intentionally NOT cached — online-only.
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Never serve API data from cache — always hit the network.
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    port: 3000,
  },
});

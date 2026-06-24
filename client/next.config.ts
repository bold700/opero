import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// De GitHub Pages build draait met BUILD_TARGET=pages (zie de workflow). Lokaal
// dev/build blijft ongewijzigd: geen basePath, geen statische export.
const isPages = process.env.BUILD_TARGET === "pages";

// Monorepo: deps worden gehoist naar de workspace-root (één map boven client/),
// en @opero/shared is een workspace-symlink. Turbopack moet daarom de
// workspace-root als filesystem-root nemen, anders vindt het next/de gelinkte
// packages niet. Zie node_modules/next/dist/docs/.../08-turbopack.md (Filesystem Root).
const workspaceRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const nextConfig: NextConfig = {
  turbopack: {
    root: workspaceRoot,
  },
  ...(isPages
    ? {
        output: "export",
        basePath: "/opero",
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;

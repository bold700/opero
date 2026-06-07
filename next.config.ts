import type { NextConfig } from "next";

// De GitHub Pages build draait met BUILD_TARGET=pages (zie de workflow). Lokaal
// dev/build blijft ongewijzigd: geen basePath, geen statische export.
const isPages = process.env.BUILD_TARGET === "pages";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
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

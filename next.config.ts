import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // E2E runs set NEXT_DIST_DIR so their dev server (own build dir + lockfile)
  // can boot alongside the normal one on another port.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  // Pin the workspace root so a stray lockfile in a parent dir is ignored.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;

import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root so a stray lockfile in a parent dir is ignored.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;

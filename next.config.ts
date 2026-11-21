import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Minimal production image via `next start` / Docker (no full node_modules copy).
  output: "standalone",
};

export default nextConfig;

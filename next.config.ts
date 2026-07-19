import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits a minimal self-contained server bundle — keeps the Docker image small.
  output: "standalone",
};

export default nextConfig;

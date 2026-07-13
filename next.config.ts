import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // transformers.js loads native ONNX binaries at runtime — leave it out of the
  // server bundle so Next doesn't try to trace/bundle those .node files.
  serverExternalPackages: ["@xenova/transformers"],
};

export default nextConfig;

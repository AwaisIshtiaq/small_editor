import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // pdfjs-dist ships a worker + node build that must stay outside the bundler
  serverExternalPackages: ["pdfjs-dist"],
};

export default nextConfig;

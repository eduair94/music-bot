import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // Output to 'out' folder (default)
  distDir: 'out',
};

export default nextConfig;

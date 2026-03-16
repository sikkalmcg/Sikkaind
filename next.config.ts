import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  output: 'standalone', 
};

export default nextConfig;
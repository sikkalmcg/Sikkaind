import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build errors ignore karne ka sahi tarika
  typescript: {
    ignoreBuildErrors: true,
  },
  output: 'standalone',
  images: {
    unoptimized: true,
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  // Firebase App Hosting ke liye standalone compulsory hai
};

export default nextConfig;
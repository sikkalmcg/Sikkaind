import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // eslint block ko is tarah likhein
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  transpilePackages: ['firebase', '@firebase/auth', '@firebase/app'],
};

export default nextConfig;
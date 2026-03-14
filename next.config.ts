import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build errors ignore karne ke liye (Aapne sahi likha hai)
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Images config
  images: {
    unoptimized: true,
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  // Firebase compatibility ke liye
  transpilePackages: ['firebase', '@firebase/auth', '@firebase/app'],
  
  // YE LINE ZAROORI HAI FIREBASE APP HOSTING KE LIYE
  output: 'standalone', 
};

export default nextConfig;
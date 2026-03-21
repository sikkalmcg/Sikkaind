/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  output: 'standalone',
  transpilePackages: ['undici', '@firebase/auth', 'firebase'],
  webpack: (config, { isServer }) => {
    // Add the mini-css-extract-plugin
    if (!isServer) {
      config.plugins.push(new (require('mini-css-extract-plugin'))());
    }
    return config;
  },
};

module.exports = nextConfig;

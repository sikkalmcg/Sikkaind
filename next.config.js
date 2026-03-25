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
  allowedDevOrigins: ['3000-firebase-sikkaind-new-1773476678963.cluster-osvg2nzmmzhzqqjio6oojllbg4.cloudworkstations.dev'],
};

module.exports = nextConfig;

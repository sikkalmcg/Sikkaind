"use strict";

// next.config.js
var nextConfig = {
  typescript: {
    ignoreBuildErrors: true
  },
  images: {
    unoptimized: true,
    remotePatterns: [{ protocol: "https", hostname: "**" }]
  },
  output: "standalone",
  transpilePackages: ["undici", "@firebase/auth", "firebase"],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.plugins.push(new (require("mini-css-extract-plugin"))());
    }
    return config;
  }
};
module.exports = nextConfig;

// next.config.mjs
var nextConfig = {
  devIndicators: {
    allowedDevOrigins: [
      "https://3001-firebase-sikkaind-new-1773476678963.cluster-osvg2nzmmzhzqqjio6oojllbg4.cloudworkstations.dev"
    ]
  },
  typescript: {
    ignoreBuildErrors: true
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "picsum.photos" }
    ]
  },
  output: "standalone"
};
var next_config_default = nextConfig;
export {
  next_config_default as default
};

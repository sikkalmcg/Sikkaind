/** @type {import('next').NextConfig} */
const nextConfig = {
    devIndicators: {
        allowedDevOrigins: [
            'https://3001-firebase-sikkaind-new-1773476678963.cluster-osvg2nzmmzhzqqjio6oojllbg4.cloudworkstations.dev'
        ],
    },
    images: {
        unoptimized: true,
        remotePatterns: [
            { protocol: 'https', hostname: '**' },
            { protocol: 'https', hostname: 'placehold.co' },
            { protocol: 'https', hostname: 'images.unsplash.com' },
            { protocol: 'https', hostname: 'picsum.photos' },
        ],
    },
    output: 'standalone',
};

export default nextConfig;

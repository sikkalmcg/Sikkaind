/** @type {import('next').NextConfig} */
const nextConfig = {
    devIndicators: {
        allowedDevOrigins: [
            'https://3000-firebase-sikkaind-new-1773476678963.cluster-osvg2nzmmzhzqqjio6oojllbg4.cloudworkstations.dev',
            'https://3001-firebase-sikkaind-new-1773476678963.cluster-osvg2nzmmzhzqqjio6oojllbg4.cloudworkstations.dev',
            'https://3002-firebase-sikkaind-new-1773476678963.cluster-osvg2nzmmzhzqqjio6oojllbg4.cloudworkstations.dev',
            'https://3003-firebase-sikkaind-new-1773476678963.cluster-osvg2nzmmzhzqqjio6oojllbg4.cloudworkstations.dev',
            'https://3004-firebase-sikkaind-new-1773476678963.cluster-osvg2nzmmzhzqqjio6oojllbg4.cloudworkstations.dev',
            'https-3005-firebase-sikkaind-new-1773476678963.cluster-osvg2nzmmzhzqqjio6oojllbg4.cloudworkstations.dev',
        ],
    },
    turbopack: {},
};

export default nextConfig;
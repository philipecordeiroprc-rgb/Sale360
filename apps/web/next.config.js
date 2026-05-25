/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@sale360/core'],
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  async rewrites() {
    return [
      {
        source: '/:slug((?!_next|api|favicon|templates|c$)[^/]+)',
        destination: '/c/:slug',
      },
    ];
  },
};

module.exports = nextConfig;

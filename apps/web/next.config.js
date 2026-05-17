/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@sale360/core'],
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

module.exports = nextConfig;

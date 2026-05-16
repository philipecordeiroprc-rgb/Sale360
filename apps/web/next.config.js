/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@sale360/core'],
  experimental: {
    serverActions: true,
  },
};

module.exports = nextConfig;

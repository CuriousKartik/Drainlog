/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@deck.gl/react', '@deck.gl/layers', '@deck.gl/core'],
};

module.exports = nextConfig;


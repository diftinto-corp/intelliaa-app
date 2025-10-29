/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize pdf-parse to avoid ESM import issues with Next.js 15
      config.externals = config.externals || [];
      config.externals.push('pdf-parse');
    }
    return config;
  },
};

module.exports = nextConfig;

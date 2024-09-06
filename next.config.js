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
  // Deshabilitar la generación estática para la ruta /auth/confirm
  experimental: {
    workerThreads: false,
    cpus: 1
  },
};

module.exports = nextConfig;

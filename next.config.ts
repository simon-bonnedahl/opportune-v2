import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.teamtailor-cdn.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;

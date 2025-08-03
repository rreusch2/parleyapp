/** @type {import('next').NextConfig} */
const nextConfig = {
  // PWA Configuration - Facebook-free
  experimental: {
    appDir: true,
  },
  
  // Performance optimizations
  swcMinify: true,
  
  // PWA settings
  async headers() {
    return [
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/manifest+json',
          },
        ],
      },
    ];
  },
  
  // Security headers (no Facebook tracking)
  async redirects() {
    return [
      // Block any Facebook tracking attempts
      {
        source: '/facebook/:path*',
        destination: '/blocked',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
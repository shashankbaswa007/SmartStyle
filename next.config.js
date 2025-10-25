/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Increase Server Actions body size limit so image uploads up to 20MB are accepted
    serverActions: {
      // Next expects a numeric byte limit; set to 20 * 1024 * 1024
      bodySizeLimit: 20 * 1024 * 1024,
    },
  },
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.pexels.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.pexels.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'image.pollinations.ai',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.freepik.com',
        port: '',
        pathname: '/**',
      }
    ],
  },
  webpack: (config) => {
    config.externals.push({
        'require-in-the-middle': 'require-in-the-middle',
    });
    return config;
  }
};

module.exports = nextConfig;

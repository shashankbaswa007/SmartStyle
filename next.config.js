/** @type {import('next').NextConfig} */

// Manually load environment variables from .env files
// This ensures they're available during the build process
const fs = require('fs');
const path = require('path');

function loadEnvFile(filePath) {
  try {
    const envFile = fs.readFileSync(filePath, 'utf8');
    envFile.split('\n').forEach(line => {
      const match = line.match(/^([^#][^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, ''); // Remove quotes
        if (key.startsWith('NEXT_PUBLIC_') && !process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  } catch (err) {
    // File doesn't exist, skip
  }
}

// Load .env files in order of priority
loadEnvFile(path.join(__dirname, '.env'));
loadEnvFile(path.join(__dirname, '.env.local'));

const nextConfig = {
  env: {
    // Explicitly pass Firebase config to ensure it's in the client bundle
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  },
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
        hostname: 'via.placeholder.com',
        port: '',
        pathname: '/**',
      },
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
    // Disable optimization for external images to prevent 500 errors
    unoptimized: false,
    // OPTIMIZED: Enable Next.js image optimization with better error handling
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    // Add dangerouslyAllowSVG for better compatibility
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // OPTIMIZED: Webpack optimizations
  webpack: (config, { dev, isServer }) => {
    config.externals.push({
        'require-in-the-middle': 'require-in-the-middle',
    });
    
    // Let Next.js handle chunk splitting automatically
    // Custom chunk splitting was causing 404s in dev mode
    
    return config;
  },
  // OPTIMIZED: Reduce bundle size
  swcMinify: true,
  compress: true,
  poweredByHeader: false,
  
  // PWA Configuration
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/icons/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

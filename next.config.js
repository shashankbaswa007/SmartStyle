/** @type {import('next').NextConfig} */

const nextConfig = {
  experimental: {
    // Increase Server Actions body size limit so image uploads up to 20MB are accepted
    serverActions: {
      // Next expects a numeric byte limit; set to 20 * 1024 * 1024
      bodySizeLimit: 20 * 1024 * 1024,
    },
    // OPTIMIZED: Tree-shake heavy packages for faster page loads
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      'firebase/auth',
      'firebase/firestore',
      'firebase/storage',
      '@radix-ui/react-tabs',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tooltip',
    ],
  },
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
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
        hostname: 'gen.pollinations.ai',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'replicate.delivery',
        port: '',
        pathname: '/**',
      },

    ],
    // Disable optimization for external images to prevent 500 errors
    unoptimized: false,
    // OPTIMIZED: Enable Next.js image optimization with better error handling
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: false,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // OPTIMIZED: Webpack optimizations
  webpack: (config, { dev, isServer }) => {
    // Only add Node-only modules to externals for server builds
    if (isServer) {
      config.externals.push({
        'require-in-the-middle': 'require-in-the-middle',
        // ogl is a WebGL-only library — never bundle for server
        'ogl': 'ogl',
      });
    }

    // Fix: vendor-chunk resolution failures for get-nonce and clsx
    // Next.js dev server sometimes fails to create vendor-chunks/*.js for
    // small CJS packages, causing ENOENT + 500 cascades on all static chunks.
    // Pinning the resolved path in resolve.alias ensures the module is found
    // in both client and server builds regardless of vendor-chunk state.
    try {
      config.resolve = config.resolve || {};
      config.resolve.alias = config.resolve.alias || {};
      config.resolve.alias['get-nonce'] = require.resolve('get-nonce');
      config.resolve.alias['clsx'] = require.resolve('clsx');
    } catch (_) {
      // packages not installed — skip
    }
    
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

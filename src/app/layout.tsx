import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { Inter, Playfair_Display, Sora } from 'next/font/google';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { Header } from '@/components/Header';
import { InstallPWA } from '@/components/InstallPWA';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { ErrorBoundary } from '@/components/error-boundary';
import { LoadingScreen } from '@/components/LoadingScreen';
import { MotionProvider } from '@/components/MotionProvider';
import { BRAND, withBrandAssetVersion } from '@/lib/branding';
import Script from 'next/script';

const useGoogleFonts = process.env.DISABLE_NEXT_GOOGLE_FONTS !== '1';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair-display',
});

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  weight: ['500', '600'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://smartstyle.app'),
  title: `${BRAND.name} | AI Style Studio`,
  description: 'Instant style feedback, color intelligence, and wardrobe-driven outfit recommendations with a premium first-run experience.',
  keywords: ['fashion', 'style', 'AI', 'color analysis', 'outfit recommendations', 'wardrobe', 'personal stylist'],
  authors: [{ name: 'SmartStyle Team' }],
  manifest: withBrandAssetVersion('/manifest.json'),
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SmartStyle',
  },
  icons: {
    icon: [
      { url: withBrandAssetVersion('/favicon-16x16.png'), type: 'image/png', sizes: '16x16' },
      { url: withBrandAssetVersion('/favicon-32x32.png'), type: 'image/png', sizes: '32x32' },
      { url: withBrandAssetVersion('/favicon-48x48.png'), type: 'image/png', sizes: '48x48' },
      { url: withBrandAssetVersion('/icons/brand-icon.svg'), type: 'image/svg+xml', sizes: 'any' },
      { url: withBrandAssetVersion('/icons/icon-192x192.png'), type: 'image/png', sizes: '192x192' },
      { url: withBrandAssetVersion('/icons/icon-512x512.png'), type: 'image/png', sizes: '512x512' },
    ],
    apple: [
      { url: withBrandAssetVersion('/icons/icon-192x192.png'), sizes: '192x192', type: 'image/png' },
    ],
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://smartstyle.app',
    title: `${BRAND.name} | AI Style Studio`,
    description: 'Instant style feedback and wardrobe-aware recommendations',
    siteName: 'SmartStyle',
    images: [
      {
        url: withBrandAssetVersion('/icons/icon-512x512.png'),
        width: 512,
        height: 512,
        alt: 'SmartStyle Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${BRAND.name} | AI Style Studio`,
    description: 'Instant style feedback and wardrobe-aware recommendations',
    images: [withBrandAssetVersion('/icons/icon-512x512.png')],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: BRAND.themeColor,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const fontVariables = useGoogleFonts
    ? `${inter.variable} ${playfairDisplay.variable} ${sora.variable}`
    : '';

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <meta name="application-name" content="SmartStyle" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="SmartStyle" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${fontVariables} font-body antialiased bg-background`}>
        <ErrorBoundary>
          <MotionProvider>
            <AuthProvider>
              <ServiceWorkerRegister />
              <LoadingScreen />
              <Header />
              <main className="pt-16 sm:pt-20 page-enter-animation">
                {children}
              </main>
              <Toaster />
              <InstallPWA />
            </AuthProvider>
          </MotionProvider>
        </ErrorBoundary>
        
        {/* Recover from stale-deployment chunk 404s before React hydrates */}
        <Script
          id="chunk-error-handler"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                var reloaded = sessionStorage.getItem('chunk-reload');
                window.addEventListener('error', function(e){
                  if(
                    e.message && (
                      e.message.indexOf('Loading chunk') !== -1 ||
                      e.message.indexOf('ChunkLoadError') !== -1 ||
                      e.message.indexOf('Failed to fetch dynamically imported module') !== -1
                    )
                  ){
                    if(!reloaded || Date.now() - Number(reloaded) > 15000){
                      sessionStorage.setItem('chunk-reload', Date.now().toString());
                      window.location.reload();
                    }
                  }
                });
              })();
            `,
          }}
        />

        {/* Web Vitals Tracking */}
        <Script
          id="web-vitals"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('PerformanceObserver' in window) {
                try {
                  const po = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                      if (entry.entryType === 'largest-contentful-paint') {
                      }
                    }
                  });
                  po.observe({ type: 'largest-contentful-paint', buffered: true });
                } catch (e) {
                }
              }
            `,
          }}
        />
      </body>
    </html>
  );
}

import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { Inter, Playfair_Display } from 'next/font/google';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { Header } from '@/components/Header';
import { InstallPWA } from '@/components/InstallPWA';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { ErrorBoundary } from '@/components/error-boundary';
import { LoadingScreen } from '@/components/LoadingScreen';
import { MotionProvider } from '@/components/MotionProvider';
import { BRAND } from '@/lib/branding';
import Script from 'next/script';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair-display',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://smartstyle.app'),
  title: `${BRAND.name} | AI Style Studio`,
  description: 'Instant style feedback, color intelligence, and wardrobe-driven outfit recommendations with a premium first-run experience.',
  keywords: ['fashion', 'style', 'AI', 'color analysis', 'outfit recommendations', 'wardrobe', 'personal stylist'],
  authors: [{ name: 'SmartStyle Team' }],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SmartStyle',
  },
  icons: {
    icon: [
      { url: '/icon', type: 'image/png', sizes: '32x32' },
    ],
    apple: [
      { url: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
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
        url: '/icons/icon-512x512.png',
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
    images: ['/icons/icon-512x512.png'],
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
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <meta name="application-name" content="SmartStyle" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="SmartStyle" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192x192.png" />
      </head>
      <body className={`${inter.variable} ${playfairDisplay.variable} font-body antialiased bg-background`}>
        <ErrorBoundary>
          <MotionProvider>
            <AuthProvider>
              <ServiceWorkerRegister />
              <LoadingScreen />
              <Header />
              <main className="pt-20 page-enter-animation">
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

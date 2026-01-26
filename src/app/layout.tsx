import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { Inter, Playfair_Display } from 'next/font/google';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { Header } from '@/components/Header';
import { InstallPWA } from '@/components/InstallPWA';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { ErrorBoundary } from '@/components/error-boundary';
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
  title: 'SmartStyle - AI Fashion Advisor',
  description: 'Get AI-powered style feedback, color analysis, and personalized outfit recommendations. Analyze your wardrobe, discover perfect color matches, and elevate your style with smart fashion insights.',
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
    title: 'SmartStyle - AI Fashion Advisor',
    description: 'Get AI-powered style feedback and personalized outfit recommendations',
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
    title: 'SmartStyle - AI Fashion Advisor',
    description: 'Get AI-powered style feedback and personalized outfit recommendations',
    images: ['/icons/icon-512x512.png'],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#7B68EE',
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
          <AuthProvider>
            <ServiceWorkerRegister />
            <Header />
            <main className="pt-16 page-enter-animation">
              {children}
            </main>
            <Toaster />
            <InstallPWA />
          </AuthProvider>
        </ErrorBoundary>
        
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
                        console.log('LCP:', Math.round(entry.startTime) + 'ms');
                      }
                    }
                  });
                  po.observe({ type: 'largest-contentful-paint', buffered: true });
                } catch (e) {
                  console.warn('⚠️ Web Vitals reporting failed:', e);
                }
              }
            `,
          }}
        />
      </body>
    </html>
  );
}

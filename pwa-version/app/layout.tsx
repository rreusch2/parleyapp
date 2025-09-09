import type { Metadata } from 'next';
import './globals.css';
import FacebookPixelComponent from '@/components/FacebookPixel';
import { getPixelId } from '@/lib/analytics';

export const metadata: Metadata = {
  title: 'PredictivePlay - AI Sports Predictions',
  description: 'Get AI-powered sports betting predictions and insights',
  manifest: '/manifest.json',
  themeColor: '#0f172a',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
  icons: {
    icon: '/icon-192x192.png',
    apple: '/icon-192x192.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pixelId = getPixelId();

  return (
    <html lang="en">
      <head>
        {/* Facebook Pixel */}
        <FacebookPixelComponent pixelId={pixelId} />
        
        {/* PWA Meta Tags */}
        <meta name="application-name" content="PredictivePlay" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="PredictivePlay" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#0f172a" />
        
        {/* Preconnect to Facebook domains for faster pixel loading */}
        <link rel="preconnect" href="https://connect.facebook.net" />
        <link rel="dns-prefetch" href="https://connect.facebook.net" />
      </head>
      <body className="bg-slate-900 text-white antialiased">
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { SubscriptionProvider } from '@/contexts/SubscriptionContext'
import LayoutWrapper from '@/components/LayoutWrapper'
import { Toaster } from 'react-hot-toast'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Predictive Play - AI-Powered Sports Betting Predictions',
  description: 'Smart betting with AI-powered predictions, advanced analytics, and expert insights for all major sports.',
  keywords: 'sports betting, AI predictions, betting analytics, sports analysis, betting tips',
  authors: [{ name: 'Predictive Play' }],
  creator: 'Predictive Play',
  publisher: 'Predictive Play',
  metadataBase: new URL('https://www.predictive-play.com'),
  openGraph: {
    title: 'Predictive Play - AI-Powered Sports Betting Predictions',
    description: 'Smart betting with AI-powered predictions and advanced analytics',
    url: 'https://www.predictive-play.com',
    siteName: 'Predictive Play',
    images: [
      {
        url: '/logo.png',
        width: 800,
        height: 600,
        alt: 'Predictive Play Logo',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Predictive Play - AI-Powered Sports Betting Predictions',
    description: 'Smart betting with AI-powered predictions and advanced analytics',
    images: ['/logo.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full bg-gray-50 dark:bg-gray-900`}>
        <AuthProvider>
          <SubscriptionProvider>
            <div className="min-h-full">
              <LayoutWrapper>
                {children}
              </LayoutWrapper>
            </div>
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#363636',
                  color: '#fff',
                },
                success: {
                  duration: 3000,
                  style: {
                    background: '#10B981',
                    color: '#ffffff',
                  },
                },
                error: {
                  duration: 5000,
                  style: {
                    background: '#EF4444',
                    color: '#ffffff',
                  },
                },
              }}
            />
          </SubscriptionProvider>
        </AuthProvider>
      </body>
    </html>
  )
}

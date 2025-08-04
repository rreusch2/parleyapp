/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  },
  // Use default output for Railway (not static export)
  // output: 'export', // Commented out for Railway deployment with API routes
  trailingSlash: false, // Set to false for API routes to work properly
  images: {
    unoptimized: true
  },
  // Remove basePath and assetPrefix for Railway deployment
  // basePath: process.env.NODE_ENV === 'production' ? '' : '',
  // assetPrefix: process.env.NODE_ENV === 'production' ? '' : '',
  
  // API route configuration for Stripe webhooks
  async rewrites() {
    return [
      {
        source: '/api/stripe/webhook',
        destination: '/api/stripe/webhook',
      },
    ]
  },
}

module.exports = nextConfig

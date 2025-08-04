// Environment validation script for Stripe integration
const requiredEnvVars = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY'
]

const missingVars = requiredEnvVars.filter(varName => !process.env[varName])

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:')
  missingVars.forEach(varName => {
    console.error(`   - ${varName}`)
  })
  console.error('\nPlease add these to your .env.local file and Railway environment variables.')
  process.exit(1)
} else {
  console.log('✅ All required environment variables are present')
}

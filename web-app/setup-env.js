// Script to load environment variables
const fs = require('fs');
const path = require('path');

const envContent = `# Supabase credentials
NEXT_PUBLIC_SUPABASE_URL=https://iriaegoipkjtktitpary.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyaWFlZ29pcGtqdGt0aXRwYXJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTMwNjgwNTYsImV4cCI6MjAwODY0NDA1Nn0.UGM0_FrDqmoWi0mlwS-BbFXXW_gQWGpFnnwvb3jNkrI

# API URLs
NEXT_PUBLIC_BACKEND_URL=https://zooming-rebirth-production-a305.up.railway.app
NEXT_PUBLIC_PYTHON_API_URL=https://zooming-rebirth-production-a305.up.railway.app

# RevenueCat API Key (Server-side only)
REVENUECAT_API_KEY=your_revenuecat_api_key_here
`;

try {
  fs.writeFileSync(path.join(__dirname, '.env.local'), envContent);
  console.log('Environment file created successfully!');
} catch (error) {
  console.error('Error creating environment file:', error);
}
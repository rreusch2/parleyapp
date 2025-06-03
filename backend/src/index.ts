import { config } from 'dotenv';
import app from './app';

// Load environment variables
config();

const port = process.env.PORT || 3000;

// Log environment variables (excluding sensitive data)
console.log('Environment variables:', {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'exists' : 'missing',
  ENV_PATH: process.env.ENV_PATH
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 
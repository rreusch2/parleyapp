const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Get Supabase credentials from .env file
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing Supabase credentials in .env file');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Email and password for login
const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error('Usage: node get-auth-token.js <email> <password>');
  process.exit(1);
}

async function getAuthToken() {
  try {
    // Sign in with email and password
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('Error signing in:', error.message);
      process.exit(1);
    }

    // Output the access token
    console.log('\n=== AUTHENTICATION TOKEN ===');
    console.log('Copy this token and use it in Postman as a Bearer token:');
    console.log(data.session.access_token);
    console.log('\nIn Postman, add this header:');
    console.log('Authorization: Bearer ' + data.session.access_token);
  } catch (error) {
    console.error('Unexpected error:', error);
    process.exit(1);
  }
}

getAuthToken(); 
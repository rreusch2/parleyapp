const axios = require('axios');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Ask for the token
rl.question('Paste your Supabase access token: ', async (token) => {
  if (!token) {
    console.error('No token provided');
    rl.close();
    return;
  }

  try {
    // First test the auth-test endpoint
    console.log('\nTesting auth-test endpoint...');
    const authTestResponse = await axios.get('http://localhost:3000/api/auth-test', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    console.log('Auth test response:', authTestResponse.data);
    
    // If auth test passes, try the admin endpoint
    console.log('\nTesting sports-data-admin/update endpoint...');
    const adminResponse = await axios.post('http://localhost:3000/api/sports-data-admin/update', {}, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    console.log('Admin endpoint response:', adminResponse.data);
  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
  }
  
  rl.close();
}); 
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ENV_FILE_PATH = path.join(__dirname, '.env');

// Check if .env file exists
const createEnvFile = () => {
  const envExample = `# Server configuration
PORT=3000

# Supabase configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# API-Sports configuration
API_SPORTS_KEY=your_api_sports_key
`;

  fs.writeFileSync(ENV_FILE_PATH, envExample);
  console.log(`Created new .env file at ${ENV_FILE_PATH}`);
};

const updateEnvFile = (apiKey) => {
  try {
    // Read existing .env file
    let envContent = '';
    
    if (fs.existsSync(ENV_FILE_PATH)) {
      envContent = fs.readFileSync(ENV_FILE_PATH, 'utf8');
    } else {
      createEnvFile();
      envContent = fs.readFileSync(ENV_FILE_PATH, 'utf8');
    }

    // Check if API_SPORTS_KEY already exists
    if (envContent.includes('API_SPORTS_KEY=')) {
      // Replace existing key
      envContent = envContent.replace(/API_SPORTS_KEY=.*$/m, `API_SPORTS_KEY=${apiKey}`);
    } else {
      // Add key if not found
      envContent += `\n# API-Sports configuration\nAPI_SPORTS_KEY=${apiKey}\n`;
    }

    // Write updated content back to .env file
    fs.writeFileSync(ENV_FILE_PATH, envContent);
    console.log(`\nAPI key has been successfully saved to ${ENV_FILE_PATH}`);
    console.log('\nYou can now run your backend server to start fetching sports data!');
  } catch (error) {
    console.error('Error updating .env file:', error);
  }
};

console.log('===== API-Sports Key Setup =====');
console.log('This script will add your API-Sports key to the .env file.');
console.log('You can find your API key at: https://dashboard.api-football.com/profile?access');
console.log('');

rl.question('Please enter your API-Sports key: ', (apiKey) => {
  if (!apiKey) {
    console.log('No API key provided. Exiting without making changes.');
    rl.close();
    return;
  }

  updateEnvFile(apiKey);
  rl.close();
});

rl.on('close', () => {
  process.exit(0);
}); 
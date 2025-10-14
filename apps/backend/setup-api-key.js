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

console.log('📝 SportRadar API Key Setup');
console.log('--------------------------');
console.log('This script will help you set up your SportRadar API key.');
console.log('You need to enter your complete API key, not just the prefix.\n');

// Check if .env file exists
const envExists = fs.existsSync(ENV_FILE_PATH);

if (envExists) {
  console.log('ℹ️ An .env file already exists. We will update it.\n');
} else {
  console.log('ℹ️ No .env file found. We will create one for you.\n');
}

// Get existing environment variables if the file exists
let existingEnv = {};
if (envExists) {
  const envContent = fs.readFileSync(ENV_FILE_PATH, 'utf8');
  envContent.split('\n').forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
      const [key, value] = line.split('=');
      if (key && value) {
        existingEnv[key.trim()] = value.trim();
      }
    }
  });
}

rl.question('Enter your complete SportRadar API key: ', (apiKey) => {
  if (!apiKey) {
    console.log('❌ API key cannot be empty. Exiting...');
    rl.close();
    return;
  }

  // Update or add API key to environment variables
  existingEnv.SPORTRADAR_API_KEY = apiKey;

  // Build .env file content
  let envContent = '';
  Object.entries(existingEnv).forEach(([key, value]) => {
    envContent += `${key}=${value}\n`;
  });

  // Write to .env file
  fs.writeFileSync(ENV_FILE_PATH, envContent);

  console.log('\n✅ API key has been successfully saved to .env file.');
  console.log('\n🚀 You can now run your application with the SportRadar API key.');
  console.log('\n📋 Test the API connection with:');
  console.log('   npx ts-node src/scripts/testSportRadar.ts');

  rl.close();
});

rl.on('close', () => {
  process.exit(0);
}); 
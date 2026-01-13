#!/usr/bin/env node

/**
 * OpenAI API Key Diagnostic Script
 * 
 * This script helps diagnose OpenAI API key configuration issues.
 * Run it with: node check-openai-key.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 OpenAI API Key Diagnostic Tool\n');
console.log('=' .repeat(50));

// Check for .env.local file
const envLocalPath = path.join(process.cwd(), '.env.local');
const envPath = path.join(process.cwd(), '.env');

let envFile = null;
let envContent = '';

// Try to read .env.local first
if (fs.existsSync(envLocalPath)) {
  try {
    envContent = fs.readFileSync(envLocalPath, 'utf8');
    envFile = '.env.local';
    console.log('✅ Found .env.local file');
  } catch (error) {
    console.log('⚠️  .env.local exists but could not be read:', error.message);
  }
} else if (fs.existsSync(envPath)) {
  try {
    envContent = fs.readFileSync(envPath, 'utf8');
    envFile = '.env';
    console.log('✅ Found .env file');
  } catch (error) {
    console.log('⚠️  .env exists but could not be read:', error.message);
  }
} else {
  console.log('❌ No .env.local or .env file found');
  console.log('\n📝 To fix this:');
  console.log('   1. Create a .env.local file in the project root');
  console.log('   2. Add: OPENAI_API_KEY=sk-your-key-here');
  console.log('   3. Restart the development server');
  process.exit(1);
}

// Check for OPENAI_API_KEY
const hasOpenAIKey = envContent.includes('OPENAI_API_KEY');
const keyMatch = envContent.match(/OPENAI_API_KEY\s*=\s*(.+)/);

if (!hasOpenAIKey || !keyMatch) {
  console.log('❌ OPENAI_API_KEY not found in', envFile);
  console.log('\n📝 To fix this:');
  console.log('   1. Open', envFile);
  console.log('   2. Add: OPENAI_API_KEY=sk-your-openai-api-key-here');
  console.log('   3. Get your key from: https://platform.openai.com/api-keys');
  console.log('   4. Restart the development server');
  process.exit(1);
}

const keyValue = keyMatch[1].trim();

// Remove quotes if present
const cleanedKey = keyValue.replace(/^["']|["']$/g, '');

if (!cleanedKey || cleanedKey === 'your_openai_api_key_here' || cleanedKey.includes('your-')) {
  console.log('❌ OPENAI_API_KEY is set but appears to be a placeholder');
  console.log('   Current value:', cleanedKey.substring(0, 10) + '...');
  console.log('\n📝 To fix this:');
  console.log('   1. Get your OpenAI API key from: https://platform.openai.com/api-keys');
  console.log('   2. Replace the placeholder in', envFile);
  console.log('   3. Restart the development server');
  process.exit(1);
}

// Validate key format
if (!cleanedKey.startsWith('sk-')) {
  console.log('⚠️  Warning: OPENAI_API_KEY does not start with "sk-"');
  console.log('   This might not be a valid OpenAI API key format');
  console.log('   Key starts with:', cleanedKey.substring(0, 5));
} else {
  console.log('✅ OPENAI_API_KEY is set and has correct format');
  console.log('   Key starts with: sk-...');
  console.log('   Key length:', cleanedKey.length, 'characters');
}

// Check key length (OpenAI keys are typically 51+ characters)
if (cleanedKey.length < 20) {
  console.log('⚠️  Warning: Key seems too short (OpenAI keys are typically 51+ characters)');
}

console.log('\n✅ Configuration looks good!');
console.log('\n📋 Next steps:');
console.log('   1. Make sure the development server is restarted');
console.log('   2. Try generating a story structure');
console.log('   3. If you still see errors, check:');
console.log('      - Your OpenAI account has credits/quota');
console.log('      - The API key has the correct permissions');
console.log('      - Server logs for detailed error messages');

// Test the key if requested
if (process.argv.includes('--test')) {
  console.log('\n🧪 Testing API key...');
  const OpenAI = require('openai');
  
  const openai = new OpenAI({
    apiKey: cleanedKey,
  });
  
  openai.models.list()
    .then(() => {
      console.log('✅ API key is valid and working!');
    })
    .catch((error) => {
      console.log('❌ API key test failed:');
      if (error.status === 401) {
        console.log('   Authentication failed - the API key is invalid');
      } else if (error.status === 429) {
        console.log('   Rate limit exceeded - wait a moment and try again');
      } else {
        console.log('   Error:', error.message);
      }
    });
}

console.log('\n' + '='.repeat(50));



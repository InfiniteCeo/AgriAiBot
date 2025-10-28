#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Gemini API Setup Helper\n');

console.log('To get your Gemini API working:');
console.log('1. Go to: https://makersuite.google.com/app/apikey');
console.log('2. Sign in with your Google account');
console.log('3. Click "Create API Key"');
console.log('4. Copy the API key');
console.log('5. Run: node setup-gemini.js YOUR_API_KEY_HERE\n');

const apiKey = process.argv[2];

if (!apiKey) {
    console.log('❌ No API key provided');
    console.log('Usage: node setup-gemini.js YOUR_API_KEY_HERE');
    process.exit(1);
}

// Update .env file
const envPath = path.join(__dirname, '.env');
let envContent = fs.readFileSync(envPath, 'utf8');

// Replace the GEMINI_API_KEY line
envContent = envContent.replace(/GEMINI_API_KEY=.*/, `GEMINI_API_KEY=${apiKey}`);

fs.writeFileSync(envPath, envContent);

console.log('✅ API key updated in .env file');

// Test the API key
console.log('🧪 Testing API key...');

const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(apiKey);

async function testAPI() {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Hello, this is a test message");
        const response = await result.response;
        const text = response.text();
        
        console.log('✅ Gemini API is working!');
        console.log('Test response:', text.substring(0, 100) + '...');
        console.log('\n🎉 Setup complete! You can now start your application with: npm start');
        
    } catch (error) {
        console.log('❌ API key test failed:', error.message);
        console.log('Please check your API key and try again.');
    }
}

testAPI();
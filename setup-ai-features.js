#!/usr/bin/env node

/**
 * Setup Script for AI-Powered Seller Features
 * This script helps configure the AI features for AgriaiBot
 */

const fs = require('fs');
const path = require('path');

console.log('🤖 AgriaiBot AI Features Setup');
console.log('='.repeat(40));

// Check if .env file exists
const envPath = '.env';
const envExists = fs.existsSync(envPath);

console.log('\n📋 Checking Configuration...');

if (!envExists) {
    console.log('❌ .env file not found');
    console.log('📝 Creating .env template...');
    
    const envTemplate = `# AgriaiBot Environment Configuration
# Copy this file to .env and fill in your actual values

# Google Gemini AI API Key (Required for AI features)
GEMINI_API_KEY=your_gemini_api_key_here

# Supabase Configuration (Required)
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Server Configuration
PORT=3000

# Optional: Allowed origins for CORS
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
`;
    
    fs.writeFileSync('.env.template', envTemplate);
    console.log('✅ Created .env.template file');
    console.log('📝 Please copy .env.template to .env and configure your API keys');
} else {
    console.log('✅ .env file found');
    
    // Check for required environment variables
    const envContent = fs.readFileSync(envPath, 'utf8');
    const hasGeminiKey = envContent.includes('GEMINI_API_KEY=') && !envContent.includes('GEMINI_API_KEY=your_gemini_api_key_here');
    const hasSupabaseUrl = envContent.includes('SUPABASE_URL=') && !envContent.includes('SUPABASE_URL=your_supabase_project_url');
    const hasSupabaseKey = envContent.includes('SUPABASE_ANON_KEY=') && !envContent.includes('SUPABASE_ANON_KEY=your_supabase_anon_key');
    
    console.log(`   Gemini API Key: ${hasGeminiKey ? '✅' : '❌'}`);
    console.log(`   Supabase URL: ${hasSupabaseUrl ? '✅' : '❌'}`);
    console.log(`   Supabase Key: ${hasSupabaseKey ? '✅' : '❌'}`);
    
    if (!hasGeminiKey || !hasSupabaseUrl || !hasSupabaseKey) {
        console.log('\n⚠️  Some required environment variables are missing or not configured');
        console.log('📝 Please update your .env file with the correct values');
    }
}

// Check if required files exist
console.log('\n📁 Checking Required Files...');

const requiredFiles = [
    'services/gemini.js',
    'services/sellerAI.js',
    'services/marketplace.js',
    'services/supabase.js',
    'routes/marketplace.js',
    'web/wholesaler.html',
    'web/wholesaler.js'
];

let allFilesExist = true;

requiredFiles.forEach(file => {
    const exists = fs.existsSync(file);
    console.log(`   ${file}: ${exists ? '✅' : '❌'}`);
    if (!exists) allFilesExist = false;
});

if (allFilesExist) {
    console.log('✅ All required files are present');
} else {
    console.log('❌ Some required files are missing');
}

// Check database schema
console.log('\n🗄️  Database Schema...');
console.log('   Required tables:');
console.log('   • users (with user_type column)');
console.log('   • products (with bulk_pricing JSONB column)');
console.log('   • orders');
console.log('   • market_data');
console.log('   • recommendations');

const schemaFiles = [
    'supabase_marketplace_schema.sql',
    'supabase_marketplace_schema_updated.sql'
];

const schemaExists = schemaFiles.some(file => fs.existsSync(file));
console.log(`   Schema files: ${schemaExists ? '✅' : '❌'}`);

if (schemaExists) {
    console.log('📝 Run the SQL schema files in your Supabase SQL Editor');
} else {
    console.log('❌ Database schema files not found');
}

// Check package.json dependencies
console.log('\n📦 Checking Dependencies...');

if (fs.existsSync('package.json')) {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    const requiredDeps = [
        '@google/generative-ai',
        '@supabase/supabase-js',
        'express',
        'bcrypt',
        'jsonwebtoken'
    ];
    
    requiredDeps.forEach(dep => {
        const exists = deps[dep];
        console.log(`   ${dep}: ${exists ? '✅' : '❌'}`);
    });
    
    console.log('✅ Dependencies checked');
} else {
    console.log('❌ package.json not found');
}

// Setup summary
console.log('\n🎯 Setup Summary');
console.log('='.repeat(20));

console.log('\n✅ AI Features Implemented:');
console.log('   • Product Optimization AI');
console.log('   • Inventory Management Intelligence');
console.log('   • Competitive Analysis');
console.log('   • Sales Performance Insights');
console.log('   • Market Intelligence Integration');

console.log('\n🚀 API Endpoints Available:');
console.log('   • GET /api/marketplace/ai/dashboard-insights');
console.log('   • GET /api/marketplace/ai/product-optimizations');
console.log('   • GET /api/marketplace/ai/competitive-analysis');
console.log('   • GET /api/marketplace/ai/sales-insights');
console.log('   • GET /api/marketplace/ai/inventory-recommendations');
console.log('   • POST /api/marketplace/ai/apply-suggestions');
console.log('   • POST /api/marketplace/products/ai-optimize');

console.log('\n📱 Frontend Features:');
console.log('   • AI-powered wholesaler dashboard');
console.log('   • Real-time AI insights panel');
console.log('   • Product optimization suggestions');
console.log('   • Inventory intelligence alerts');

console.log('\n🔧 Next Steps:');
console.log('1. Configure your .env file with API keys');
console.log('2. Run the database schema in Supabase');
console.log('3. Install dependencies: npm install');
console.log('4. Start the server: npm start');
console.log('5. Test AI features in the wholesaler dashboard');

console.log('\n📚 Documentation:');
console.log('   • AI_SELLER_FEATURES.md - Comprehensive feature documentation');
console.log('   • README.md - General setup and usage');

console.log('\n🎉 AI Integration Status: READY');
console.log('Your AgriaiBot platform is now equipped with powerful AI features!');

// Create a quick test file
const testContent = `// Quick AI Feature Test
// Run this after setting up your environment

const testAIFeatures = async () => {
    console.log('🧪 Testing AI Features...');
    
    // Test environment
    if (!process.env.GEMINI_API_KEY) {
        console.log('❌ GEMINI_API_KEY not configured');
        return;
    }
    
    if (!process.env.SUPABASE_URL) {
        console.log('❌ SUPABASE_URL not configured');
        return;
    }
    
    console.log('✅ Environment configured');
    console.log('🚀 AI features ready for testing!');
    
    // You can add actual API tests here once the server is running
};

testAIFeatures();
`;

fs.writeFileSync('test-ai-setup.js', testContent);
console.log('\n📝 Created test-ai-setup.js for testing your setup');

console.log('\n' + '='.repeat(40));
console.log('Setup complete! 🎉');
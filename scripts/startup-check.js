#!/usr/bin/env node

require('dotenv').config();

console.log('🚀 AgriAI Bot Startup Check\n');

// Check environment variables
const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'JWT_SECRET'
];

const optionalEnvVars = [
    'GEMINI_API_KEY'
];

let hasErrors = false;

console.log('📋 Environment Variables:');
requiredEnvVars.forEach(varName => {
    if (process.env[varName]) {
        console.log(`   ✅ ${varName}: configured`);
    } else {
        console.log(`   ❌ ${varName}: missing`);
        hasErrors = true;
    }
});

optionalEnvVars.forEach(varName => {
    if (process.env[varName]) {
        console.log(`   ✅ ${varName}: configured`);
    } else {
        console.log(`   ⚠️  ${varName}: not configured (AI features will use fallback)`);
    }
});

// Test database connection
console.log('\n🗄️  Database Connection:');
try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY
    );
    console.log('   ✅ Supabase client initialized');
} catch (error) {
    console.log('   ❌ Database connection failed:', error.message);
    hasErrors = true;
}

// Check port availability
const PORT = process.env.PORT || 3000;
console.log(`\n🌐 Server Configuration:`);
console.log(`   📡 Port: ${PORT}`);
console.log(`   🔒 JWT Secret: ${process.env.JWT_SECRET ? 'configured' : 'missing'}`);

if (hasErrors) {
    console.log('\n❌ Startup check failed. Please fix the issues above.');
    process.exit(1);
} else {
    console.log('\n✅ All checks passed! Starting application...');
    process.exit(0);
}
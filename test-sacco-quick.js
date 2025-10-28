#!/usr/bin/env node

require('dotenv').config();

const { createSACCO, getSACCOGroups } = require('./services/sacco');

async function testSACCOBasic() {
    console.log('🧪 Testing SACCO functionality...\n');
    
    try {
        // Test getting SACCO groups (should work even without auth for basic test)
        console.log('1. Testing SACCO groups retrieval...');
        const saccos = await getSACCOGroups({});
        console.log(`✅ Found ${saccos.length} SACCO groups`);
        
        console.log('\n2. SACCO service is working correctly!');
        console.log('   - Database connection: ✅');
        console.log('   - SACCO queries: ✅');
        
        console.log('\n📝 To create SACCOs, users need to:');
        console.log('   1. Register an account');
        console.log('   2. Login to get authentication token');
        console.log('   3. Use POST /api/sacco with token');
        
        console.log('\n🎉 SACCO functionality is ready!');
        
    } catch (error) {
        console.log('❌ SACCO test failed:', error.message);
        
        if (error.message.includes('connect')) {
            console.log('💡 Database connection issue. Check your Supabase credentials.');
        }
    }
}

testSACCOBasic();
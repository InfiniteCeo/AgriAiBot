// Quick AI Feature Test
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

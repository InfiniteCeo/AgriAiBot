// Test SACCO creation functionality
const axios = require("axios");

const BASE_URL = "http://localhost:3000";

async function testSACCOCreation() {
  try {
    console.log("🧪 Testing SACCO creation functionality...\n");

    // Step 1: Register a test user
    console.log("1. Registering test user...");
    const registerResponse = await axios.post(`${BASE_URL}/api/auth/register`, {
      email: `testuser${Date.now()}@example.com`,
      password: "testpass123",
      phone: `+25470000${Math.floor(Math.random() * 10000)}`,
      name: "Test User",
      user_type: "farmer",
      location: "Nairobi",
    });

    const { user, token } = registerResponse.data;
    console.log("✅ User registered successfully:", user.name);

    // Step 2: Create a SACCO group
    console.log("\n2. Creating SACCO group...");
    const saccoResponse = await axios.post(
      `${BASE_URL}/api/sacco`,
      {
        name: `Test SACCO ${Date.now()}`,
        region: "Nairobi",
        description: "A test SACCO group for farmers in Nairobi",
        member_limit: 50,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const { sacco } = saccoResponse.data;
    console.log("✅ SACCO created successfully:", sacco.name);
    console.log("   SACCO ID:", sacco.id);
    console.log("   Region:", sacco.region);
    console.log("   Admin ID:", sacco.admin_id);

    // Step 3: Get user's SACCO groups
    console.log("\n3. Fetching user SACCO groups...");
    const userSACCOsResponse = await axios.get(
      `${BASE_URL}/api/sacco/user/my-saccos`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const { saccos } = userSACCOsResponse.data;
    console.log("✅ User SACCO groups retrieved:", saccos.length);
    if (saccos.length > 0) {
      console.log("   First SACCO:", saccos[0].name);
    }

    // Step 4: Get all available SACCO groups
    console.log("\n4. Fetching all SACCO groups...");
    const allSACCOsResponse = await axios.get(`${BASE_URL}/api/sacco`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const { saccos: allSACCOs } = allSACCOsResponse.data;
    console.log("✅ All SACCO groups retrieved:", allSACCOs.length);

    console.log("\n🎉 All tests passed! SACCO creation is working correctly.");

    return {
      success: true,
      user,
      sacco,
      token,
    };
  } catch (error) {
    console.error("❌ Test failed:", error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data || error.message,
    };
  }
}

// Run the test
testSACCOCreation().then((result) => {
  if (result.success) {
    console.log("\n✅ SACCO functionality is working correctly!");
    process.exit(0);
  } else {
    console.log("\n❌ SACCO functionality has issues that need to be fixed.");
    process.exit(1);
  }
});

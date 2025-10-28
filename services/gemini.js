const { GoogleGenerativeAI } = require("@google/generative-ai");

// Access your API key as an environment variable
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Configuration constants
const REQUEST_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 5;
const RETRY_DELAY = 1000; // 1 second

/**
 * Create a timeout promise that rejects after specified milliseconds
 * @param {number} ms - Timeout in milliseconds
 * @returns {Promise} Promise that rejects with timeout error
 */
function createTimeout(ms) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error("Request timeout")), ms);
  });
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after delay
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Process text message with Gemini AI using structured agricultural prompt
 * @param {string} userMessage - User's text message
 * @param {Object} userProfile - Optional user profile for personalization
 * @returns {Promise<string>} AI response
 */
async function processTextMessage(userMessage, userProfile = null) {
  let personalizedContext = "";

  if (userProfile) {
    personalizedContext = `
FARMER PROFILE:
- Name: ${userProfile.name}
- Location: ${userProfile.location || "Kenya"}
- Farm Size: ${
      userProfile.farm_size ? `${userProfile.farm_size} acres` : "Not specified"
    }
- Crops Grown: ${
      userProfile.crops_grown && userProfile.crops_grown.length > 0
        ? userProfile.crops_grown.join(", ")
        : "Various crops"
    }
- Farming Experience: ${
      userProfile.created_at
        ? `Member since ${new Date(userProfile.created_at).getFullYear()}`
        : "New farmer"
    }

Personalize your advice based on this farmer's profile, location, and crops.
`;
  }

  const prompt = `
You are AgriaiBot, an Agricultural Intelligence Assistant for Kenya. 
Your job is to give practical, localized, clear advice for farmers. 
Keep answers short and focused. Use common Kenyan crops and market conditions. 
Prefer actionable steps instead of long explanations.

${personalizedContext}

USER MESSAGE: ${userMessage}

RESPONSE FORMAT (ALWAYS):
🌱 **Short Answer** (2-4 lines)

📋 **Step-by-Step Recommendations**
• Step 1: [action]
• Step 2: [action]
• Step 3: [action]

🛠️ **Inputs / Tools Needed**
• [item 1]
• [item 2]

💰 **Estimated Costs or Expected Outcome**
[cost information or expected results]

⚠️ **Warning(s)**
[any warnings or precautions]

Keep responses under 300 words. Use bullet points and emojis for readability.
${
  userProfile
    ? `Address the farmer by name (${userProfile.name}) when appropriate.`
    : ""
}
    `;

  try {
    const model = genAI.getGenerativeModel({ model: "models/gemini-2.5-flash" });

    const generatePromise = model.generateContent(prompt);
    const timeoutPromise = createTimeout(REQUEST_TIMEOUT);

    const result = await Promise.race([generatePromise, timeoutPromise]);
    const response = await result.response;
    const text = response.text();

    return text;
  } catch (error) {
    console.error("Error in processTextMessage:", error);
    throw error;
  }
}

/**
 * Process image with Gemini AI for crop diagnosis
 * @param {string} userMessage - User's text message accompanying the image
 * @param {Buffer} imageBuffer - Image data as buffer
 * @param {Object} userProfile - Optional user profile for personalization
 * @returns {Promise<string>} AI response with image analysis
 */
async function processImageMessage(
  userMessage,
  imageBuffer,
  userProfile = null
) {
  let personalizedContext = "";

  if (userProfile) {
    personalizedContext = `
FARMER PROFILE:
- Name: ${userProfile.name}
- Location: ${userProfile.location || "Kenya"}
- Farm Size: ${
      userProfile.farm_size ? `${userProfile.farm_size} acres` : "Not specified"
    }
- Crops Grown: ${
      userProfile.crops_grown && userProfile.crops_grown.length > 0
        ? userProfile.crops_grown.join(", ")
        : "Various crops"
    }

Consider this farmer's specific crops and location when analyzing the image.
`;
  }

  const prompt = `
You are AgriaiBot, an Agricultural Intelligence Assistant for Kenya. 
You are analyzing an agricultural image (crop, disease, pest, etc.). 
Provide clear, actionable advice for Kenyan farming conditions.

${personalizedContext}

USER QUESTION: ${userMessage}

RESPONSE FORMAT (ALWAYS):
🔍 **Diagnosis**
[What is in the image? What problem/condition do you see?]

🎯 **Cause**
[Why is this happening? Root cause analysis]

💊 **Treatment Steps**
• Step 1: [immediate action]
• Step 2: [follow-up action]
• Step 3: [monitoring action]

🛡️ **Prevention Steps**
• [prevention measure 1]
• [prevention measure 2]

🛠️ **Inputs / Tools Needed**
• [item 1]
• [item 2]

💰 **Estimated Costs or Expected Outcome**
[cost information or expected results]

Keep responses under 350 words. Use bullet points and emojis for readability.
Focus on practical solutions available in Kenya.
${
  userProfile
    ? `Address the farmer by name (${userProfile.name}) when appropriate.`
    : ""
}
        `;
      try {
        const model = genAI.getGenerativeModel({ model: "models/gemini-2.5-flash" });

    // Convert buffer to base64 and determine MIME type
    const base64Data = imageBuffer.toString("base64");
    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: "image/jpeg", // Assume JPEG, could be enhanced to detect actual type
      },
    };

    const generatePromise = model.generateContent([prompt, imagePart]);
    const timeoutPromise = createTimeout(REQUEST_TIMEOUT);

    const result = await Promise.race([generatePromise, timeoutPromise]);
    const response = await result.response;
    const text = response.text();

    return text;
  } catch (error) {
    console.error("Error in processImageMessage:", error);
    throw error;
  }
}

/**
 * Main function to process messages with Gemini AI with retry logic
 * @param {string} userMessage - User's message
 * @param {Buffer} imageData - Optional image data
 * @param {Object} userProfile - Optional user profile for personalization
 * @returns {Promise<string>} AI response
 */
async function processWithGemini(
  userMessage,
  imageData = null,
  userProfile = null
) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      let response;

      if (imageData) {
        response = await processImageMessage(
          userMessage,
          imageData,
          userProfile
        );
      } else {
        response = await processTextMessage(userMessage, userProfile);
      }

      // Validate response is not empty
      if (!response || response.trim().length === 0) {
        throw new Error("Empty response from Gemini");
      }

      return response;
    } catch (error) {
      lastError = error;
      console.error(`Gemini API attempt ${attempt} failed:`, error.message);

      // Don't retry on certain errors
      if (
        error.message.includes("API key") ||
        error.message.includes("quota") ||
        error.message.includes("permission")
      ) {
        break;
      }

      // Wait before retrying (except on last attempt)
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY * attempt);
      }
    }
  }

  // All retries failed, return fallback response
  console.error("All Gemini API attempts failed:", lastError);
  return getFallbackResponse(imageData !== null);
}

/**
 * Get fallback response when Gemini API fails
 * @param {boolean} isImageQuery - Whether this was an image query
 * @returns {string} Fallback response
 */
function getFallbackResponse(isImageQuery = false) {
  // Check if API key is missing
  if (!process.env.GEMINI_API_KEY) {
    return `🔧 **Configuration Issue**

The AI service needs to be configured. Please:
• Add your GEMINI_API_KEY to the .env file
• Restart the application
• Contact your administrator if you need help

For immediate farming help, you can:
• Browse the marketplace for products
• Join SACCO groups for community support
• Contact your local agricultural extension officer

Sorry for the inconvenience! 🙏`;
  }

  if (isImageQuery) {
    return `🤖 **Service Temporarily Unavailable**

I'm having trouble analyzing your image right now. Please try again in a few minutes.

In the meantime, you can:
• Describe the problem in text
• Check if the image is clear and well-lit
• Try sending the image again later

Sorry for the inconvenience! 🙏`;
  } else {
    return `🤖 **Service Temporarily Unavailable**

I'm having trouble processing your question right now. Please try again in a few minutes.

For immediate help, you can:
• Rephrase your question
• Try asking about a specific crop or farming practice
• Contact your local agricultural extension officer

Sorry for the inconvenience! 🙏`;
  }
}

/**
 * Convert image buffer to base64 (utility function)
 * @param {Buffer} imageBuffer - Image data as buffer
 * @returns {string} Base64 encoded image
 */
function convertImageToBase64(imageBuffer) {
  try {
    return imageBuffer.toString("base64");
  } catch (error) {
    console.error("Error converting image to base64:", error);
    throw new Error("Failed to process image data");
  }
}

/**
 * Analyze market data and trends using Gemini AI
 * @param {Object} marketData - Historical market data
 * @param {string} timeframe - Analysis timeframe (e.g., '30d', '90d')
 * @param {string} region - Geographic region for analysis
 * @returns {Promise<Object>} Market analysis insights
 */
async function analyzeMarketTrends(
  marketData,
  timeframe = "30d",
  region = "Kenya"
) {
  const prompt = `
You are AgriaiBot's Market Intelligence Analyst for ${region}. 
Analyze the following agricultural market data and provide actionable insights for farmers and wholesalers.

MARKET DATA:
${JSON.stringify(marketData, null, 2)}

ANALYSIS TIMEFRAME: ${timeframe}

Provide analysis in this EXACT format:

📊 **Market Overview**
[2-3 sentences summarizing current market conditions]

📈 **Price Trends**
• [Product/Category]: [trend description with specific price changes]
• [Product/Category]: [trend description with specific price changes]
• [Product/Category]: [trend description with specific price changes]

🔮 **Demand Forecast (Next ${timeframe})**
• High Demand: [products/categories expected to have high demand]
• Medium Demand: [products/categories with stable demand]
• Low Demand: [products/categories with declining demand]

⚠️ **Supply Chain Insights**
• [Key supply chain opportunity or risk]
• [Key supply chain opportunity or risk]

💡 **Recommendations**
• For Farmers: [specific actionable advice]
• For Wholesalers: [specific actionable advice]
• For SACCO Groups: [bulk purchasing opportunities]

Keep analysis practical and focused on Kenyan agricultural conditions.
Use specific numbers from the data when available.
    `;

  try {
    const model = genAI.getGenerativeModel({ model: "models/gemini-2.5-flash" });

    const generatePromise = model.generateContent(prompt);
    const timeoutPromise = createTimeout(REQUEST_TIMEOUT);

    const result = await Promise.race([generatePromise, timeoutPromise]);
    const response = await result.response;
    const text = response.text();

    return {
      analysis: text,
      timeframe,
      region,
      generated_at: new Date().toISOString(),
      data_points: Array.isArray(marketData)
        ? marketData.length
        : Object.keys(marketData).length,
    };
  } catch (error) {
    console.error("Error in analyzeMarketTrends:", error);
    throw error;
  }
}

/**
 * Generate demand forecast for specific products/categories
 * @param {string} productCategory - Product category to forecast
 * @param {string} region - Geographic region
 * @param {Array} historicalData - Historical purchase and price data
 * @param {string} forecastPeriod - Forecast period (e.g., '3months', '6months')
 * @returns {Promise<Object>} Demand forecast
 */
async function forecastDemand(
  productCategory,
  region,
  historicalData,
  forecastPeriod = "3months"
) {
  const prompt = `
You are AgriaiBot's Demand Forecasting Specialist for ${region}.
Analyze historical data and forecast demand for ${productCategory}.

HISTORICAL DATA:
${JSON.stringify(historicalData, null, 2)}

FORECAST PERIOD: ${forecastPeriod}
PRODUCT CATEGORY: ${productCategory}
REGION: ${region}

Provide forecast in this EXACT format:

🎯 **Demand Forecast for ${productCategory}**

📊 **${forecastPeriod} Outlook**
• Overall Demand: [High/Medium/Low] with [percentage] confidence
• Peak Demand Period: [specific months/seasons]
• Low Demand Period: [specific months/seasons]

📈 **Seasonal Patterns**
• [Month/Season]: [demand level and reasoning]
• [Month/Season]: [demand level and reasoning]
• [Month/Season]: [demand level and reasoning]

💰 **Price Predictions**
• Expected Price Range: [min] - [max] per [unit]
• Best Buying Time: [specific timing recommendation]
• Price Risk Factors: [factors that could affect prices]

🛒 **Bulk Purchase Recommendations**
• Optimal Bulk Order Timing: [when to place bulk orders]
• Recommended Order Quantities: [quantity ranges for different scenarios]
• Cost Savings Potential: [estimated savings percentage]

⚠️ **Risk Factors**
• [Key risk that could affect demand]
• [Key risk that could affect demand]

Base recommendations on Kenyan agricultural cycles and market patterns.
Use specific data points from historical data when available.
    `;

  try {
    const model = genAI.getGenerativeModel({ model: "models/gemini-2.5-flash" });

    const generatePromise = model.generateContent(prompt);
    const timeoutPromise = createTimeout(REQUEST_TIMEOUT);

    const result = await Promise.race([generatePromise, timeoutPromise]);
    const response = await result.response;
    const text = response.text();

    return {
      forecast: text,
      product_category: productCategory,
      region,
      forecast_period: forecastPeriod,
      generated_at: new Date().toISOString(),
      data_points: historicalData.length,
      confidence_level: "medium", // Could be enhanced with actual confidence calculation
    };
  } catch (error) {
    console.error("Error in forecastDemand:", error);
    throw error;
  }
}

/**
 * Generate personalized recommendations for farmers
 * @param {Object} userProfile - Farmer's profile data
 * @param {Object} marketData - Current market data
 * @param {Object} saccoData - SACCO group information
 * @param {Array} availableProducts - Available products in marketplace
 * @returns {Promise<Object>} Personalized recommendations
 */
async function generatePersonalizedRecommendations(
  userProfile,
  marketData,
  saccoData = null,
  availableProducts = []
) {
  const prompt = `
You are AgriaiBot's Personal Agricultural Advisor for ${userProfile.name}.
Generate personalized recommendations based on their profile and current market conditions.

FARMER PROFILE:
- Name: ${userProfile.name}
- Location: ${userProfile.location || "Kenya"}
- Farm Size: ${
    userProfile.farm_size ? `${userProfile.farm_size} acres` : "Not specified"
  }
- Crops Grown: ${
    userProfile.crops_grown && userProfile.crops_grown.length > 0
      ? userProfile.crops_grown.join(", ")
      : "Various crops"
  }
- Member Since: ${
    userProfile.created_at
      ? new Date(userProfile.created_at).getFullYear()
      : "Recent"
  }

SACCO INFORMATION:
${
  saccoData
    ? `
- SACCO Group: ${saccoData.name}
- Region: ${saccoData.region}
- Member Count: ${saccoData.member_count || "Not specified"}
- Active Bulk Orders: ${saccoData.active_bulk_orders || 0}
`
    : "Not a SACCO member"
}

CURRENT MARKET DATA:
${JSON.stringify(marketData, null, 2)}

AVAILABLE PRODUCTS (Sample):
${availableProducts
  .slice(0, 10)
  .map((p) => `- ${p.name}: ${p.unit_price}/${p.unit_type} (${p.category})`)
  .join("\n")}

Generate recommendations in this EXACT format:

👋 **Hello ${userProfile.name}!**

🌱 **Crop-Specific Recommendations**
${
  userProfile.crops_grown && userProfile.crops_grown.length > 0
    ? userProfile.crops_grown
        .map((crop) => `• ${crop}: [specific advice for this crop]`)
        .join("\n")
    : "• [General crop recommendations based on location and season]"
}

💰 **Market Opportunities**
• Best Purchase Timing: [when to buy specific inputs]
• Price Alerts: [products with favorable pricing]
• Bulk Savings: [opportunities for cost savings]

${
  saccoData
    ? `
🤝 **SACCO Group Benefits**
• Current Bulk Orders: [available bulk purchase opportunities]
• Group Savings: [estimated savings through group purchases]
• Recommended Actions: [specific actions for SACCO participation]
`
    : `
🤝 **SACCO Recommendation**
• Consider joining a local SACCO group for bulk purchasing benefits
• Potential savings: 15-30% on farm inputs through group orders
`
}

📅 **Seasonal Planning**
• This Month: [immediate actions to take]
• Next Month: [upcoming preparations needed]
• Season Ahead: [longer-term planning advice]

🛒 **Recommended Purchases**
• Priority 1: [most important purchase with reasoning]
• Priority 2: [second priority purchase with reasoning]
• Priority 3: [third priority purchase with reasoning]

⚠️ **Alerts & Warnings**
• [Important alert relevant to farmer's crops or location]
• [Market risk or opportunity to watch]

Keep recommendations specific to ${userProfile.location} conditions and ${
    userProfile.crops_grown
      ? userProfile.crops_grown.join(", ")
      : "general farming"
  } practices.
    `;

  try {
    const model = genAI.getGenerativeModel({ model: "models/gemini-2.5-flash" });

    const generatePromise = model.generateContent(prompt);
    const timeoutPromise = createTimeout(REQUEST_TIMEOUT);

    const result = await Promise.race([generatePromise, timeoutPromise]);
    const response = await result.response;
    const text = response.text();

    return {
      recommendations: text,
      user_id: userProfile.id,
      user_name: userProfile.name,
      generated_at: new Date().toISOString(),
      sacco_member: !!saccoData,
      crops_count: userProfile.crops_grown ? userProfile.crops_grown.length : 0,
    };
  } catch (error) {
    console.error("Error in generatePersonalizedRecommendations:", error);
    throw error;
  }
}

/**
 * Detect bulk purchase opportunities based on market conditions
 * @param {Array} products - Available products
 * @param {Object} marketData - Current market data
 * @param {Array} saccoGroups - Active SACCO groups
 * @param {string} region - Geographic region
 * @returns {Promise<Object>} Bulk purchase opportunities
 */
async function detectBulkPurchaseOpportunities(
  products,
  marketData,
  saccoGroups,
  region = "Kenya"
) {
  const prompt = `
You are AgriaiBot's Bulk Purchase Opportunity Detector for ${region}.
Analyze products, market conditions, and SACCO groups to identify the best bulk purchasing opportunities.

AVAILABLE PRODUCTS:
${products
  .slice(0, 20)
  .map(
    (p) => `
- ${p.name} (${p.category})
  Price: ${p.unit_price}/${p.unit_type}
  Bulk Pricing: ${JSON.stringify(p.bulk_pricing || {})}
  Stock: ${p.stock_quantity}
  Location: ${p.location}
`
  )
  .join("\n")}

MARKET CONDITIONS:
${JSON.stringify(marketData, null, 2)}

ACTIVE SACCO GROUPS:
${saccoGroups
  .slice(0, 10)
  .map(
    (s) => `
- ${s.name} (${s.region})
  Members: ${s.member_count || "Unknown"}
  Active Orders: ${s.active_bulk_orders || 0}
`
  )
  .join("\n")}

Identify opportunities in this EXACT format:

🎯 **Top Bulk Purchase Opportunities**

💎 **Opportunity 1: [Product Name]**
• Current Price: [price per unit]
• Bulk Savings: [percentage savings at bulk tiers]
• Recommended Quantity: [optimal bulk order size]
• Target SACCO Groups: [which groups should consider this]
• Timing: [when to place the order]
• Savings Potential: [total savings estimate]

💎 **Opportunity 2: [Product Name]**
• Current Price: [price per unit]
• Bulk Savings: [percentage savings at bulk tiers]
• Recommended Quantity: [optimal bulk order size]
• Target SACCO Groups: [which groups should consider this]
• Timing: [when to place the order]
• Savings Potential: [total savings estimate]

💎 **Opportunity 3: [Product Name]**
• Current Price: [price per unit]
• Bulk Savings: [percentage savings at bulk tiers]
• Recommended Quantity: [optimal bulk order size]
• Target SACCO Groups: [which groups should consider this]
• Timing: [when to place the order]
• Savings Potential: [total savings estimate]

📊 **Market Timing Analysis**
• Best Purchase Window: [optimal timing for bulk orders]
• Price Trend: [whether prices are rising, falling, or stable]
• Supply Availability: [stock levels and availability concerns]

🤝 **SACCO Coordination Recommendations**
• Multi-Group Orders: [opportunities for multiple SACCOs to combine orders]
• Regional Coordination: [regional bulk purchase possibilities]
• Seasonal Planning: [seasonal bulk purchase strategies]

⚠️ **Risk Considerations**
• [Key risk factor for bulk purchases]
• [Key risk factor for bulk purchases]

Focus on products with significant bulk discounts and high farmer demand.
Consider seasonal needs and regional farming patterns.
    `;

  try {
    const model = genAI.getGenerativeModel({ model: "models/gemini-2.5-flash" });

    const generatePromise = model.generateContent(prompt);
    const timeoutPromise = createTimeout(REQUEST_TIMEOUT);

    const result = await Promise.race([generatePromise, timeoutPromise]);
    const response = await result.response;
    const text = response.text();

    return {
      opportunities: text,
      region,
      generated_at: new Date().toISOString(),
      products_analyzed: products.length,
      sacco_groups_analyzed: saccoGroups.length,
      market_data_points: Array.isArray(marketData)
        ? marketData.length
        : Object.keys(marketData).length,
    };
  } catch (error) {
    console.error("Error in detectBulkPurchaseOpportunities:", error);
    throw error;
  }
}

/**
 * Generate price alerts and optimal timing suggestions
 * @param {Object} userProfile - User profile
 * @param {Array} watchedProducts - Products user is interested in
 * @param {Object} priceHistory - Historical price data
 * @returns {Promise<Object>} Price alerts and timing recommendations
 */
async function generatePriceAlerts(userProfile, watchedProducts, priceHistory) {
  const prompt = `
You are AgriaiBot's Price Alert Specialist for ${userProfile.name} in ${
    userProfile.location
  }.
Analyze price trends and generate alerts for optimal purchase timing.

USER PROFILE:
- Name: ${userProfile.name}
- Location: ${userProfile.location}
- Crops: ${
    userProfile.crops_grown ? userProfile.crops_grown.join(", ") : "Various"
  }
- Farm Size: ${userProfile.farm_size || "Not specified"} acres

WATCHED PRODUCTS:
${watchedProducts
  .map(
    (p) => `
- ${p.name} (${p.category})
  Current Price: ${p.unit_price}/${p.unit_type}
  Stock: ${p.stock_quantity}
`
  )
  .join("\n")}

PRICE HISTORY:
${JSON.stringify(priceHistory, null, 2)}

Generate alerts in this EXACT format:

🚨 **Price Alerts for ${userProfile.name}**

💚 **Buy Now Alerts**
• [Product]: Price is [X]% below average - Good time to buy
• [Product]: Price is [X]% below average - Good time to buy

⏰ **Wait Alerts**
• [Product]: Price is [X]% above average - Consider waiting
• [Product]: Price is [X]% above average - Consider waiting

📈 **Price Trend Alerts**
• [Product]: Prices trending [up/down] by [X]% - [recommendation]
• [Product]: Prices trending [up/down] by [X]% - [recommendation]

🎯 **Optimal Purchase Timing**
• Best Time to Buy [Product]: [specific timing recommendation]
• Best Time to Buy [Product]: [specific timing recommendation]

💰 **Cost Savings Opportunities**
• [Product]: Save [amount] by buying [when/how]
• [Product]: Save [amount] by buying [when/how]

📅 **Seasonal Recommendations**
• This Month: [immediate purchase recommendations]
• Next Month: [upcoming purchase opportunities]
• Season Ahead: [longer-term purchase planning]

⚠️ **Price Risk Warnings**
• [Product]: Risk of price increase due to [reason]
• [Product]: Risk of price increase due to [reason]

Base recommendations on Kenyan agricultural seasons and market patterns.
Consider the farmer's specific crops and location.
    `;

  try {
    const model = genAI.getGenerativeModel({ model: "models/gemini-2.5-flash" });

    const generatePromise = model.generateContent(prompt);
    const timeoutPromise = createTimeout(REQUEST_TIMEOUT);

    const result = await Promise.race([generatePromise, timeoutPromise]);
    const response = await result.response;
    const text = response.text();

    return {
      alerts: text,
      user_id: userProfile.id,
      user_name: userProfile.name,
      generated_at: new Date().toISOString(),
      products_monitored: watchedProducts.length,
      alert_type: "price_timing",
    };
  } catch (error) {
    console.error("Error in generatePriceAlerts:", error);
    throw error;
  }
}

/**
 * Generate AI-powered product optimizations for sellers
 * @param {Object} productData - Product information
 * @param {string} region - Geographic region
 * @returns {Promise<Object>} Product optimization suggestions
 */
async function generateProductOptimizations(productData, region = "Kenya") {
  const prompt = `
You are AgriaiBot's Product Optimization Specialist for ${region}.
Help a wholesaler optimize their product listing for maximum sales and farmer appeal.

PRODUCT DATA:
- Name: ${productData.name}
- Description: ${productData.description || "Not provided"}
- Category: ${productData.category || "Not specified"}
- Unit Price: ${productData.unit_price}/${productData.unit_type}
- Stock: ${productData.stock_quantity}
- Location: ${productData.location || region}

Provide optimization suggestions in this EXACT format:

🎯 **Product Optimization for "${productData.name}"**

📝 **Optimized Description**
[Write a compelling 2-3 sentence product description that highlights benefits for Kenyan farmers]

📊 **Suggested Bulk Pricing Tiers**
• 10+ units: [suggested price per unit - 5-10% discount]
• 50+ units: [suggested price per unit - 10-15% discount]  
• 100+ units: [suggested price per unit - 15-20% discount]

🏷️ **Category Optimization**
Recommended Category: [best category for this product]

💡 **Marketing Suggestions**
• Key Selling Point 1: [specific benefit for farmers]
• Key Selling Point 2: [specific benefit for farmers]
• Key Selling Point 3: [specific benefit for farmers]

📈 **Demand Forecast**
• Expected Demand: [High/Medium/Low]
• Best Selling Season: [specific months/seasons]
• Target Customers: [specific farmer types]

💰 **Pricing Strategy**
• Market Position: [competitive analysis]
• Price Recommendation: [optimal pricing advice]
• Profit Margin: [estimated margin percentage]

🎯 **SEO Keywords**
[5-7 relevant keywords farmers would search for]

⚠️ **Market Warnings**
• [Any market risks or seasonal considerations]

Base recommendations on Kenyan agricultural needs and market conditions.
Consider seasonal farming patterns and common crop requirements.
    `;

  try {
    const model = genAI.getGenerativeModel({ model: "models/gemini-2.5-flash" });

    const generatePromise = model.generateContent(prompt);
    const timeoutPromise = createTimeout(REQUEST_TIMEOUT);

    const result = await Promise.race([generatePromise, timeoutPromise]);
    const response = await result.response;
    const text = response.text();

    // Parse AI response to extract structured data
    const optimizations = parseProductOptimizations(text, productData);

    return {
      raw_analysis: text,
      optimized_description: optimizations.description,
      suggested_bulk_pricing: optimizations.bulk_pricing,
      optimized_category: optimizations.category,
      marketing_suggestions: optimizations.marketing,
      demand_forecast: optimizations.demand,
      pricing_strategy: optimizations.pricing,
      seo_keywords: optimizations.keywords,
      generated_at: new Date().toISOString(),
      product_name: productData.name,
    };
  } catch (error) {
    console.error("Error in generateProductOptimizations:", error);
    throw error;
  }
}

/**
 * Parse AI product optimization response into structured data
 * @param {string} aiResponse - Raw AI response
 * @param {Object} originalProduct - Original product data
 * @returns {Object} Parsed optimization data
 */
function parseProductOptimizations(aiResponse, originalProduct) {
  const optimizations = {
    description: null,
    bulk_pricing: {},
    category: null,
    marketing: [],
    demand: "Medium",
    pricing: null,
    keywords: [],
  };

  try {
    // Extract optimized description
    const descMatch = aiResponse.match(
      /\*\*Optimized Description\*\*\s*\n([^\n]+(?:\n[^\n*]+)*)/
    );
    if (descMatch) {
      optimizations.description = descMatch[1].trim();
    }

    // Extract bulk pricing suggestions
    const bulkPricingMatches = aiResponse.match(
      /(\d+)\+ units: (\d+(?:\.\d+)?)/g
    );
    if (bulkPricingMatches) {
      bulkPricingMatches.forEach((match) => {
        const [, quantity, price] = match.match(
          /(\d+)\+ units: (\d+(?:\.\d+)?)/
        );
        optimizations.bulk_pricing[quantity] = parseFloat(price);
      });
    }

    // Extract category
    const categoryMatch = aiResponse.match(/Recommended Category: ([^\n]+)/);
    if (categoryMatch) {
      optimizations.category = categoryMatch[1].trim();
    }

    // Extract demand forecast
    const demandMatch = aiResponse.match(/Expected Demand: (High|Medium|Low)/);
    if (demandMatch) {
      optimizations.demand = demandMatch[1];
    }

    // Extract keywords
    const keywordsMatch = aiResponse.match(
      /\*\*SEO Keywords\*\*\s*\n([^\n*]+)/
    );
    if (keywordsMatch) {
      optimizations.keywords = keywordsMatch[1].split(",").map((k) => k.trim());
    }
  } catch (error) {
    console.warn("Error parsing AI optimizations:", error);
  }

  return optimizations;
}

/**
 * Generate AI-powered inventory management suggestions
 * @param {Array} products - Seller's products
 * @param {Array} orders - Recent orders
 * @param {Object} marketData - Market conditions
 * @returns {Promise<Object>} Inventory management suggestions
 */
async function generateInventoryInsights(products, orders, marketData) {
  const prompt = `
You are AgriaiBot's Inventory Management AI for an agricultural wholesaler.
Analyze their product portfolio and provide actionable inventory insights.

CURRENT PRODUCTS (${products.length} total):
${products
  .slice(0, 15)
  .map(
    (p) => `
- ${p.name} (${p.category})
  Price: ${p.unit_price}/${p.unit_type}
  Stock: ${p.stock_quantity}
  Status: ${p.is_active ? "Active" : "Inactive"}
`
  )
  .join("")}

RECENT ORDERS (${orders.length} total):
${orders
  .slice(0, 10)
  .map(
    (o) => `
- ${o.product_name}: ${o.quantity} units (${o.status})
  Total: KES ${o.total_amount}
`
  )
  .join("")}

MARKET CONDITIONS:
${JSON.stringify(marketData, null, 2)}

Provide inventory insights in this EXACT format:

📊 **Inventory Management Dashboard**

🔥 **Top Performing Products**
• [Product 1]: [performance metrics and insights]
• [Product 2]: [performance metrics and insights]
• [Product 3]: [performance metrics and insights]

⚠️ **Low Stock Alerts**
• [Product]: Only [X] units left - Restock recommended
• [Product]: Only [X] units left - Restock recommended

📈 **Restock Recommendations**
• Priority 1: [Product] - [reasoning and suggested quantity]
• Priority 2: [Product] - [reasoning and suggested quantity]
• Priority 3: [Product] - [reasoning and suggested quantity]

💡 **New Product Opportunities**
• Suggested Product 1: [product type] - [market opportunity]
• Suggested Product 2: [product type] - [market opportunity]

📉 **Underperforming Products**
• [Product]: [issue and suggested action]
• [Product]: [issue and suggested action]

💰 **Revenue Optimization**
• Price Adjustment: [specific recommendations]
• Bulk Pricing: [optimization suggestions]
• Seasonal Strategy: [timing recommendations]

📅 **Seasonal Planning**
• Next 30 Days: [immediate actions needed]
• Next 90 Days: [medium-term planning]
• Seasonal Prep: [upcoming season preparation]

    🎯 **Action Items**
    • Immediate (This Week): [urgent actions]
    • Short-term (This Month): [monthly goals]
    • Long-term (Next Quarter): [strategic planning]

    Focus on Kenyan agricultural seasons and farmer needs.
    Provide specific, actionable recommendations with quantities and timing.
        `;

      try {
        const model = genAI.getGenerativeModel({ model: "models/gemini-2.5-flash" });
    const generatePromise = model.generateContent(prompt);
    const timeoutPromise = createTimeout(REQUEST_TIMEOUT);

    const result = await Promise.race([generatePromise, timeoutPromise]);
    const response = await result.response;
    const text = response.text();

    return {
      insights: text,
      generated_at: new Date().toISOString(),
      products_analyzed: products.length,
      orders_analyzed: orders.length,
      analysis_type: "inventory_management",
    };
  } catch (error) {
    console.error("Error in generateInventoryInsights:", error);
    throw error;
  }
}

/**
 * Generate AI-powered competitive analysis for sellers
 * @param {Object} sellerProfile - Seller's profile and products
 * @param {Array} competitorProducts - Competitor products in same category
 * @param {string} region - Geographic region
 * @returns {Promise<Object>} Competitive analysis
 */
async function generateCompetitiveAnalysis(
  sellerProfile,
  competitorProducts,
  region = "Kenya"
) {
  const prompt = `
You are AgriaiBot's Competitive Intelligence Analyst for ${region}.
Analyze market competition and provide strategic recommendations for a wholesaler.

SELLER PROFILE:
- Location: ${sellerProfile.location}
- Products: ${sellerProfile.products.length} active listings
- Categories: ${sellerProfile.categories.join(", ")}
- Average Price Range: ${sellerProfile.price_range}

SELLER'S TOP PRODUCTS:
${sellerProfile.products
  .slice(0, 10)
  .map(
    (p) => `
- ${p.name}: ${p.unit_price}/${p.unit_type} (Stock: ${p.stock_quantity})
`
  )
  .join("")}

COMPETITOR ANALYSIS:
${competitorProducts
  .slice(0, 20)
  .map(
    (p) => `
- ${p.name}: ${p.unit_price}/${p.unit_type} by ${p.wholesaler_name} (${p.location})
`
  )
  .join("")}

Provide competitive analysis in this EXACT format:

🏆 **Competitive Analysis Report**

📊 **Market Position**
• Your Ranking: [position in market - Top 25%/Middle 50%/Bottom 25%]
• Price Competitiveness: [analysis of pricing vs competitors]
• Product Range: [breadth compared to competitors]

💪 **Your Competitive Advantages**
• Advantage 1: [specific strength vs competitors]
• Advantage 2: [specific strength vs competitors]
• Advantage 3: [specific strength vs competitors]

⚠️ **Competitive Threats**
• Threat 1: [competitor advantage you need to address]
• Threat 2: [competitor advantage you need to address]

💰 **Pricing Analysis**
• Overpriced Products: [products priced above market average]
• Underpriced Products: [products with pricing opportunity]
• Sweet Spot Products: [competitively priced products]

🎯 **Strategic Recommendations**
• Price Adjustments: [specific pricing changes needed]
• Product Gaps: [products you should add to compete]
• Market Opportunities: [underserved segments you can target]

📈 **Growth Opportunities**
• Immediate (30 days): [quick wins available]
• Short-term (90 days): [medium-term opportunities]
• Long-term (6 months): [strategic positioning moves]

🛡️ **Defensive Strategies**
• Protect Market Share: [how to defend against competitors]
• Customer Retention: [strategies to keep customers]
• Differentiation: [how to stand out from competition]

📍 **Regional Insights**
• Local Advantages: [benefits of your location]
• Regional Gaps: [opportunities in nearby areas]
• Distribution Strategy: [optimal coverage recommendations]

Focus on actionable strategies for Kenyan agricultural markets.
Consider seasonal patterns and farmer purchasing behavior.
    `;

  try {
    const model = genAI.getGenerativeModel({ model: "models/gemini-2.5-flash" });

    const generatePromise = model.generateContent(prompt);
    const timeoutPromise = createTimeout(REQUEST_TIMEOUT);

    const result = await Promise.race([generatePromise, timeoutPromise]);
    const response = await result.response;
    const text = response.text();

    return {
      analysis: text,
      seller_id: sellerProfile.id,
      generated_at: new Date().toISOString(),
      competitors_analyzed: competitorProducts.length,
      region: region,
      analysis_type: "competitive_intelligence",
    };
  } catch (error) {
    console.error("Error in generateCompetitiveAnalysis:", error);
    throw error;
  }
}

/**
 * Generate AI-powered sales performance insights
 * @param {Object} salesData - Sales performance data
 * @param {Array} products - Product catalog
 * @param {string} timeframe - Analysis timeframe
 * @returns {Promise<Object>} Sales performance insights
 */
async function generateSalesInsights(salesData, products, timeframe = "30d") {
  const prompt = `
You are AgriaiBot's Sales Performance Analyst.
Analyze sales data and provide actionable insights to improve performance.

SALES PERFORMANCE (${timeframe}):
- Total Revenue: KES ${salesData.total_revenue}
- Total Orders: ${salesData.total_orders}
- Average Order Value: KES ${salesData.avg_order_value}
- Top Selling Category: ${salesData.top_category}
- Conversion Rate: ${salesData.conversion_rate}%

TOP SELLING PRODUCTS:
${salesData.top_products
  .map(
    (p) => `
- ${p.name}: ${p.units_sold} units, KES ${p.revenue}
`
  )
  .join("")}

UNDERPERFORMING PRODUCTS:
${salesData.low_performers
  .map(
    (p) => `
- ${p.name}: ${p.units_sold} units, KES ${p.revenue}
`
  )
  .join("")}

PRODUCT CATALOG:
${products
  .slice(0, 10)
  .map(
    (p) => `
- ${p.name}: ${p.unit_price}/${p.unit_type} (Stock: ${p.stock_quantity})
`
  )
  .join("")}

Provide sales insights in this EXACT format:

📈 **Sales Performance Analysis (${timeframe})**

🎯 **Key Performance Metrics**
• Revenue Growth: [percentage change vs previous period]
• Order Volume: [trend analysis]
• Customer Acquisition: [new vs returning customers]
• Market Share: [estimated position]

🏆 **Success Stories**
• Best Performer: [top product with specific metrics]
• Growth Champion: [product with highest growth]
• Profit Leader: [most profitable product]

📉 **Areas for Improvement**
• Underperformer 1: [product and improvement strategy]
• Underperformer 2: [product and improvement strategy]
• Missed Opportunity: [potential that wasn't captured]

💡 **Optimization Recommendations**
• Product Mix: [portfolio optimization suggestions]
• Pricing Strategy: [specific price adjustments]
• Inventory Focus: [which products to prioritize]

📊 **Customer Behavior Insights**
• Purchase Patterns: [when and what customers buy]
• Seasonal Trends: [seasonal buying behavior]
• Bulk vs Individual: [order size preferences]

🎯 **Action Plan**
• Week 1: [immediate actions to take]
• Month 1: [short-term improvements]
• Quarter 1: [strategic initiatives]

📅 **Seasonal Strategy**
• Upcoming Season: [preparation recommendations]
• Product Timing: [when to promote which products]
• Stock Planning: [seasonal inventory adjustments]

💰 **Revenue Opportunities**
• Quick Wins: [immediate revenue boosters]
• Growth Areas: [expansion opportunities]
• New Markets: [untapped customer segments]

Focus on practical, implementable strategies for Kenyan agricultural markets.
Consider farmer purchasing cycles and seasonal needs.
    `;

  try {
    const model = genAI.getGenerativeModel({ model: "models/gemini-2.5-flash" });

    const generatePromise = model.generateContent(prompt);
    const timeoutPromise = createTimeout(REQUEST_TIMEOUT);

    const result = await Promise.race([generatePromise, timeoutPromise]);
    const response = await result.response;
    const text = response.text();

    return {
      insights: text,
      timeframe: timeframe,
      generated_at: new Date().toISOString(),
      revenue_analyzed: salesData.total_revenue,
      orders_analyzed: salesData.total_orders,
      analysis_type: "sales_performance",
    };
  } catch (error) {
    console.error("Error in generateSalesInsights:", error);
    throw error;
  }
}

module.exports = {
  processWithGemini,
  processTextMessage,
  processImageMessage,
  convertImageToBase64,
  getFallbackResponse,
  // Market Intelligence Functions
  analyzeMarketTrends,
  forecastDemand,
  generatePersonalizedRecommendations,
  detectBulkPurchaseOpportunities,
  generatePriceAlerts,
  // Seller AI Functions
  generateProductOptimizations,
  parseProductOptimizations,
  generateInventoryInsights,
  generateCompetitiveAnalysis,
  generateSalesInsights,
};

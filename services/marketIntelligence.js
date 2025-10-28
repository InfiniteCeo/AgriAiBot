const { supabase } = require("./supabase");
const {
  analyzeMarketTrends,
  forecastDemand,
  generatePersonalizedRecommendations,
  detectBulkPurchaseOpportunities,
  generatePriceAlerts,
} = require("./gemini");

/**
 * Market Intelligence Service
 * Handles market data collection, analysis, and recommendation generation
 */

/**
 * Collect and store market data from orders and products
 * @returns {Promise<Object>} Market data collection results
 */
async function collectMarketData() {
  try {
    // Get recent order data for market analysis
    const { data: recentOrders, error: ordersError } = await supabase
      .from("orders")
      .select(
        `
                id,
                quantity,
                unit_price,
                total_amount,
                created_at,
                product:products(id, name, category, unit_type, location)
            `
      )
      .gte(
        "created_at",
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      ) // Last 30 days
      .eq("payment_status", "paid")
      .order("created_at", { ascending: false });

    if (ordersError) {
      console.error("Error fetching recent orders:", ordersError);
      throw new Error("Failed to collect order data");
    }

    // Get product pricing data
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select(
        "id, name, category, unit_price, unit_type, location, stock_quantity, created_at"
      )
      .eq("is_active", true);

    if (productsError) {
      console.error("Error fetching products:", productsError);
      throw new Error("Failed to collect product data");
    }

    // Aggregate data by category and region
    const marketData = aggregateMarketData(recentOrders || [], products || []);

    // Store aggregated market data
    await storeMarketData(marketData);

    return {
      orders_analyzed: recentOrders?.length || 0,
      products_analyzed: products?.length || 0,
      categories_found: Object.keys(marketData.by_category).length,
      regions_found: Object.keys(marketData.by_region).length,
      collected_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error in collectMarketData:", error);
    throw error;
  }
}

/**
 * Aggregate market data by category and region
 * @param {Array} orders - Recent orders data
 * @param {Array} products - Products data
 * @returns {Object} Aggregated market data
 */
function aggregateMarketData(orders, products) {
  const data = {
    by_category: {},
    by_region: {},
    overall: {
      total_orders: orders.length,
      total_products: products.length,
      average_order_value: 0,
      most_popular_categories: [],
      price_trends: {},
    },
  };

  // Aggregate by category
  orders.forEach((order) => {
    if (!order.product?.category) return;

    const category = order.product.category;
    if (!data.by_category[category]) {
      data.by_category[category] = {
        total_orders: 0,
        total_quantity: 0,
        total_value: 0,
        average_price: 0,
        products: new Set(),
        regions: new Set(),
      };
    }

    data.by_category[category].total_orders++;
    data.by_category[category].total_quantity += order.quantity;
    data.by_category[category].total_value += order.total_amount;
    data.by_category[category].products.add(order.product.name);
    if (order.product.location) {
      data.by_category[category].regions.add(order.product.location);
    }
  });

  // Calculate averages for categories
  Object.keys(data.by_category).forEach((category) => {
    const cat = data.by_category[category];
    cat.average_price = cat.total_value / cat.total_quantity;
    cat.products = Array.from(cat.products);
    cat.regions = Array.from(cat.regions);
  });

  // Aggregate by region
  orders.forEach((order) => {
    if (!order.product?.location) return;

    const region = order.product.location;
    if (!data.by_region[region]) {
      data.by_region[region] = {
        total_orders: 0,
        total_value: 0,
        categories: new Set(),
        average_order_value: 0,
      };
    }

    data.by_region[region].total_orders++;
    data.by_region[region].total_value += order.total_amount;
    data.by_region[region].categories.add(order.product.category);
  });

  // Calculate averages for regions
  Object.keys(data.by_region).forEach((region) => {
    const reg = data.by_region[region];
    reg.average_order_value = reg.total_value / reg.total_orders;
    reg.categories = Array.from(reg.categories);
  });

  // Overall statistics
  data.overall.average_order_value =
    orders.reduce((sum, order) => sum + order.total_amount, 0) /
      orders.length || 0;
  data.overall.most_popular_categories = Object.entries(data.by_category)
    .sort(([, a], [, b]) => b.total_orders - a.total_orders)
    .slice(0, 5)
    .map(([category, stats]) => ({ category, orders: stats.total_orders }));

  return data;
}

/**
 * Store market data in the database
 * @param {Object} marketData - Aggregated market data
 * @returns {Promise<void>}
 */
async function storeMarketData(marketData) {
  try {
    const marketEntries = [];
    const today = new Date().toISOString().split("T")[0];

    // Store category-based market data
    Object.entries(marketData.by_category).forEach(([category, stats]) => {
      marketEntries.push({
        product_category: category,
        region: "All Regions",
        average_price: stats.average_price,
        demand_level: getDemandLevel(stats.total_orders),
        supply_level: getSupplyLevel(stats.products.length),
        date: today,
      });
    });

    // Store region-based market data
    Object.entries(marketData.by_region).forEach(([region, stats]) => {
      marketEntries.push({
        product_category: "All Categories",
        region: region,
        average_price: stats.average_order_value,
        demand_level: getDemandLevel(stats.total_orders),
        supply_level: getSupplyLevel(stats.categories.length),
        date: today,
      });
    });

    // Delete existing data for today to avoid duplicates
    await supabase.from("market_data").delete().eq("date", today);

    // Insert new market data
    if (marketEntries.length > 0) {
      const { error } = await supabase
        .from("market_data")
        .insert(marketEntries);

      if (error) {
        console.error("Error storing market data:", error);
        throw new Error("Failed to store market data");
      }
    }
  } catch (error) {
    console.error("Error in storeMarketData:", error);
    throw error;
  }
}

/**
 * Determine demand level based on order count
 * @param {number} orderCount - Number of orders
 * @returns {string} Demand level (low, medium, high)
 */
function getDemandLevel(orderCount) {
  if (orderCount >= 20) return "high";
  if (orderCount >= 5) return "medium";
  return "low";
}

/**
 * Determine supply level based on product variety
 * @param {number} productCount - Number of different products
 * @returns {string} Supply level (low, medium, high)
 */
function getSupplyLevel(productCount) {
  if (productCount >= 10) return "high";
  if (productCount >= 3) return "medium";
  return "low";
}

/**
 * Get market trends analysis using AI
 * @param {string} timeframe - Analysis timeframe
 * @param {string} region - Geographic region
 * @returns {Promise<Object>} Market trends analysis
 */
async function getMarketTrends(timeframe = "30d", region = "All Regions") {
  try {
    // Get market data from database
    const daysBack = timeframe === "90d" ? 90 : 30;
    const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    let query = supabase
      .from("market_data")
      .select("*")
      .gte("date", startDate)
      .order("date", { ascending: false });

    if (region !== "All Regions") {
      query = query.eq("region", region);
    }

    const { data: marketData, error } = await query;

    if (error) {
      console.error("Error fetching market data:", error);
      throw new Error("Failed to fetch market data");
    }

    // Use AI to analyze trends
    const analysis = await analyzeMarketTrends(
      marketData || [],
      timeframe,
      region
    );

    return analysis;
  } catch (error) {
    console.error("Error in getMarketTrends:", error);
    throw error;
  }
}

/**
 * Generate demand forecast for a product category
 * @param {string} productCategory - Product category
 * @param {string} region - Geographic region
 * @param {string} forecastPeriod - Forecast period
 * @returns {Promise<Object>} Demand forecast
 */
async function getDemandForecast(
  productCategory,
  region = "All Regions",
  forecastPeriod = "3months"
) {
  try {
    // Get historical data for the category
    const { data: historicalData, error } = await supabase
      .from("market_data")
      .select("*")
      .eq("product_category", productCategory)
      .or(`region.eq.${region},region.eq.All Regions`)
      .gte(
        "date",
        new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0]
      ) // Last 6 months
      .order("date", { ascending: true });

    if (error) {
      console.error("Error fetching historical data:", error);
      throw new Error("Failed to fetch historical data");
    }

    // Get recent orders for additional context
    const { data: recentOrders } = await supabase
      .from("orders")
      .select(
        `
                quantity,
                unit_price,
                total_amount,
                created_at,
                product:products(category, location)
            `
      )
      .eq("product.category", productCategory)
      .gte(
        "created_at",
        new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
      )
      .limit(100);

    const combinedData = [
      ...(historicalData || []),
      ...(recentOrders || []).map((order) => ({
        date: order.created_at.split("T")[0],
        average_price: order.unit_price,
        demand_level: "medium", // Inferred from order existence
        product_category: productCategory,
        region: order.product?.location || region,
      })),
    ];

    // Use AI to generate forecast
    const forecast = await forecastDemand(
      productCategory,
      region,
      combinedData,
      forecastPeriod
    );

    return forecast;
  } catch (error) {
    console.error("Error in getDemandForecast:", error);
    throw error;
  }
}

/**
 * Generate personalized recommendations for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Personalized recommendations
 */
async function generateUserRecommendations(userId) {
  try {
    // Get user profile
    const { data: userProfile, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (userError || !userProfile) {
      throw new Error("User not found");
    }

    // Get user's SACCO information if applicable
    let saccoData = null;
    const { data: saccoMembership } = await supabase
      .from("sacco_memberships")
      .select(
        `
                sacco:sacco_groups(
                    id,
                    name,
                    region,
                    member_limit
                )
            `
      )
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    if (saccoMembership?.sacco) {
      // Get additional SACCO stats
      const { count: memberCount } = await supabase
        .from("sacco_memberships")
        .select("*", { count: "exact", head: true })
        .eq("sacco_id", saccoMembership.sacco.id)
        .eq("status", "active");

      const { count: activeBulkOrders } = await supabase
        .from("bulk_orders")
        .select("*", { count: "exact", head: true })
        .eq("sacco_id", saccoMembership.sacco.id)
        .eq("status", "collecting");

      saccoData = {
        ...saccoMembership.sacco,
        member_count: memberCount,
        active_bulk_orders: activeBulkOrders,
      };
    }

    // Get current market data
    const { data: marketData } = await supabase
      .from("market_data")
      .select("*")
      .gte(
        "date",
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0]
      ) // Last 7 days
      .limit(50);

    // Get available products relevant to user's location and crops
    let productQuery = supabase
      .from("products")
      .select(
        "id, name, category, unit_price, unit_type, bulk_pricing, location"
      )
      .eq("is_active", true)
      .limit(20);

    if (userProfile.location) {
      productQuery = productQuery.or(
        `location.ilike.%${userProfile.location}%,location.is.null`
      );
    }

    const { data: availableProducts } = await productQuery;

    // Generate AI recommendations
    const recommendations = await generatePersonalizedRecommendations(
      userProfile,
      marketData || [],
      saccoData,
      availableProducts || []
    );

    // Store recommendations in database
    await storeUserRecommendations(userId, recommendations, "personalized");

    return recommendations;
  } catch (error) {
    console.error("Error in generateUserRecommendations:", error);
    throw error;
  }
}

/**
 * Detect and generate bulk purchase opportunities
 * @param {string} region - Geographic region
 * @returns {Promise<Object>} Bulk purchase opportunities
 */
async function getBulkPurchaseOpportunities(region = "All Regions") {
  try {
    // Get products with bulk pricing
    let productQuery = supabase
      .from("products")
      .select(
        `
                id,
                name,
                category,
                unit_price,
                unit_type,
                bulk_pricing,
                stock_quantity,
                location,
                wholesaler:users(id, name, location)
            `
      )
      .eq("is_active", true)
      .not("bulk_pricing", "is", null)
      .gt("stock_quantity", 0);

    if (region !== "All Regions") {
      productQuery = productQuery.or(
        `location.ilike.%${region}%,location.is.null`
      );
    }

    const { data: products, error: productsError } = await productQuery;

    if (productsError) {
      console.error("Error fetching products:", productsError);
      throw new Error("Failed to fetch products");
    }

    // Get active SACCO groups
    let saccoQuery = supabase
      .from("sacco_groups")
      .select("id, name, region, admin_id, member_limit");

    if (region !== "All Regions") {
      saccoQuery = saccoQuery.eq("region", region);
    }

    const { data: saccoGroups, error: saccoError } = await saccoQuery;

    if (saccoError) {
      console.error("Error fetching SACCO groups:", saccoError);
      throw new Error("Failed to fetch SACCO groups");
    }

    // Get member counts for SACCO groups
    const saccoGroupsWithStats = await Promise.all(
      (saccoGroups || []).map(async (sacco) => {
        const { count: memberCount } = await supabase
          .from("sacco_memberships")
          .select("*", { count: "exact", head: true })
          .eq("sacco_id", sacco.id)
          .eq("status", "active");

        const { count: activeBulkOrders } = await supabase
          .from("bulk_orders")
          .select("*", { count: "exact", head: true })
          .eq("sacco_id", sacco.id)
          .eq("status", "collecting");

        return {
          ...sacco,
          member_count: memberCount,
          active_bulk_orders: activeBulkOrders,
        };
      })
    );

    // Get current market data
    const { data: marketData } = await supabase
      .from("market_data")
      .select("*")
      .gte(
        "date",
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0]
      )
      .limit(50);

    // Use AI to detect opportunities
    const opportunities = await detectBulkPurchaseOpportunities(
      products || [],
      marketData || [],
      saccoGroupsWithStats,
      region
    );

    return opportunities;
  } catch (error) {
    console.error("Error in getBulkPurchaseOpportunities:", error);
    throw error;
  }
}

/**
 * Generate price alerts for a user
 * @param {string} userId - User ID
 * @param {Array} watchedProductIds - Product IDs user is watching
 * @returns {Promise<Object>} Price alerts
 */
async function generateUserPriceAlerts(userId, watchedProductIds = []) {
  try {
    // Get user profile
    const { data: userProfile, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (userError || !userProfile) {
      throw new Error("User not found");
    }

    // Get watched products or recommend products based on user's crops
    let watchedProducts = [];

    if (watchedProductIds.length > 0) {
      const { data: products } = await supabase
        .from("products")
        .select("id, name, category, unit_price, unit_type, stock_quantity")
        .in("id", watchedProductIds)
        .eq("is_active", true);

      watchedProducts = products || [];
    } else {
      // If no specific products watched, recommend based on user's crops
      let productQuery = supabase
        .from("products")
        .select("id, name, category, unit_price, unit_type, stock_quantity")
        .eq("is_active", true)
        .limit(10);

      if (userProfile.crops_grown && userProfile.crops_grown.length > 0) {
        const cropCategories = userProfile.crops_grown
          .map((crop) => `category.ilike.%${crop}%`)
          .join(",");
        productQuery = productQuery.or(cropCategories);
      }

      const { data: products } = await productQuery;
      watchedProducts = products || [];
    }

    // Get price history for these products
    const { data: priceHistory } = await supabase
      .from("market_data")
      .select("*")
      .gte(
        "date",
        new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0]
      ) // Last 90 days
      .limit(200);

    // Generate AI-powered price alerts
    const alerts = await generatePriceAlerts(
      userProfile,
      watchedProducts,
      priceHistory || []
    );

    // Store alerts as recommendations
    await storeUserRecommendations(userId, alerts, "price_alert");

    return alerts;
  } catch (error) {
    console.error("Error in generateUserPriceAlerts:", error);
    throw error;
  }
}

/**
 * Store user recommendations in the database
 * @param {string} userId - User ID
 * @param {Object} recommendationData - Recommendation data from AI
 * @param {string} type - Recommendation type
 * @returns {Promise<Object>} Stored recommendation
 */
async function storeUserRecommendations(userId, recommendationData, type) {
  try {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Expire in 7 days

    const { data, error } = await supabase
      .from("recommendations")
      .insert({
        user_id: userId,
        type: type,
        title: getRecommendationTitle(type),
        description:
          typeof recommendationData === "string"
            ? recommendationData
            : recommendationData.recommendations ||
              recommendationData.alerts ||
              JSON.stringify(recommendationData),
        data: recommendationData,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error storing recommendation:", error);
      throw new Error("Failed to store recommendation");
    }

    return data;
  } catch (error) {
    console.error("Error in storeUserRecommendations:", error);
    throw error;
  }
}

/**
 * Get recommendation title based on type
 * @param {string} type - Recommendation type
 * @returns {string} Title for the recommendation
 */
function getRecommendationTitle(type) {
  const titles = {
    personalized: "Personalized Farming Recommendations",
    price_alert: "Price Alerts & Optimal Timing",
    bulk_order: "Bulk Purchase Opportunity",
    market_opportunity: "Market Opportunity Alert",
    timing: "Optimal Purchase Timing",
  };

  return titles[type] || "Agricultural Recommendation";
}

/**
 * Get user's recommendations from database
 * @param {string} userId - User ID
 * @param {Object} filters - Filter options
 * @returns {Promise<Array>} User's recommendations
 */
async function getUserRecommendations(userId, filters = {}) {
  try {
    let query = supabase
      .from("recommendations")
      .select("*")
      .eq("user_id", userId)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (filters.type) {
      query = query.eq("type", filters.type);
    }

    if (filters.is_read !== undefined) {
      query = query.eq("is_read", filters.is_read);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching user recommendations:", error);
      throw new Error("Failed to fetch recommendations");
    }

    return data || [];
  } catch (error) {
    console.error("Error in getUserRecommendations:", error);
    throw error;
  }
}

/**
 * Mark recommendation as read
 * @param {string} recommendationId - Recommendation ID
 * @param {string} userId - User ID for authorization
 * @returns {Promise<Object>} Updated recommendation
 */
async function markRecommendationAsRead(recommendationId, userId) {
  try {
    const { data, error } = await supabase
      .from("recommendations")
      .update({ is_read: true })
      .eq("id", recommendationId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      console.error("Error marking recommendation as read:", error);
      throw new Error("Failed to update recommendation");
    }

    return data;
  } catch (error) {
    console.error("Error in markRecommendationAsRead:", error);
    throw error;
  }
}

module.exports = {
  collectMarketData,
  getMarketTrends,
  getDemandForecast,
  generateUserRecommendations,
  getBulkPurchaseOpportunities,
  generateUserPriceAlerts,
  getUserRecommendations,
  markRecommendationAsRead,
  storeUserRecommendations,
};

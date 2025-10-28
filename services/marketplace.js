const { supabase } = require("./supabase");

/**
 * Marketplace Service
 * Handles product catalog management, search, filtering, and inventory operations
 */

/**
 * Create a new product listing with AI-powered enhancements
 * @param {string} wholesalerId - ID of the wholesaler creating the product
 * @param {Object} productData - Product information
 * @param {boolean} useAI - Whether to use AI for product optimization
 * @returns {Object} Created product with ID and AI suggestions
 */
async function createProduct(wholesalerId, productData, useAI = true) {
  const {
    name,
    description,
    category,
    unit_price,
    bulk_pricing = {},
    stock_quantity = 0,
    unit_type,
    location,
    image_url,
  } = productData;

  // Validate required fields
  if (!name || !unit_price || !unit_type) {
    throw new Error(
      "Missing required fields: name, unit_price, and unit_type are required"
    );
  }

  // Validate unit_price is positive
  if (unit_price <= 0) {
    throw new Error("Unit price must be greater than 0");
  }

  // Validate stock_quantity is non-negative
  if (stock_quantity < 0) {
    throw new Error("Stock quantity cannot be negative");
  }

  // Validate bulk_pricing format if provided
  if (bulk_pricing && typeof bulk_pricing === "object") {
    for (const [quantity, price] of Object.entries(bulk_pricing)) {
      if (isNaN(quantity) || isNaN(price) || quantity <= 0 || price <= 0) {
        throw new Error("Bulk pricing must contain valid quantity-price pairs");
      }
    }
  }

  let aiSuggestions = null;
  let optimizedData = { ...productData };

  // AI-powered product optimization
  if (useAI) {
    try {
      const { generateProductOptimizations } = require("./gemini");
      aiSuggestions = await generateProductOptimizations(productData, location);

      // Apply AI suggestions if available
      if (aiSuggestions.optimized_description && !description) {
        optimizedData.description = aiSuggestions.optimized_description;
      }
      if (
        aiSuggestions.suggested_bulk_pricing &&
        Object.keys(bulk_pricing).length === 0
      ) {
        optimizedData.bulk_pricing = aiSuggestions.suggested_bulk_pricing;
      }
      if (aiSuggestions.optimized_category && !category) {
        optimizedData.category = aiSuggestions.optimized_category;
      }
    } catch (error) {
      console.warn(
        "AI optimization failed, proceeding without:",
        error.message
      );
    }
  }

  try {
    const { data, error } = await supabase
      .from("products")
      .insert([
        {
          wholesaler_id: wholesalerId,
          name: optimizedData.name.trim(),
          description: optimizedData.description?.trim(),
          category: optimizedData.category?.trim(),
          unit_price: parseFloat(optimizedData.unit_price),
          bulk_pricing: optimizedData.bulk_pricing,
          stock_quantity: parseInt(optimizedData.stock_quantity),
          unit_type: optimizedData.unit_type.trim(),
          location: optimizedData.location?.trim(),
          image_url: optimizedData.image_url?.trim(),
          is_active: true,
        },
      ])
      .select(
        `
        *,
        wholesaler:users!products_wholesaler_id_fkey(id, name, location, user_type)
      `
      )
      .single();

    if (error) {
      console.error("Error creating product:", error);
      throw new Error("Failed to create product");
    }

    // Return product with AI suggestions
    return {
      ...data,
      ai_suggestions: aiSuggestions,
      ai_optimized: useAI && aiSuggestions !== null,
    };
  } catch (error) {
    console.error("Error in createProduct:", error);
    throw error;
  }
}

/**
 * Update an existing product
 * @param {string} productId - ID of the product to update
 * @param {string} wholesalerId - ID of the wholesaler (for authorization)
 * @param {Object} updates - Fields to update
 * @returns {Object} Updated product
 */
async function updateProduct(productId, wholesalerId, updates) {
  // Validate that the product belongs to the wholesaler
  const { data: existingProduct, error: fetchError } = await supabase
    .from("products")
    .select("id, wholesaler_id")
    .eq("id", productId)
    .single();

  if (fetchError || !existingProduct) {
    throw new Error("Product not found");
  }

  if (existingProduct.wholesaler_id !== wholesalerId) {
    throw new Error("Unauthorized: You can only update your own products");
  }

  // Validate updates
  const allowedFields = [
    "name",
    "description",
    "category",
    "unit_price",
    "bulk_pricing",
    "stock_quantity",
    "unit_type",
    "location",
    "image_url",
    "is_active",
  ];

  const validUpdates = {};
  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key) && value !== undefined) {
      if (key === "unit_price" && value <= 0) {
        throw new Error("Unit price must be greater than 0");
      }
      if (key === "stock_quantity" && value < 0) {
        throw new Error("Stock quantity cannot be negative");
      }
      if (key === "bulk_pricing" && value && typeof value === "object") {
        for (const [quantity, price] of Object.entries(value)) {
          if (isNaN(quantity) || isNaN(price) || quantity <= 0 || price <= 0) {
            throw new Error(
              "Bulk pricing must contain valid quantity-price pairs"
            );
          }
        }
      }
      validUpdates[key] = value;
    }
  }

  if (Object.keys(validUpdates).length === 0) {
    throw new Error("No valid fields to update");
  }

  try {
    const { data, error } = await supabase
      .from("products")
      .update(validUpdates)
      .eq("id", productId)
      .select(
        `
        *,
        wholesaler:users!products_wholesaler_id_fkey(id, name, location, user_type)
      `
      )
      .single();

    if (error) {
      console.error("Error updating product:", error);
      throw new Error("Failed to update product");
    }

    return data;
  } catch (error) {
    console.error("Error in updateProduct:", error);
    throw error;
  }
}

/**
 * Get products with filtering and search
 * @param {Object} filters - Search and filter criteria
 * @returns {Array} Array of products matching criteria
 */
async function getProducts(filters = {}) {
  const {
    search,
    category,
    location,
    min_price,
    max_price,
    wholesaler_id,
    is_active = true,
    limit = 50,
    offset = 0,
    sort_by = "created_at",
    sort_order = "desc",
  } = filters;

  try {
    let query = supabase.from("products").select(`
        *,
        wholesaler:users!products_wholesaler_id_fkey(id, name, location, user_type)
      `);

    // Apply filters
    if (is_active !== undefined) {
      query = query.eq("is_active", is_active);
    }

    if (search) {
      query = query.or(
        `name.ilike.%${search}%,description.ilike.%${search}%,category.ilike.%${search}%`
      );
    }

    if (category) {
      query = query.ilike("category", `%${category}%`);
    }

    if (location) {
      query = query.ilike("location", `%${location}%`);
    }

    if (min_price) {
      query = query.gte("unit_price", parseFloat(min_price));
    }

    if (max_price) {
      query = query.lte("unit_price", parseFloat(max_price));
    }

    if (wholesaler_id) {
      query = query.eq("wholesaler_id", wholesaler_id);
    }

    // Apply sorting
    const validSortFields = [
      "created_at",
      "name",
      "unit_price",
      "stock_quantity",
    ];
    const sortField = validSortFields.includes(sort_by)
      ? sort_by
      : "created_at";
    const sortDirection = sort_order === "asc" ? true : false;

    query = query.order(sortField, { ascending: sortDirection });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching products:", error);
      throw new Error("Failed to fetch products");
    }

    return data || [];
  } catch (error) {
    console.error("Error in getProducts:", error);
    throw error;
  }
}

/**
 * Get a single product by ID
 * @param {string} productId - Product ID
 * @returns {Object} Product details
 */
async function getProductById(productId) {
  try {
    const { data, error } = await supabase
      .from("products")
      .select(
        `
        *,
        wholesaler:users!products_wholesaler_id_fkey(id, name, location, user_type, phone, email)
      `
      )
      .eq("id", productId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        throw new Error("Product not found");
      }
      console.error("Error fetching product:", error);
      throw new Error("Failed to fetch product");
    }

    return data;
  } catch (error) {
    console.error("Error in getProductById:", error);
    throw error;
  }
}

/**
 * Calculate bulk price for a product based on quantity
 * @param {string} productId - Product ID
 * @param {number} quantity - Desired quantity
 * @returns {Object} Price calculation details
 */
async function calculateBulkPrice(productId, quantity) {
  const product = await getProductById(productId);

  if (!product) {
    throw new Error("Product not found");
  }

  if (quantity <= 0) {
    throw new Error("Quantity must be greater than 0");
  }

  let unitPrice = product.unit_price;
  let appliedTier = null;

  // Check if bulk pricing is available
  if (product.bulk_pricing && typeof product.bulk_pricing === "object") {
    const tiers = Object.entries(product.bulk_pricing)
      .map(([qty, price]) => ({
        quantity: parseInt(qty),
        price: parseFloat(price),
      }))
      .sort((a, b) => b.quantity - a.quantity); // Sort by quantity descending

    // Find the highest tier that the quantity qualifies for
    for (const tier of tiers) {
      if (quantity >= tier.quantity) {
        unitPrice = tier.price;
        appliedTier = tier;
        break;
      }
    }
  }

  const totalAmount = unitPrice * quantity;
  const savings = (product.unit_price - unitPrice) * quantity;

  return {
    product_id: productId,
    quantity,
    unit_price: unitPrice,
    total_amount: totalAmount,
    original_unit_price: product.unit_price,
    savings: Math.max(0, savings),
    applied_tier: appliedTier,
    available_tiers: product.bulk_pricing || {},
  };
}

/**
 * Get bulk pricing tiers for a product
 * @param {string} productId - Product ID
 * @returns {Object} Bulk pricing information
 */
async function getBulkPricingTiers(productId) {
  const product = await getProductById(productId);

  if (!product) {
    throw new Error("Product not found");
  }

  const tiers = [];
  if (product.bulk_pricing && typeof product.bulk_pricing === "object") {
    for (const [quantity, price] of Object.entries(product.bulk_pricing)) {
      const savings =
        (product.unit_price - parseFloat(price)) * parseInt(quantity);
      tiers.push({
        min_quantity: parseInt(quantity),
        unit_price: parseFloat(price),
        savings_per_unit: product.unit_price - parseFloat(price),
        total_savings: Math.max(0, savings),
      });
    }

    // Sort tiers by minimum quantity
    tiers.sort((a, b) => a.min_quantity - b.min_quantity);
  }

  return {
    product_id: productId,
    product_name: product.name,
    regular_price: product.unit_price,
    unit_type: product.unit_type,
    bulk_tiers: tiers,
    has_bulk_pricing: tiers.length > 0,
  };
}

/**
 * Update product stock quantity
 * @param {string} productId - Product ID
 * @param {number} newQuantity - New stock quantity
 * @param {string} wholesalerId - Wholesaler ID for authorization
 * @returns {Object} Updated product
 */
async function updateStock(productId, newQuantity, wholesalerId) {
  if (newQuantity < 0) {
    throw new Error("Stock quantity cannot be negative");
  }

  return await updateProduct(productId, wholesalerId, {
    stock_quantity: parseInt(newQuantity),
  });
}

/**
 * Reduce product stock (for order processing)
 * @param {string} productId - Product ID
 * @param {number} quantity - Quantity to reduce
 * @returns {Object} Updated product
 */
async function reduceStock(productId, quantity) {
  const product = await getProductById(productId);

  if (!product) {
    throw new Error("Product not found");
  }

  if (product.stock_quantity < quantity) {
    throw new Error("Insufficient stock available");
  }

  const newQuantity = product.stock_quantity - quantity;

  try {
    const { data, error } = await supabase
      .from("products")
      .update({ stock_quantity: newQuantity })
      .eq("id", productId)
      .select()
      .single();

    if (error) {
      console.error("Error reducing stock:", error);
      throw new Error("Failed to update stock");
    }

    return data;
  } catch (error) {
    console.error("Error in reduceStock:", error);
    throw error;
  }
}

/**
 * Get products by category
 * @param {string} category - Product category
 * @param {Object} options - Additional options
 * @returns {Array} Products in the category
 */
async function getProductsByCategory(category, options = {}) {
  return await getProducts({
    category,
    ...options,
  });
}

/**
 * Get products by location
 * @param {string} location - Location filter
 * @param {Object} options - Additional options
 * @returns {Array} Products in the location
 */
async function getProductsByLocation(location, options = {}) {
  return await getProducts({
    location,
    ...options,
  });
}

/**
 * Search products by name or description
 * @param {string} searchTerm - Search term
 * @param {Object} options - Additional options
 * @returns {Array} Matching products
 */
async function searchProducts(searchTerm, options = {}) {
  return await getProducts({
    search: searchTerm,
    ...options,
  });
}

/**
 * Get low stock products for a wholesaler
 * @param {string} wholesalerId - Wholesaler ID
 * @param {number} threshold - Stock threshold (default: 10)
 * @returns {Array} Products with low stock
 */
async function getLowStockProducts(wholesalerId, threshold = 10) {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("wholesaler_id", wholesalerId)
      .eq("is_active", true)
      .lte("stock_quantity", threshold)
      .order("stock_quantity", { ascending: true });

    if (error) {
      console.error("Error fetching low stock products:", error);
      throw new Error("Failed to fetch low stock products");
    }

    return data || [];
  } catch (error) {
    console.error("Error in getLowStockProducts:", error);
    throw error;
  }
}

module.exports = {
  createProduct,
  updateProduct,
  getProducts,
  getProductById,
  calculateBulkPrice,
  getBulkPricingTiers,
  updateStock,
  reduceStock,
  getProductsByCategory,
  getProductsByLocation,
  searchProducts,
  getLowStockProducts,
};

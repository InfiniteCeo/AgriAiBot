const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  createProduct,
  updateProduct,
  getProducts,
  getProductById,
  calculateBulkPrice,
  getBulkPricingTiers,
  updateStock,
  getProductsByCategory,
  getProductsByLocation,
  searchProducts,
  getLowStockProducts
} = require('../services/marketplace');

/**
 * Marketplace Routes
 * Handles product catalog management, search, filtering, and inventory operations
 */

/**
 * GET /api/marketplace/products
 * Get products with filtering and search
 */
router.get('/products', async (req, res) => {
  try {
    const filters = {
      search: req.query.search,
      category: req.query.category,
      location: req.query.location,
      min_price: req.query.min_price,
      max_price: req.query.max_price,
      wholesaler_id: req.query.wholesaler_id,
      is_active: req.query.is_active !== undefined ? req.query.is_active === 'true' : true,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0,
      sort_by: req.query.sort_by || 'created_at',
      sort_order: req.query.sort_order || 'desc'
    };

    const products = await getProducts(filters);
    
    res.json({
      success: true,
      data: products,
      count: products.length,
      filters: filters
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
      error: error.message
    });
  }
});

/**
 * GET /api/marketplace/products/search
 * Search products by name or description
 */
router.get('/products/search', async (req, res) => {
  try {
    const { q: searchTerm, ...options } = req.query;
    
    if (!searchTerm) {
      return res.status(400).json({
        success: false,
        message: 'Search term is required'
      });
    }

    const products = await searchProducts(searchTerm, {
      limit: parseInt(options.limit) || 20,
      offset: parseInt(options.offset) || 0,
      category: options.category,
      location: options.location,
      min_price: options.min_price,
      max_price: options.max_price
    });

    res.json({
      success: true,
      data: products,
      count: products.length,
      search_term: searchTerm
    });
  } catch (error) {
    console.error('Error searching products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search products',
      error: error.message
    });
  }
});

/**
 * GET /api/marketplace/products/category/:category
 * Get products by category
 */
router.get('/products/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const options = {
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0,
      location: req.query.location,
      min_price: req.query.min_price,
      max_price: req.query.max_price,
      sort_by: req.query.sort_by || 'created_at',
      sort_order: req.query.sort_order || 'desc'
    };

    const products = await getProductsByCategory(category, options);

    res.json({
      success: true,
      data: products,
      count: products.length,
      category: category
    });
  } catch (error) {
    console.error('Error fetching products by category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products by category',
      error: error.message
    });
  }
});

/**
 * GET /api/marketplace/products/location/:location
 * Get products by location
 */
router.get('/products/location/:location', async (req, res) => {
  try {
    const { location } = req.params;
    const options = {
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0,
      category: req.query.category,
      min_price: req.query.min_price,
      max_price: req.query.max_price,
      sort_by: req.query.sort_by || 'created_at',
      sort_order: req.query.sort_order || 'desc'
    };

    const products = await getProductsByLocation(location, options);

    res.json({
      success: true,
      data: products,
      count: products.length,
      location: location
    });
  } catch (error) {
    console.error('Error fetching products by location:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products by location',
      error: error.message
    });
  }
});

/**
 * GET /api/marketplace/products/:id
 * Get a single product by ID
 */
router.get('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const product = await getProductById(id);

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    const statusCode = error.message === 'Product not found' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/marketplace/products/:id/bulk-pricing
 * Get bulk pricing tiers for a product
 */
router.get('/products/:id/bulk-pricing', async (req, res) => {
  try {
    const { id } = req.params;
    const pricingInfo = await getBulkPricingTiers(id);

    res.json({
      success: true,
      data: pricingInfo
    });
  } catch (error) {
    console.error('Error fetching bulk pricing:', error);
    const statusCode = error.message === 'Product not found' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/marketplace/products/:id/calculate-price
 * Calculate bulk price for a specific quantity
 */
router.post('/products/:id/calculate-price', async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid quantity is required'
      });
    }

    const priceCalculation = await calculateBulkPrice(id, parseInt(quantity));

    res.json({
      success: true,
      data: priceCalculation
    });
  } catch (error) {
    console.error('Error calculating bulk price:', error);
    const statusCode = error.message === 'Product not found' ? 404 : 400;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/marketplace/products
 * Create a new product (wholesalers only)
 */
router.post('/products', authenticateToken, async (req, res) => {
  try {
    // Check if user is a wholesaler
    if (req.user.user_type !== 'wholesaler') {
      return res.status(403).json({
        success: false,
        message: 'Only wholesalers can create products'
      });
    }

    const productData = req.body;
    const product = await createProduct(req.user.id, productData);

    res.status(201).json({
      success: true,
      data: product,
      message: 'Product created successfully'
    });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * PUT /api/marketplace/products/:id
 * Update a product (wholesaler only, own products)
 */
router.put('/products/:id', authenticateToken, async (req, res) => {
  try {
    // Check if user is a wholesaler
    if (req.user.user_type !== 'wholesaler') {
      return res.status(403).json({
        success: false,
        message: 'Only wholesalers can update products'
      });
    }

    const { id } = req.params;
    const updates = req.body;
    
    const product = await updateProduct(id, req.user.id, updates);

    res.json({
      success: true,
      data: product,
      message: 'Product updated successfully'
    });
  } catch (error) {
    console.error('Error updating product:', error);
    const statusCode = error.message.includes('not found') ? 404 : 
                      error.message.includes('Unauthorized') ? 403 : 400;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * PUT /api/marketplace/products/:id/stock
 * Update product stock quantity (wholesaler only)
 */
router.put('/products/:id/stock', authenticateToken, async (req, res) => {
  try {
    // Check if user is a wholesaler
    if (req.user.user_type !== 'wholesaler') {
      return res.status(403).json({
        success: false,
        message: 'Only wholesalers can update stock'
      });
    }

    const { id } = req.params;
    const { quantity } = req.body;

    if (quantity === undefined || quantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid stock quantity is required'
      });
    }

    const product = await updateStock(id, parseInt(quantity), req.user.id);

    res.json({
      success: true,
      data: product,
      message: 'Stock updated successfully'
    });
  } catch (error) {
    console.error('Error updating stock:', error);
    const statusCode = error.message.includes('not found') ? 404 : 
                      error.message.includes('Unauthorized') ? 403 : 400;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/marketplace/my-products
 * Get products for the authenticated wholesaler
 */
router.get('/my-products', authenticateToken, async (req, res) => {
  try {
    // Check if user is a wholesaler
    if (req.user.user_type !== 'wholesaler') {
      return res.status(403).json({
        success: false,
        message: 'Only wholesalers can view their products'
      });
    }

    const filters = {
      wholesaler_id: req.user.id,
      is_active: req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0,
      sort_by: req.query.sort_by || 'created_at',
      sort_order: req.query.sort_order || 'desc'
    };

    const products = await getProducts(filters);

    res.json({
      success: true,
      data: products,
      count: products.length
    });
  } catch (error) {
    console.error('Error fetching wholesaler products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your products',
      error: error.message
    });
  }
});

/**
 * GET /api/marketplace/my-products/low-stock
 * Get low stock products for the authenticated wholesaler
 */
router.get('/my-products/low-stock', authenticateToken, async (req, res) => {
  try {
    // Check if user is a wholesaler
    if (req.user.user_type !== 'wholesaler') {
      return res.status(403).json({
        success: false,
        message: 'Only wholesalers can view low stock products'
      });
    }

    const threshold = parseInt(req.query.threshold) || 10;
    const products = await getLowStockProducts(req.user.id, threshold);

    res.json({
      success: true,
      data: products,
      count: products.length,
      threshold: threshold
    });
  } catch (error) {
    console.error('Error fetching low stock products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch low stock products',
      error: error.message
    });
  }
});

/**
 * GET /api/marketplace/ai/dashboard-insights
 * Get AI-powered dashboard insights for wholesaler
 */
router.get('/ai/dashboard-insights', authenticateToken, async (req, res) => {
  try {
    if (req.user.user_type !== 'wholesaler') {
      return res.status(403).json({
        success: false,
        message: 'Only wholesalers can access AI dashboard insights'
      });
    }

    const { getSellerDashboardInsights } = require('../services/sellerAI');
    const insights = await getSellerDashboardInsights(req.user.id);

    res.json(insights);
  } catch (error) {
    console.error('Error fetching AI dashboard insights:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch AI dashboard insights',
      error: error.message
    });
  }
});

/**
 * GET /api/marketplace/ai/product-optimizations
 * Get AI-powered product optimization suggestions
 */
router.get('/ai/product-optimizations', authenticateToken, async (req, res) => {
  try {
    if (req.user.user_type !== 'wholesaler') {
      return res.status(403).json({
        success: false,
        message: 'Only wholesalers can access product optimizations'
      });
    }

    const { getProductOptimizations } = require('../services/sellerAI');
    const productId = req.query.product_id;
    const optimizations = await getProductOptimizations(req.user.id, productId);

    res.json(optimizations);
  } catch (error) {
    console.error('Error fetching product optimizations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product optimizations',
      error: error.message
    });
  }
});

/**
 * GET /api/marketplace/ai/competitive-analysis
 * Get AI-powered competitive analysis
 */
router.get('/ai/competitive-analysis', authenticateToken, async (req, res) => {
  try {
    if (req.user.user_type !== 'wholesaler') {
      return res.status(403).json({
        success: false,
        message: 'Only wholesalers can access competitive analysis'
      });
    }

    const { getCompetitiveAnalysis } = require('../services/sellerAI');
    const region = req.query.region;
    const analysis = await getCompetitiveAnalysis(req.user.id, region);

    res.json(analysis);
  } catch (error) {
    console.error('Error fetching competitive analysis:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch competitive analysis',
      error: error.message
    });
  }
});

/**
 * GET /api/marketplace/ai/sales-insights
 * Get AI-powered sales performance insights
 */
router.get('/ai/sales-insights', authenticateToken, async (req, res) => {
  try {
    if (req.user.user_type !== 'wholesaler') {
      return res.status(403).json({
        success: false,
        message: 'Only wholesalers can access sales insights'
      });
    }

    const { getSalesInsights } = require('../services/sellerAI');
    const timeframe = req.query.timeframe || '30d';
    const insights = await getSalesInsights(req.user.id, timeframe);

    res.json(insights);
  } catch (error) {
    console.error('Error fetching sales insights:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sales insights',
      error: error.message
    });
  }
});

/**
 * GET /api/marketplace/ai/inventory-recommendations
 * Get AI-powered inventory management recommendations
 */
router.get('/ai/inventory-recommendations', authenticateToken, async (req, res) => {
  try {
    if (req.user.user_type !== 'wholesaler') {
      return res.status(403).json({
        success: false,
        message: 'Only wholesalers can access inventory recommendations'
      });
    }

    const { getInventoryRecommendations } = require('../services/sellerAI');
    const recommendations = await getInventoryRecommendations(req.user.id);

    res.json(recommendations);
  } catch (error) {
    console.error('Error fetching inventory recommendations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory recommendations',
      error: error.message
    });
  }
});

/**
 * POST /api/marketplace/ai/apply-suggestions
 * Apply AI suggestions to a product
 */
router.post('/ai/apply-suggestions', authenticateToken, async (req, res) => {
  try {
    if (req.user.user_type !== 'wholesaler') {
      return res.status(403).json({
        success: false,
        message: 'Only wholesalers can apply AI suggestions'
      });
    }

    const { product_id, suggestions } = req.body;

    if (!product_id || !suggestions) {
      return res.status(400).json({
        success: false,
        message: 'Product ID and suggestions are required'
      });
    }

    const { applyAISuggestions } = require('../services/sellerAI');
    const result = await applyAISuggestions(req.user.id, product_id, suggestions);

    res.json(result);
  } catch (error) {
    console.error('Error applying AI suggestions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to apply AI suggestions',
      error: error.message
    });
  }
});

/**
 * POST /api/marketplace/products/ai-optimize
 * Create product with AI optimization
 */
router.post('/products/ai-optimize', authenticateToken, async (req, res) => {
  try {
    // Check if user is a wholesaler
    if (req.user.user_type !== 'wholesaler') {
      return res.status(403).json({
        success: false,
        message: 'Only wholesalers can create products'
      });
    }

    const productData = req.body;
    const useAI = req.body.use_ai !== false; // Default to true

    const product = await createProduct(req.user.id, productData, useAI);

    res.status(201).json({
      success: true,
      data: product,
      message: useAI ? 'Product created with AI optimization' : 'Product created successfully'
    });
  } catch (error) {
    console.error('Error creating AI-optimized product:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
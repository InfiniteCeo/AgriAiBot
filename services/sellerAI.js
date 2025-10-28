const { supabase } = require('./supabase');
const { 
    generateProductOptimizations,
    generateInventoryInsights,
    generateCompetitiveAnalysis,
    generateSalesInsights
} = require('./gemini');

/**
 * AI-Powered Seller Service
 * Provides intelligent assistance for wholesalers managing their products and sales
 */

/**
 * Get AI-powered dashboard insights for a seller
 * @param {string} sellerId - Seller's user ID
 * @returns {Promise<Object>} Comprehensive dashboard insights
 */
async function getSellerDashboardInsights(sellerId) {
    try {
        // Get seller's products
        const { data: products, error: productsError } = await supabase
            .from('products')
            .select('*')
            .eq('wholesaler_id', sellerId)
            .eq('is_active', true);

        if (productsError) throw productsError;

        // Get recent orders
        const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select(`
                *,
                product:products(name, category),
                buyer:users!orders_buyer_id_fkey(name, location)
            `)
            .eq('products.wholesaler_id', sellerId)
            .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
            .order('created_at', { ascending: false });

        if (ordersError) throw ordersError;

        // Get market data for comparison
        const { data: marketData, error: marketError } = await supabase
            .from('market_data')
            .select('*')
            .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

        if (marketError) throw marketError;

        // Calculate sales metrics
        const salesMetrics = calculateSalesMetrics(orders, products);

        // Generate AI insights
        const inventoryInsights = await generateInventoryInsights(
            products, 
            orders, 
            marketData || []
        );

        // Get low stock alerts
        const lowStockProducts = products.filter(p => p.stock_quantity <= 10);

        // Get top performing products
        const topProducts = getTopPerformingProducts(orders, products);

        return {
            success: true,
            data: {
                overview: {
                    total_products: products.length,
                    active_products: products.filter(p => p.is_active).length,
                    low_stock_count: lowStockProducts.length,
                    total_orders: orders.length,
                    ...salesMetrics
                },
                ai_insights: inventoryInsights,
                low_stock_alerts: lowStockProducts.slice(0, 5),
                top_products: topProducts.slice(0, 5),
                recent_orders: orders.slice(0, 10),
                generated_at: new Date().toISOString()
            }
        };
    } catch (error) {
        console.error('Error getting seller dashboard insights:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Get AI-powered product optimization suggestions
 * @param {string} sellerId - Seller's user ID
 * @param {string} productId - Product ID (optional, for specific product)
 * @returns {Promise<Object>} Product optimization suggestions
 */
async function getProductOptimizations(sellerId, productId = null) {
    try {
        let query = supabase
            .from('products')
            .select('*')
            .eq('wholesaler_id', sellerId);

        if (productId) {
            query = query.eq('id', productId);
        }

        const { data: products, error } = await query;
        if (error) throw error;

        if (!products || products.length === 0) {
            throw new Error('No products found');
        }

        const optimizations = [];

        for (const product of products.slice(0, 5)) { // Limit to 5 products for performance
            try {
                const optimization = await generateProductOptimizations(product);
                optimizations.push({
                    product_id: product.id,
                    product_name: product.name,
                    ...optimization
                });
            } catch (error) {
                console.warn(`Failed to optimize product ${product.id}:`, error.message);
            }
        }

        return {
            success: true,
            data: {
                optimizations,
                total_products: products.length,
                optimized_count: optimizations.length,
                generated_at: new Date().toISOString()
            }
        };
    } catch (error) {
        console.error('Error getting product optimizations:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Get AI-powered competitive analysis
 * @param {string} sellerId - Seller's user ID
 * @param {string} region - Geographic region for analysis
 * @returns {Promise<Object>} Competitive analysis
 */
async function getCompetitiveAnalysis(sellerId, region = null) {
    try {
        // Get seller's profile and products
        const { data: seller, error: sellerError } = await supabase
            .from('users')
            .select('*')
            .eq('id', sellerId)
            .single();

        if (sellerError) throw sellerError;

        const { data: sellerProducts, error: productsError } = await supabase
            .from('products')
            .select('*')
            .eq('wholesaler_id', sellerId)
            .eq('is_active', true);

        if (productsError) throw productsError;

        // Get competitor products in same categories and region
        const categories = [...new Set(sellerProducts.map(p => p.category).filter(Boolean))];
        const searchRegion = region || seller.location;

        let competitorQuery = supabase
            .from('products')
            .select(`
                *,
                wholesaler:users!products_wholesaler_id_fkey(name, location)
            `)
            .neq('wholesaler_id', sellerId)
            .eq('is_active', true);

        if (categories.length > 0) {
            competitorQuery = competitorQuery.in('category', categories);
        }

        if (searchRegion) {
            competitorQuery = competitorQuery.ilike('location', `%${searchRegion}%`);
        }

        const { data: competitorProducts, error: competitorError } = await competitorQuery
            .limit(50);

        if (competitorError) throw competitorError;

        // Prepare seller profile for analysis
        const sellerProfile = {
            id: sellerId,
            location: seller.location,
            products: sellerProducts,
            categories: categories,
            price_range: calculatePriceRange(sellerProducts)
        };

        // Generate competitive analysis
        const analysis = await generateCompetitiveAnalysis(
            sellerProfile,
            competitorProducts || [],
            searchRegion
        );

        return {
            success: true,
            data: {
                ...analysis,
                seller_products_count: sellerProducts.length,
                competitors_analyzed: competitorProducts?.length || 0,
                categories_analyzed: categories,
                region: searchRegion
            }
        };
    } catch (error) {
        console.error('Error getting competitive analysis:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Get AI-powered sales performance insights
 * @param {string} sellerId - Seller's user ID
 * @param {string} timeframe - Analysis timeframe (30d, 90d, 1y)
 * @returns {Promise<Object>} Sales performance insights
 */
async function getSalesInsights(sellerId, timeframe = '30d') {
    try {
        // Calculate date range
        const days = timeframe === '90d' ? 90 : timeframe === '1y' ? 365 : 30;
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        // Get seller's products
        const { data: products, error: productsError } = await supabase
            .from('products')
            .select('*')
            .eq('wholesaler_id', sellerId);

        if (productsError) throw productsError;

        // Get orders for the timeframe
        const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select(`
                *,
                product:products!inner(name, category, wholesaler_id)
            `)
            .eq('products.wholesaler_id', sellerId)
            .gte('created_at', startDate.toISOString())
            .order('created_at', { ascending: false });

        if (ordersError) throw ordersError;

        // Calculate comprehensive sales data
        const salesData = calculateComprehensiveSalesData(orders, products, timeframe);

        // Generate AI insights
        const insights = await generateSalesInsights(salesData, products, timeframe);

        return {
            success: true,
            data: {
                ...insights,
                sales_metrics: salesData,
                timeframe: timeframe,
                products_count: products.length,
                orders_count: orders.length
            }
        };
    } catch (error) {
        console.error('Error getting sales insights:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Get AI-powered inventory recommendations
 * @param {string} sellerId - Seller's user ID
 * @returns {Promise<Object>} Inventory recommendations
 */
async function getInventoryRecommendations(sellerId) {
    try {
        // Get current inventory
        const { data: products, error: productsError } = await supabase
            .from('products')
            .select('*')
            .eq('wholesaler_id', sellerId)
            .order('stock_quantity', { ascending: true });

        if (productsError) throw productsError;

        // Get recent sales velocity
        const { data: recentOrders, error: ordersError } = await supabase
            .from('orders')
            .select(`
                *,
                product:products!inner(name, category, wholesaler_id)
            `)
            .eq('products.wholesaler_id', sellerId)
            .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

        if (ordersError) throw ordersError;

        // Calculate inventory metrics
        const inventoryMetrics = calculateInventoryMetrics(products, recentOrders);

        // Generate recommendations
        const recommendations = {
            critical_restock: products.filter(p => p.stock_quantity <= 5),
            low_stock_warning: products.filter(p => p.stock_quantity > 5 && p.stock_quantity <= 20),
            overstock_items: identifyOverstockItems(products, recentOrders),
            fast_movers: identifyFastMovers(products, recentOrders),
            slow_movers: identifySlowMovers(products, recentOrders),
            seasonal_prep: getSeasonalPreparationItems(products),
            ...inventoryMetrics
        };

        return {
            success: true,
            data: {
                recommendations,
                total_products: products.length,
                total_stock_value: products.reduce((sum, p) => sum + (p.unit_price * p.stock_quantity), 0),
                generated_at: new Date().toISOString()
            }
        };
    } catch (error) {
        console.error('Error getting inventory recommendations:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Apply AI suggestions to a product
 * @param {string} sellerId - Seller's user ID
 * @param {string} productId - Product ID
 * @param {Object} suggestions - AI suggestions to apply
 * @returns {Promise<Object>} Updated product
 */
async function applyAISuggestions(sellerId, productId, suggestions) {
    try {
        // Verify product ownership
        const { data: product, error: productError } = await supabase
            .from('products')
            .select('*')
            .eq('id', productId)
            .eq('wholesaler_id', sellerId)
            .single();

        if (productError || !product) {
            throw new Error('Product not found or access denied');
        }

        // Prepare updates based on suggestions
        const updates = {};

        if (suggestions.optimized_description) {
            updates.description = suggestions.optimized_description;
        }

        if (suggestions.suggested_bulk_pricing && Object.keys(suggestions.suggested_bulk_pricing).length > 0) {
            updates.bulk_pricing = suggestions.suggested_bulk_pricing;
        }

        if (suggestions.optimized_category) {
            updates.category = suggestions.optimized_category;
        }

        if (suggestions.suggested_price) {
            updates.unit_price = parseFloat(suggestions.suggested_price);
        }

        // Apply updates
        const { data: updatedProduct, error: updateError } = await supabase
            .from('products')
            .update(updates)
            .eq('id', productId)
            .select('*')
            .single();

        if (updateError) throw updateError;

        return {
            success: true,
            data: {
                product: updatedProduct,
                applied_suggestions: Object.keys(updates),
                updated_at: new Date().toISOString()
            }
        };
    } catch (error) {
        console.error('Error applying AI suggestions:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Helper functions

function calculateSalesMetrics(orders, products) {
    const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0);
    const avgOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;
    
    const ordersByStatus = orders.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
    }, {});

    return {
        total_revenue: totalRevenue,
        avg_order_value: avgOrderValue,
        orders_by_status: ordersByStatus,
        conversion_rate: products.length > 0 ? (orders.length / products.length) * 100 : 0
    };
}

function getTopPerformingProducts(orders, products) {
    const productSales = orders.reduce((acc, order) => {
        const productId = order.product_id;
        if (!acc[productId]) {
            acc[productId] = {
                product_id: productId,
                units_sold: 0,
                revenue: 0,
                orders_count: 0
            };
        }
        acc[productId].units_sold += order.quantity;
        acc[productId].revenue += parseFloat(order.total_amount);
        acc[productId].orders_count += 1;
        return acc;
    }, {});

    return Object.values(productSales)
        .map(sale => {
            const product = products.find(p => p.id === sale.product_id);
            return {
                ...sale,
                product_name: product?.name || 'Unknown',
                category: product?.category || 'Unknown'
            };
        })
        .sort((a, b) => b.revenue - a.revenue);
}

function calculatePriceRange(products) {
    if (products.length === 0) return 'No products';
    
    const prices = products.map(p => p.unit_price).sort((a, b) => a - b);
    const min = prices[0];
    const max = prices[prices.length - 1];
    
    return `KES ${min} - ${max}`;
}

function calculateComprehensiveSalesData(orders, products, timeframe) {
    const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0);
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Calculate top and low performers
    const productPerformance = orders.reduce((acc, order) => {
        const productId = order.product_id;
        if (!acc[productId]) {
            const product = products.find(p => p.id === productId);
            acc[productId] = {
                name: product?.name || 'Unknown',
                category: product?.category || 'Unknown',
                units_sold: 0,
                revenue: 0
            };
        }
        acc[productId].units_sold += order.quantity;
        acc[productId].revenue += parseFloat(order.total_amount);
        return acc;
    }, {});

    const sortedProducts = Object.values(productPerformance).sort((a, b) => b.revenue - a.revenue);
    const topProducts = sortedProducts.slice(0, 5);
    const lowPerformers = sortedProducts.slice(-5).reverse();

    // Calculate category performance
    const categoryRevenue = orders.reduce((acc, order) => {
        const product = products.find(p => p.id === order.product_id);
        const category = product?.category || 'Unknown';
        acc[category] = (acc[category] || 0) + parseFloat(order.total_amount);
        return acc;
    }, {});

    const topCategory = Object.entries(categoryRevenue).sort(([,a], [,b]) => b - a)[0]?.[0] || 'Unknown';

    return {
        total_revenue: totalRevenue,
        total_orders: totalOrders,
        avg_order_value: avgOrderValue,
        top_category: topCategory,
        conversion_rate: products.length > 0 ? (totalOrders / products.length) * 100 : 0,
        top_products: topProducts,
        low_performers: lowPerformers,
        category_performance: categoryRevenue
    };
}

function calculateInventoryMetrics(products, orders) {
    const totalStockValue = products.reduce((sum, p) => sum + (p.unit_price * p.stock_quantity), 0);
    const avgStockLevel = products.length > 0 ? products.reduce((sum, p) => sum + p.stock_quantity, 0) / products.length : 0;
    
    // Calculate turnover rate (simplified)
    const totalSold = orders.reduce((sum, order) => sum + order.quantity, 0);
    const totalStock = products.reduce((sum, p) => sum + p.stock_quantity, 0);
    const turnoverRate = totalStock > 0 ? (totalSold / totalStock) * 100 : 0;

    return {
        total_stock_value: totalStockValue,
        avg_stock_level: avgStockLevel,
        turnover_rate: turnoverRate,
        products_count: products.length
    };
}

function identifyOverstockItems(products, orders) {
    // Simple overstocking logic: high stock, low recent sales
    const productSales = orders.reduce((acc, order) => {
        acc[order.product_id] = (acc[order.product_id] || 0) + order.quantity;
        return acc;
    }, {});

    return products.filter(product => {
        const recentSales = productSales[product.id] || 0;
        return product.stock_quantity > 50 && recentSales < 5;
    }).slice(0, 10);
}

function identifyFastMovers(products, orders) {
    const productSales = orders.reduce((acc, order) => {
        acc[order.product_id] = (acc[order.product_id] || 0) + order.quantity;
        return acc;
    }, {});

    return products
        .map(product => ({
            ...product,
            recent_sales: productSales[product.id] || 0
        }))
        .filter(product => product.recent_sales > 10)
        .sort((a, b) => b.recent_sales - a.recent_sales)
        .slice(0, 10);
}

function identifySlowMovers(products, orders) {
    const productSales = orders.reduce((acc, order) => {
        acc[order.product_id] = (acc[order.product_id] || 0) + order.quantity;
        return acc;
    }, {});

    return products
        .map(product => ({
            ...product,
            recent_sales: productSales[product.id] || 0
        }))
        .filter(product => product.recent_sales <= 2 && product.stock_quantity > 0)
        .sort((a, b) => a.recent_sales - b.recent_sales)
        .slice(0, 10);
}

function getSeasonalPreparationItems(products) {
    // Simple seasonal logic based on current month
    const currentMonth = new Date().getMonth() + 1; // 1-12
    const seasonalCategories = {
        'Seeds': [3, 4, 10, 11], // Planting seasons
        'Fertilizers': [2, 3, 9, 10], // Pre-planting
        'Pesticides': [5, 6, 7, 8], // Growing season
        'Irrigation': [1, 2, 6, 7, 8] // Dry seasons
    };

    return products.filter(product => {
        const relevantMonths = seasonalCategories[product.category];
        return relevantMonths && relevantMonths.includes(currentMonth);
    }).slice(0, 10);
}

module.exports = {
    getSellerDashboardInsights,
    getProductOptimizations,
    getCompetitiveAnalysis,
    getSalesInsights,
    getInventoryRecommendations,
    applyAISuggestions
};
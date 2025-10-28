const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
    collectMarketData,
    getMarketTrends,
    getDemandForecast,
    generateUserRecommendations,
    getBulkPurchaseOpportunities,
    generateUserPriceAlerts,
    getUserRecommendations,
    markRecommendationAsRead
} = require('../services/marketIntelligence');

/**
 * GET /api/market-intelligence/trends
 * Get market trends analysis
 */
router.get('/trends', authenticateToken, async (req, res) => {
    try {
        const { timeframe = '30d', region = 'All Regions' } = req.query;
        
        const trends = await getMarketTrends(timeframe, region);
        
        res.json({
            success: true,
            data: trends
        });
    } catch (error) {
        console.error('Error getting market trends:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get market trends',
            error: error.message
        });
    }
});

/**
 * GET /api/market-intelligence/forecast/:category
 * Get demand forecast for a product category
 */
router.get('/forecast/:category', authenticateToken, async (req, res) => {
    try {
        const { category } = req.params;
        const { region = 'All Regions', period = '3months' } = req.query;
        
        const forecast = await getDemandForecast(category, region, period);
        
        res.json({
            success: true,
            data: forecast
        });
    } catch (error) {
        console.error('Error getting demand forecast:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get demand forecast',
            error: error.message
        });
    }
});

/**
 * GET /api/market-intelligence/recommendations
 * Get personalized recommendations for the authenticated user
 */
router.get('/recommendations', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { type, is_read, limit } = req.query;
        
        const filters = {};
        if (type) filters.type = type;
        if (is_read !== undefined) filters.is_read = is_read === 'true';
        if (limit) filters.limit = parseInt(limit);
        
        const recommendations = await getUserRecommendations(userId, filters);
        
        res.json({
            success: true,
            data: recommendations
        });
    } catch (error) {
        console.error('Error getting user recommendations:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get recommendations',
            error: error.message
        });
    }
});

/**
 * POST /api/market-intelligence/recommendations/generate
 * Generate new personalized recommendations for the authenticated user
 */
router.post('/recommendations/generate', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        const recommendations = await generateUserRecommendations(userId);
        
        res.json({
            success: true,
            data: recommendations,
            message: 'Personalized recommendations generated successfully'
        });
    } catch (error) {
        console.error('Error generating recommendations:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate recommendations',
            error: error.message
        });
    }
});

/**
 * PUT /api/market-intelligence/recommendations/:id/read
 * Mark a recommendation as read
 */
router.put('/recommendations/:id/read', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        const recommendation = await markRecommendationAsRead(id, userId);
        
        res.json({
            success: true,
            data: recommendation,
            message: 'Recommendation marked as read'
        });
    } catch (error) {
        console.error('Error marking recommendation as read:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update recommendation',
            error: error.message
        });
    }
});

/**
 * GET /api/market-intelligence/bulk-opportunities
 * Get bulk purchase opportunities
 */
router.get('/bulk-opportunities', authenticateToken, async (req, res) => {
    try {
        const { region = 'All Regions' } = req.query;
        
        const opportunities = await getBulkPurchaseOpportunities(region);
        
        res.json({
            success: true,
            data: opportunities
        });
    } catch (error) {
        console.error('Error getting bulk opportunities:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get bulk opportunities',
            error: error.message
        });
    }
});

/**
 * POST /api/market-intelligence/price-alerts
 * Generate price alerts for the authenticated user
 */
router.post('/price-alerts', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { product_ids = [] } = req.body;
        
        const alerts = await generateUserPriceAlerts(userId, product_ids);
        
        res.json({
            success: true,
            data: alerts,
            message: 'Price alerts generated successfully'
        });
    } catch (error) {
        console.error('Error generating price alerts:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate price alerts',
            error: error.message
        });
    }
});

/**
 * POST /api/market-intelligence/collect-data
 * Collect and analyze market data (admin only)
 */
router.post('/collect-data', authenticateToken, async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.user_type !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }
        
        const result = await collectMarketData();
        
        res.json({
            success: true,
            data: result,
            message: 'Market data collected successfully'
        });
    } catch (error) {
        console.error('Error collecting market data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to collect market data',
            error: error.message
        });
    }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const {
  getAllPlans,
  getUserSubscription,
  getUserUsageStats,
  upgradeSubscription,
  assignFreePlanToUser
} = require('../services/subscription');
const { authenticateToken } = require('../middleware/auth');
const { checkFeatureLimit, trackAIUsage } = require('../middleware/usageLimits');

/**
 * GET /api/subscriptions/plans
 * Get all available subscription plans
 */
router.get('/plans', async (req, res) => {
  try {
    const plans = await getAllPlans();
    
    res.json({
      success: true,
      data: plans,
      message: 'Subscription plans retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting plans:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve subscription plans',
      error: error.message
    });
  }
});

/**
 * GET /api/subscriptions/my-subscription
 * Get current user's subscription
 */
router.get('/my-subscription', authenticateToken, async (req, res) => {
  try {
    const subscription = await getUserSubscription(req.user.id);
    
    if (!subscription) {
      // Assign free plan if no subscription exists
      const freeSubscription = await assignFreePlanToUser(req.user.id);
      return res.json({
        success: true,
        data: freeSubscription,
        message: 'Free plan assigned'
      });
    }
    
    res.json({
      success: true,
      data: subscription,
      message: 'Subscription retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve subscription',
      error: error.message
    });
  }
});

/**
 * GET /api/subscriptions/usage
 * Get user's usage statistics
 */
router.get('/usage', authenticateToken, async (req, res) => {
  try {
    const stats = await getUserUsageStats(req.user.id);
    
    res.json({
      success: true,
      data: stats,
      message: 'Usage statistics retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting usage stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve usage statistics',
      error: error.message
    });
  }
});

/**
 * POST /api/subscriptions/upgrade
 * Upgrade user's subscription
 */
router.post('/upgrade', authenticateToken, async (req, res) => {
  try {
    const { plan_id } = req.body;
    
    if (!plan_id) {
      return res.status(400).json({
        success: false,
        message: 'Plan ID is required'
      });
    }
    
    const subscription = await upgradeSubscription(req.user.id, plan_id);
    
    res.json({
      success: true,
      data: subscription,
      message: 'Subscription upgraded successfully'
    });
  } catch (error) {
    console.error('Error upgrading subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upgrade subscription',
      error: error.message
    });
  }
});

// Usage limit enforcement for AI features
router.get('/check-ai-limit', authenticateToken, checkFeatureLimit('ai_query'), async (req, res) => {
  res.json({
    success: true,
    data: req.usageInfo,
    message: 'AI usage limit check passed'
  });
});

module.exports = router;


const { checkUsageLimit } = require('../services/subscription');

/**
 * Usage limit checking middleware
 * @param {string} feature - Feature name to check limits for
 * @returns {Function} Express middleware
 */
function checkFeatureLimit(feature) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'Please log in to access this feature'
        });
      }

      const usageCheck = await checkUsageLimit(req.user.id, feature);
      
      if (!usageCheck.allowed) {
        return res.status(403).json({
          success: false,
          error: 'Usage limit exceeded',
          message: `You have reached your monthly limit for this feature. Upgrade your plan for more access.`,
          limit: {
            used: usageCheck.used,
            limit: usageCheck.limit,
            remaining: usageCheck.remaining,
            feature
          }
        });
      }

      // Attach usage info to request for later increment
      req.usageInfo = {
        allowed: usageCheck.allowed,
        used: usageCheck.used,
        limit: usageCheck.limit,
        remaining: usageCheck.remaining,
        isUnlimited: usageCheck.isUnlimited,
        feature
      };

      next();
    } catch (error) {
      console.error('Error checking usage limit:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check usage limit',
        message: error.message
      });
    }
  };
}

/**
 * Middleware to automatically track AI query usage
 */
async function trackAIUsage(req, res, next) {
  try {
    if (req.user && req.usageInfo && req.usageInfo.feature === 'ai_query') {
      const { incrementUsage } = require('../services/subscription');
      await incrementUsage(req.user.id, 'ai_query');
    }
    next();
  } catch (error) {
    console.error('Error tracking AI usage:', error);
    // Don't fail the request if usage tracking fails
    next();
  }
}

module.exports = {
  checkFeatureLimit,
  trackAIUsage
};


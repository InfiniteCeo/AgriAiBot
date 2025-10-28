const { supabase } = require('./supabase');

/**
 * Subscription Management Service
 * Handles subscription plans, usage tracking, and limits
 */

/**
 * Get subscription plan by ID
 * @param {string} planId - Plan ID
 * @returns {Object} Subscription plan
 */
async function getPlanById(planId) {
  try {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .eq('is_active', true)
      .single();

    if (error) {
      throw new Error('Plan not found');
    }

    return data;
  } catch (error) {
    console.error('Error in getPlanById:', error);
    throw error;
  }
}

/**
 * Get all available subscription plans
 * @returns {Array} Array of subscription plans
 */
async function getAllPlans() {
  try {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('price_monthly', { ascending: true });

    if (error) {
      throw new Error('Failed to fetch plans');
    }

    return data;
  } catch (error) {
    console.error('Error in getAllPlans:', error);
    throw error;
  }
}

/**
 * Get user's current subscription
 * @param {string} userId - User ID
 * @returns {Object|null} Current subscription or null
 */
async function getUserSubscription(userId) {
  try {
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select(`
        *,
        plan:subscription_plans(*)
      `)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data || null;
  } catch (error) {
    console.error('Error in getUserSubscription:', error);
    throw error;
  }
}

/**
 * Check if user has exceeded limits for a feature
 * @param {string} userId - User ID
 * @param {string} feature - Feature name ('ai_query', 'market_intelligence', 'bulk_order', 'sacco_creation')
 * @returns {Object} { allowed: boolean, used: number, limit: number }
 */
async function checkUsageLimit(userId, feature) {
  try {
    const subscription = await getUserSubscription(userId);
    const plan = subscription?.plan || await getFreePlan();

    const currentDate = new Date();
    const month = currentDate.getMonth() + 1;
    const year = currentDate.getFullYear();

    // Get or create usage tracking
    let { data: usage } = await supabase
      .from('usage_tracking')
      .select('*')
      .eq('user_id', userId)
      .eq('month', month)
      .eq('year', year)
      .single();

    if (!usage) {
      const { data: newUsage } = await supabase
        .from('usage_tracking')
        .insert({
          user_id: userId,
          month,
          year,
          last_reset_date: currentDate
        })
        .select()
        .single();
      usage = newUsage;
    }

    // Check if monthly reset is needed
    const lastReset = new Date(usage.last_reset_date);
    const daysSinceReset = (currentDate - lastReset) / (1000 * 60 * 60 * 24);
    
    if (daysSinceReset >= 30) {
      // Reset monthly counters
      await supabase
        .from('usage_tracking')
        .update({
          ai_queries_used: 0,
          market_intelligence_queries_used: 0,
          bulk_orders_created: 0,
          sacco_groups_created: 0,
          last_reset_date: currentDate
        })
        .eq('id', usage.id);
      
      usage = { ...usage, ai_queries_used: 0, market_intelligence_queries_used: 0, bulk_orders_created: 0, sacco_groups_created: 0 };
    }

    // Get limits from plan
    const limits = {
      ai_query: plan.ai_query_limit === -1 ? Infinity : plan.ai_query_limit,
      market_intelligence: plan.market_intelligence_limit === -1 ? Infinity : plan.market_intelligence_limit,
      bulk_order: plan.bulk_order_limit === -1 ? Infinity : plan.bulk_order_limit,
      sacco_creation: plan.max_sacco_groups === -1 ? Infinity : plan.max_sacco_groups
    };

    // Get current usage
    const usageCount = {
      ai_query: usage.ai_queries_used || 0,
      market_intelligence: usage.market_intelligence_queries_used || 0,
      bulk_order: usage.bulk_orders_created || 0,
      sacco_creation: usage.sacco_groups_created || 0
    };

    const limit = limits[feature];
    const used = usageCount[feature];

    return {
      allowed: used < limit,
      used,
      limit,
      remaining: Math.max(0, limit - used),
      isUnlimited: limit === Infinity
    };
  } catch (error) {
    console.error('Error in checkUsageLimit:', error);
    throw error;
  }
}

/**
 * Get free plan (default plan)
 * @returns {Object} Free plan
 */
async function getFreePlan() {
  const { data } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('name', 'Free')
    .eq('is_active', true)
    .single();

  return data;
}

/**
 * Assign free plan to new user
 * @param {string} userId - User ID
 * @returns {Object} Created subscription
 */
async function assignFreePlanToUser(userId) {
  try {
    const freePlan = await getFreePlan();
    
    const { data, error } = await supabase
      .from('user_subscriptions')
      .insert({
        user_id: userId,
        plan_id: freePlan.id,
        status: 'active',
        start_date: new Date().toISOString()
      })
      .select(`
        *,
        plan:subscription_plans(*)
      `)
      .single();

    if (error) {
      throw new Error('Failed to assign free plan');
    }

    return data;
  } catch (error) {
    console.error('Error in assignFreePlanToUser:', error);
    throw error;
  }
}

/**
 * Increment usage for a feature
 * @param {string} userId - User ID
 * @param {string} feature - Feature name
 * @returns {boolean} Success status
 */
async function incrementUsage(userId, feature) {
  try {
    const currentDate = new Date();
    const month = currentDate.getMonth() + 1;
    const year = currentDate.getFullYear();

    const usageFields = {
      ai_query: 'ai_queries_used',
      market_intelligence: 'market_intelligence_queries_used',
      bulk_order: 'bulk_orders_created',
      sacco_creation: 'sacco_groups_created'
    };

    const field = usageFields[feature];
    if (!field) {
      throw new Error('Invalid feature name');
    }

    // Get or create usage record
    let { data: usage } = await supabase
      .from('usage_tracking')
      .select('*')
      .eq('user_id', userId)
      .eq('month', month)
      .eq('year', year)
      .single();

    if (!usage) {
      const { data: newUsage } = await supabase
        .from('usage_tracking')
        .insert({
          user_id: userId,
          month,
          year,
          last_reset_date: currentDate,
          [field]: 1
        })
        .select()
        .single();
      return true;
    }

    // Update usage count
    await supabase
      .from('usage_tracking')
      .update({
        [field]: (usage[field] || 0) + 1,
        updated_at: currentDate
      })
      .eq('id', usage.id);

    return true;
  } catch (error) {
    console.error('Error in incrementUsage:', error);
    throw error;
  }
}

/**
 * Get user's current usage stats
 * @param {string} userId - User ID
 * @returns {Object} Usage statistics
 */
async function getUserUsageStats(userId) {
  try {
    const subscription = await getUserSubscription(userId);
    const plan = subscription?.plan || await getFreePlan();

    const currentDate = new Date();
    const month = currentDate.getMonth() + 1;
    const year = currentDate.getFullYear();

    const { data: usage } = await supabase
      .from('usage_tracking')
      .select('*')
      .eq('user_id', userId)
      .eq('month', month)
      .eq('year', year)
      .single();

    const stats = {
      plan: {
        name: plan.name,
        price: plan.price_monthly
      },
      limits: {
        ai_query: plan.ai_query_limit === -1 ? 'Unlimited' : plan.ai_query_limit,
        market_intelligence: plan.market_intelligence_limit === -1 ? 'Unlimited' : plan.market_intelligence_limit,
        bulk_order: plan.bulk_order_limit === -1 ? 'Unlimited' : plan.bulk_order_limit,
        sacco_creation: plan.max_sacco_groups === -1 ? 'Unlimited' : plan.max_sacco_groups
      },
      used: {
        ai_query: usage?.ai_queries_used || 0,
        market_intelligence: usage?.market_intelligence_queries_used || 0,
        bulk_order: usage?.bulk_orders_created || 0,
        sacco_creation: usage?.sacco_groups_created || 0
      },
      remaining: {
        ai_query: plan.ai_query_limit === -1 ? 'Unlimited' : Math.max(0, plan.ai_query_limit - (usage?.ai_queries_used || 0)),
        market_intelligence: plan.market_intelligence_limit === -1 ? 'Unlimited' : Math.max(0, plan.market_intelligence_limit - (usage?.market_intelligence_queries_used || 0)),
        bulk_order: plan.bulk_order_limit === -1 ? 'Unlimited' : Math.max(0, plan.bulk_order_limit - (usage?.bulk_orders_created || 0)),
        sacco_creation: plan.max_sacco_groups === -1 ? 'Unlimited' : Math.max(0, plan.max_sacco_groups - (usage?.sacco_groups_created || 0))
      }
    };

    return stats;
  } catch (error) {
    console.error('Error in getUserUsageStats:', error);
    throw error;
  }
}

/**
 * Upgrade user subscription
 * @param {string} userId - User ID
 * @param {string} planId - New plan ID
 * @returns {Object} Updated subscription
 */
async function upgradeSubscription(userId, planId) {
  try {
    // Cancel current subscription
    await supabase
      .from('user_subscriptions')
      .update({ status: 'cancelled' })
      .eq('user_id', userId)
      .eq('status', 'active');

    // Create new subscription
    const { data, error } = await supabase
      .from('user_subscriptions')
      .insert({
        user_id: userId,
        plan_id: planId,
        status: 'active',
        start_date: new Date().toISOString(),
        auto_renew: true
      })
      .select(`
        *,
        plan:subscription_plans(*)
      `)
      .single();

    if (error) {
      throw new Error('Failed to upgrade subscription');
    }

    return data;
  } catch (error) {
    console.error('Error in upgradeSubscription:', error);
    throw error;
  }
}

module.exports = {
  getPlanById,
  getAllPlans,
  getUserSubscription,
  checkUsageLimit,
  getFreePlan,
  assignFreePlanToUser,
  incrementUsage,
  getUserUsageStats,
  upgradeSubscription
};


-- Subscription Plans Table
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL, -- 'Free', 'Basic', 'Premium', 'Enterprise'
    description TEXT,
    price_monthly DECIMAL(10, 2) NOT NULL DEFAULT 0,
    price_yearly DECIMAL(10, 2),
    currency VARCHAR(10) DEFAULT 'KES',
    ai_query_limit INTEGER NOT NULL DEFAULT 10, -- Monthly AI query limit
    market_intelligence_limit INTEGER NOT NULL DEFAULT 5, -- Monthly market intelligence queries
    max_sacco_groups INTEGER NOT NULL DEFAULT 1, -- Max SACCO groups can create
    bulk_order_limit INTEGER NOT NULL DEFAULT 3, -- Monthly bulk orders
    priority_support BOOLEAN DEFAULT false,
    features JSONB, -- Additional features
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Subscriptions Table
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'cancelled', 'expired', 'trial'
    start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_date TIMESTAMPTZ,
    auto_renew BOOLEAN DEFAULT false,
    payment_method VARCHAR(50),
    stripe_subscription_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, status)
);

-- Usage Tracking Table
CREATE TABLE IF NOT EXISTS usage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES user_subscriptions(id),
    month INTEGER NOT NULL, -- 1-12
    year INTEGER NOT NULL,
    ai_queries_used INTEGER DEFAULT 0,
    market_intelligence_queries_used INTEGER DEFAULT 0,
    bulk_orders_created INTEGER DEFAULT 0,
    sacco_groups_created INTEGER DEFAULT 0,
    last_reset_date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, month, year)
);

-- Payment Transactions Table
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    subscription_id UUID REFERENCES user_subscriptions(id),
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'KES',
    payment_method VARCHAR(50),
    status VARCHAR(20) NOT NULL, -- 'pending', 'completed', 'failed', 'refunded'
    stripe_payment_intent_id VARCHAR(255),
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Default Subscription Plans
INSERT INTO subscription_plans (name, description, price_monthly, ai_query_limit, market_intelligence_limit, max_sacco_groups, bulk_order_limit, features) VALUES
('Free', 'Perfect for getting started', 0, 10, 2, 1, 2, '{"ai_chat": true, "basic_market_intelligence": true, "sacco_creation": true}'::jsonb),
('Basic', 'For active farmers', 500, 50, 10, 3, 10, '{"ai_chat": true, "market_intelligence": true, "sacco_creation": true, "priority_support": false}'::jsonb),
('Premium', 'For serious farming operations', 2000, 200, 50, 10, 50, '{"ai_chat": true, "advanced_market_intelligence": true, "sacco_creation": true, "priority_support": true, "bulk_pricing": true}'::jsonb),
('Enterprise', 'For cooperatives and large operations', 5000, -1, -1, -1, -1, '{"unlimited_ai_chat": true, "unlimited_market_intelligence": true, "unlimited_sacco_creation": true, "priority_support": true, "bulk_pricing": true, "api_access": true}'::jsonb)
ON CONFLICT DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_id ON usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_month_year ON usage_tracking(month, year);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);


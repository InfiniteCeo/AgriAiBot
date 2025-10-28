-- AgriAI Bot Enhanced Database Schema for Marketplace Features
-- Run this in your Supabase SQL Editor after the basic setup

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS recommendations CASCADE;
DROP TABLE IF EXISTS qr_links CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS bulk_order_participations CASCADE;
DROP TABLE IF EXISTS bulk_orders CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS sacco_memberships CASCADE;
DROP TABLE IF EXISTS sacco_groups CASCADE;
DROP TABLE IF EXISTS market_data CASCADE;
DROP TABLE IF EXISTS queries CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Enhanced Users table with authentication and profile data
CREATE TABLE users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255),
    name VARCHAR(100),
    user_type VARCHAR(20) CHECK (user_type IN ('farmer', 'wholesaler', 'admin')) DEFAULT 'farmer',
    location VARCHAR(100),
    farm_size DECIMAL(10,2),
    crops_grown TEXT[],
    whatsapp_linked BOOLEAN DEFAULT FALSE,
    whatsapp_phone VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Queries table (existing functionality)
CREATE TABLE queries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SACCO Groups
CREATE TABLE sacco_groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    region VARCHAR(100),
    admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    member_limit INTEGER DEFAULT 50,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SACCO Memberships
CREATE TABLE sacco_memberships (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sacco_id UUID REFERENCES sacco_groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
    UNIQUE(sacco_id, user_id)
);

-- Products (Farm Inputs)
CREATE TABLE products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wholesaler_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    unit_price DECIMAL(10,2) NOT NULL,
    bulk_pricing JSONB, -- {quantity: price} tiers
    stock_quantity INTEGER DEFAULT 0,
    unit_type VARCHAR(50), -- kg, liters, pieces, etc.
    location VARCHAR(100),
    image_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders
CREATE TABLE orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    buyer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    order_type VARCHAR(20) CHECK (order_type IN ('individual', 'bulk')) DEFAULT 'individual',
    sacco_id UUID REFERENCES sacco_groups(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    delivery_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bulk Orders (SACCO collective orders)
CREATE TABLE bulk_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sacco_id UUID REFERENCES sacco_groups(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    total_quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'collecting' CHECK (status IN ('collecting', 'finalized', 'ordered', 'delivered')),
    deadline TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bulk Order Participations
CREATE TABLE bulk_order_participations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    bulk_order_id UUID REFERENCES bulk_orders(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(bulk_order_id, user_id)
);

-- Payments
CREATE TABLE payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    bulk_order_id UUID REFERENCES bulk_orders(id) ON DELETE SET NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50) CHECK (payment_method IN ('mpesa', 'airtel_money')),
    transaction_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- QR Code Links
CREATE TABLE qr_links (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(100) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Market Data (enhanced)
CREATE TABLE market_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_category VARCHAR(100),
    region VARCHAR(100),
    average_price DECIMAL(10,2),
    demand_level VARCHAR(20) CHECK (demand_level IN ('low', 'medium', 'high')),
    supply_level VARCHAR(20) CHECK (supply_level IN ('low', 'medium', 'high')),
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Recommendations
CREATE TABLE recommendations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) CHECK (type IN ('purchase', 'timing', 'market_opportunity', 'bulk_order')),
    title VARCHAR(200),
    description TEXT,
    data JSONB, -- additional recommendation data
    is_read BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_user_type ON users(user_type);
CREATE INDEX idx_users_location ON users(location);

CREATE INDEX idx_queries_user_id ON queries(user_id);
CREATE INDEX idx_queries_timestamp ON queries(timestamp);

CREATE INDEX idx_sacco_groups_region ON sacco_groups(region);
CREATE INDEX idx_sacco_groups_admin_id ON sacco_groups(admin_id);

CREATE INDEX idx_sacco_memberships_sacco_id ON sacco_memberships(sacco_id);
CREATE INDEX idx_sacco_memberships_user_id ON sacco_memberships(user_id);

CREATE INDEX idx_products_wholesaler_id ON products(wholesaler_id);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_location ON products(location);
CREATE INDEX idx_products_is_active ON products(is_active);

CREATE INDEX idx_orders_buyer_id ON orders(buyer_id);
CREATE INDEX idx_orders_product_id ON orders(product_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);

CREATE INDEX idx_bulk_orders_sacco_id ON bulk_orders(sacco_id);
CREATE INDEX idx_bulk_orders_product_id ON bulk_orders(product_id);
CREATE INDEX idx_bulk_orders_status ON bulk_orders(status);

CREATE INDEX idx_bulk_order_participations_bulk_order_id ON bulk_order_participations(bulk_order_id);
CREATE INDEX idx_bulk_order_participations_user_id ON bulk_order_participations(user_id);

CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_bulk_order_id ON payments(bulk_order_id);
CREATE INDEX idx_payments_status ON payments(status);

CREATE INDEX idx_qr_links_user_id ON qr_links(user_id);
CREATE INDEX idx_qr_links_token ON qr_links(token);
CREATE INDEX idx_qr_links_expires_at ON qr_links(expires_at);

CREATE INDEX idx_market_data_product_category ON market_data(product_category);
CREATE INDEX idx_market_data_region ON market_data(region);
CREATE INDEX idx_market_data_date ON market_data(date);

CREATE INDEX idx_recommendations_user_id ON recommendations(user_id);
CREATE INDEX idx_recommendations_type ON recommendations(type);
CREATE INDEX idx_recommendations_is_read ON recommendations(is_read);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE sacco_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE sacco_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_order_participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;

-- Create policies for basic access (adjust as needed for your security requirements)
CREATE POLICY "Allow all operations on users" ON users FOR ALL USING (true);
CREATE POLICY "Allow all operations on queries" ON queries FOR ALL USING (true);
CREATE POLICY "Allow all operations on sacco_groups" ON sacco_groups FOR ALL USING (true);
CREATE POLICY "Allow all operations on sacco_memberships" ON sacco_memberships FOR ALL USING (true);
CREATE POLICY "Allow all operations on products" ON products FOR ALL USING (true);
CREATE POLICY "Allow all operations on orders" ON orders FOR ALL USING (true);
CREATE POLICY "Allow all operations on bulk_orders" ON bulk_orders FOR ALL USING (true);
CREATE POLICY "Allow all operations on bulk_order_participations" ON bulk_order_participations FOR ALL USING (true);
CREATE POLICY "Allow all operations on payments" ON payments FOR ALL USING (true);
CREATE POLICY "Allow all operations on qr_links" ON qr_links FOR ALL USING (true);
CREATE POLICY "Allow all operations on market_data" ON market_data FOR ALL USING (true);
CREATE POLICY "Allow all operations on recommendations" ON recommendations FOR ALL USING (true);

-- Verification query
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'users', 'queries', 'sacco_groups', 'sacco_memberships', 
    'products', 'orders', 'bulk_orders', 'bulk_order_participations',
    'payments', 'qr_links', 'market_data', 'recommendations'
);
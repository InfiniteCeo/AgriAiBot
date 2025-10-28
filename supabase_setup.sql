-- AgriAI Bot Database Setup Script
-- Run this in your Supabase SQL Editor

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  name TEXT,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Queries Table
CREATE TABLE IF NOT EXISTS queries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Market Data Table (Optional Future Feature)
CREATE TABLE IF NOT EXISTS market_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  crop TEXT NOT NULL,
  region TEXT NOT NULL,
  price DECIMAL(10, 2),
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_queries_user_id ON queries(user_id);
CREATE INDEX IF NOT EXISTS idx_queries_timestamp ON queries(timestamp);
CREATE INDEX IF NOT EXISTS idx_market_data_crop ON market_data(crop);
CREATE INDEX IF NOT EXISTS idx_market_data_region ON market_data(region);

-- Enable Row Level Security (RLS) - optional
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_data ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (adjust as needed for your security requirements)
CREATE POLICY "Allow all operations on users" ON users FOR ALL USING (true);
CREATE POLICY "Allow all operations on queries" ON queries FOR ALL USING (true);
CREATE POLICY "Allow all operations on market_data" ON market_data FOR ALL USING (true);

-- Verification query (uncomment to test)
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('users', 'queries', 'market_data');

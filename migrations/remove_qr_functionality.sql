-- Migration to remove QR functionality from AgriAI Bot database
-- Run this in your Supabase SQL Editor to remove QR-related tables and functionality

-- Drop QR links table and related indexes
DROP TABLE IF EXISTS qr_links CASCADE;

-- Create password reset tokens table to replace QR functionality for password resets
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(100) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_users_whatsapp_phone ON users(whatsapp_phone);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

-- Enable RLS and create policy
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on password_reset_tokens" ON password_reset_tokens FOR ALL USING (true);

-- Update any existing users to ensure proper WhatsApp linking format
-- This will help with the transition to automatic linking
UPDATE users 
SET whatsapp_phone = REPLACE(whatsapp_phone, '+', '')
WHERE whatsapp_phone IS NOT NULL 
AND whatsapp_phone LIKE '+%';

-- Verification: Check that QR table is removed
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'qr_links';

-- Should return no rows if successful
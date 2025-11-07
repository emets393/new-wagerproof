-- Add RevenueCat subscription tracking columns to profiles table
-- This enables fast local subscription checks without always calling RevenueCat API

-- Add subscription status column (monthly, yearly, lifetime, or null)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS subscription_status TEXT;

-- Add boolean flag for quick active subscription check
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS subscription_active BOOLEAN DEFAULT FALSE;

-- Add subscription expiration timestamp
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;

-- Add RevenueCat customer ID for reference
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS revenuecat_customer_id TEXT;

-- Create index for faster subscription queries
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_active 
ON profiles(subscription_active) 
WHERE subscription_active = TRUE;

-- Create index for expiration queries
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_expires_at 
ON profiles(subscription_expires_at) 
WHERE subscription_expires_at IS NOT NULL;

COMMENT ON COLUMN profiles.subscription_status IS 'Type of subscription: monthly, yearly, lifetime, or null';
COMMENT ON COLUMN profiles.subscription_active IS 'Boolean flag indicating if user has active subscription';
COMMENT ON COLUMN profiles.subscription_expires_at IS 'Timestamp when subscription expires (null for lifetime)';
COMMENT ON COLUMN profiles.revenuecat_customer_id IS 'RevenueCat customer/app user ID for reference';


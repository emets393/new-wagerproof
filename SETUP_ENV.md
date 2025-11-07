# Environment Setup - REQUIRED

## ✅ Import Fix Applied

The import error has been fixed! The issue was using a default import instead of a named import for `Purchases`.

## 🔑 Set Up Your API Key

**IMPORTANT:** Create a `.env` file in the project root with your RevenueCat API key:

### Step 1: Create the file

```bash
cd /Users/chrishabib/Documents/new-wagerproof
touch .env
```

### Step 2: Add your API key

Open the `.env` file and add:

```bash
# RevenueCat Web Billing API Keys
VITE_REVENUECAT_WEB_PUBLIC_API_KEY=rcb_svnfisrGmflnfsiwSBNiOAfgIiNX
VITE_REVENUECAT_WEB_SANDBOX_API_KEY=rcb_svnfisrGmflnfsiwSBNiOAfgIiNX
```

### Step 3: Restart your dev server

```bash
npm run dev
```

## 📋 Database Setup - REQUIRED

Run the database migrations to add sale mode and RevenueCat columns:

### Migration 1: RevenueCat Columns
```sql
-- Run this in Supabase SQL Editor
-- File: supabase/migrations/add_revenuecat_columns.sql

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_active BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS revenuecat_customer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_subscription_active 
ON profiles(subscription_active) 
WHERE subscription_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_profiles_subscription_expires_at 
ON profiles(subscription_expires_at) 
WHERE subscription_expires_at IS NOT NULL;
```

### Migration 2: Sale Mode
```sql
-- Run this in Supabase SQL Editor
-- File: supabase/migrations/add_sale_mode.sql

CREATE TABLE IF NOT EXISTS app_settings (
  id SERIAL PRIMARY KEY,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

INSERT INTO app_settings (setting_key, setting_value)
VALUES ('sale_mode', '{"enabled": false, "discount_percentage": 50}'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read app settings"
  ON app_settings FOR SELECT USING (true);

CREATE POLICY "Only admins can update app settings"
  ON app_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE OR REPLACE FUNCTION get_sale_mode()
RETURNS JSONB LANGUAGE sql STABLE AS $$
  SELECT setting_value FROM app_settings WHERE setting_key = 'sale_mode';
$$;

CREATE OR REPLACE FUNCTION update_sale_mode(enabled BOOLEAN, discount_pct INTEGER DEFAULT 50)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  is_admin BOOLEAN;
  result JSONB;
BEGIN
  SELECT profiles.is_admin INTO is_admin
  FROM profiles WHERE profiles.user_id = auth.uid();
  
  IF NOT is_admin THEN
    RAISE EXCEPTION 'Only admins can update sale mode';
  END IF;
  
  UPDATE app_settings
  SET 
    setting_value = jsonb_build_object('enabled', enabled, 'discount_percentage', discount_pct),
    updated_at = NOW(),
    updated_by = auth.uid()
  WHERE setting_key = 'sale_mode'
  RETURNING setting_value INTO result;
  
  RETURN result;
END;
$$;
```

## 🎯 What Was Fixed

### 1. Import Error
- **Before**: `import Purchases, { ... } from '@revenuecat/purchases-js'`
- **After**: `import { Purchases, ... } from '@revenuecat/purchases-js'`

### 2. Type Fixes
- Changed `typeof Purchases` to `Purchases` for proper typing

## 🎨 Sale Mode Feature - NOW LIVE!

### Admin Toggle
- Go to `/admin` in your app
- You'll see a new "Sale Mode" card
- Toggle it on to show 50% off prices ($20/mo, $99/yr)
- Toggle it off to show regular prices ($40/mo, $199/yr)

### How It Works
1. **Regular Mode**: Uses `wagerproof_monthly_pro` and `wagerproof_pro_yearly`
2. **Sale Mode**: Uses `wagerproof_monthly_pro_discount` and `wagerproof_yearly_pro_discount`

### RevenueCat Product Setup
Make sure these products exist in your RevenueCat dashboard:

**Regular Products:**
- `wagerproof_monthly_pro` - $40/month
- `wagerproof_pro_yearly` - $199/year

**Discount Products:**
- `wagerproof_monthly_pro_discount` - $20/month
- `wagerproof_yearly_pro_discount` - $99/year

All should be linked to the **"WagerProof Pro"** entitlement.

## 🧪 Testing

1. **Test Regular Mode**:
   - Go to `/admin`
   - Ensure Sale Mode is OFF
   - Visit `/paywall-test`
   - Should show $40/mo and $199/yr

2. **Test Sale Mode**:
   - Go to `/admin`
   - Turn Sale Mode ON
   - Visit `/paywall-test`
   - Should show crossed-out prices with $20/mo and $99/yr
   - Should show "🔥 LIMITED TIME SALE - 50% OFF! 🔥" banner

## ✅ Checklist

- [ ] Create `.env` file with API key
- [ ] Restart dev server
- [ ] Run RevenueCat columns migration in Supabase
- [ ] Run Sale Mode migration in Supabase
- [ ] Test that app loads without errors
- [ ] Test regular mode on paywall
- [ ] Test sale mode on paywall
- [ ] Verify admin toggle works

## 🆘 Troubleshooting

### If you still see import errors:
```bash
rm -rf node_modules/.vite
npm run dev
```

### If env variables not loading:
- Ensure `.env` is in project root (same level as `package.json`)
- Restart dev server completely
- Check that vars start with `VITE_` prefix

### If sale mode doesn't work:
- Check browser console for errors
- Verify both migrations ran successfully
- Ensure you're signed in as admin
- Check Supabase SQL Editor for any errors

## 📞 Need Help?

Check these files for detailed documentation:
- `REVENUECAT_WEB_SETUP.md` - Complete setup guide
- `REVENUECAT_WEB_IMPLEMENTATION_SUMMARY.md` - Implementation details


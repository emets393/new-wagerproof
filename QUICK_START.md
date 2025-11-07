# Quick Start Guide 🚀

## ✅ Fixed: Import Error

The error `does not provide an export named 'default'` has been fixed! Changed from default import to named import for `Purchases`.

## 🎯 3-Step Setup

### Step 1: Run Setup Script (30 seconds)
```bash
cd /Users/chrishabib/Documents/new-wagerproof
./setup-revenuecat.sh
```

This creates your `.env` file with your API key: `rcb_FimpgqhaUgXMNBUtlduWndNxaHLz`

### Step 2: Run Database Migrations (2 minutes)

Open Supabase SQL Editor and run these two files:

**Migration 1**: `supabase/migrations/add_revenuecat_columns.sql`  
**Migration 2**: `supabase/migrations/add_sale_mode.sql`

Just copy-paste each file's contents into the SQL editor and click "Run".

### Step 3: Start Dev Server
```bash
npm run dev
```

## 🎨 Test Sale Mode

1. Go to `http://localhost:5173/admin`
2. Find the "Sale Mode" card
3. Toggle it ON
4. Visit `http://localhost:5173/paywall-test`
5. See the 50% off prices! 🔥

## 📋 What You Get

### Regular Mode (Sale OFF)
- Monthly: $40/mo
- Yearly: $199/yr

### Sale Mode (Sale ON)
- Banner: "🔥 LIMITED TIME SALE - 50% OFF! 🔥"
- Monthly: ~~$40~~ → **$20/mo** (green text)
- Yearly: ~~$199~~ → **$99/yr** (green text)
- "Save 50%!" badges

## 🎯 RevenueCat Products Needed

Create these 4 products in your RevenueCat dashboard:

### Regular Products
1. `wagerproof_monthly_pro` - $40/month → "WagerProof Pro"
2. `wagerproof_pro_yearly` - $199/year → "WagerProof Pro"

### Discount Products  
3. `wagerproof_monthly_pro_discount` - $20/month → "WagerProof Pro"
4. `wagerproof_yearly_pro_discount` - $99/year → "WagerProof Pro"

All 4 must be:
- In your "default" offering
- Linked to "WagerProof Pro" entitlement

## 🧪 Quick Test

```bash
# 1. Setup
./setup-revenuecat.sh

# 2. Start
npm run dev

# 3. Test regular mode
# Visit: http://localhost:5173/paywall-test
# Should show: $40 and $199

# 4. Enable sale
# Visit: http://localhost:5173/admin
# Toggle Sale Mode ON

# 5. Test sale mode  
# Visit: http://localhost:5173/paywall-test
# Should show: Strikethrough prices + $20/$99 in green
```

## 📚 Full Documentation

- **Setup Details**: `SETUP_ENV.md`
- **Sale Mode Guide**: `SALE_MODE_IMPLEMENTATION.md`
- **RevenueCat Setup**: `REVENUECAT_WEB_SETUP.md`
- **Implementation Summary**: `REVENUECAT_WEB_IMPLEMENTATION_SUMMARY.md`

## 🆘 Issues?

### Import errors still happening?
```bash
rm -rf node_modules/.vite
npm run dev
```

### Env vars not loading?
- Ensure `.env` is in project root (same folder as `package.json`)
- Restart dev server completely
- Vars must start with `VITE_` prefix

### Sale mode not working?
- Run both database migrations
- Sign in as admin user
- Check browser console for errors

## ✨ That's It!

You're ready to go! The sale mode toggle gives you instant control over pricing without any code changes. Perfect for Black Friday, launch sales, or special promotions.

**Next**: Create your 4 products in RevenueCat and test the full purchase flow! 🎉


#!/bin/bash

echo "🚀 Setting up RevenueCat Web Billing..."
echo ""

# Create .env file
if [ -f ".env" ]; then
    echo "⚠️  .env file already exists. Skipping..."
else
    echo "📝 Creating .env file with your API key..."
    cat > .env << 'EOF'
# RevenueCat Web Billing API Keys
VITE_REVENUECAT_WEB_PUBLIC_API_KEY=rcb_svnfisrGmflnfsiwSBNiOAfgIiNX
VITE_REVENUECAT_WEB_SANDBOX_API_KEY=rcb_svnfisrGmflnfsiwSBNiOAfgIiNX
EOF
    echo "✅ .env file created!"
fi

echo ""
echo "📋 Next steps:"
echo "1. Run the database migrations in Supabase SQL Editor:"
echo "   - supabase/migrations/add_revenuecat_columns.sql"
echo "   - supabase/migrations/add_sale_mode.sql"
echo ""
echo "2. Start your dev server:"
echo "   npm run dev"
echo ""
echo "3. Test the sale mode toggle:"
echo "   - Go to /admin"
echo "   - Toggle Sale Mode on/off"
echo "   - Visit /paywall-test to see the changes"
echo ""
echo "✅ Setup script complete!"
echo "📖 See SETUP_ENV.md for detailed instructions"


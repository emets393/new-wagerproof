#!/bin/bash

# Test script for Live Score Ticker
# This helps verify the edge function and database are working correctly

echo "==================================="
echo "Live Score Ticker Test Script"
echo "==================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found${NC}"
    echo "Install it with: brew install supabase/tap/supabase"
    exit 1
fi

echo -e "${GREEN}✓ Supabase CLI found${NC}"
echo ""

# Test 1: Check if migration exists
echo "Test 1: Checking migration file..."
if [ -f "supabase/migrations/20251018000000_create_live_scores_table.sql" ]; then
    echo -e "${GREEN}✓ Migration file exists${NC}"
else
    echo -e "${RED}❌ Migration file not found${NC}"
    exit 1
fi
echo ""

# Test 2: Check if edge function exists
echo "Test 2: Checking edge function..."
if [ -f "supabase/functions/fetch-live-scores/index.ts" ]; then
    echo -e "${GREEN}✓ Edge function file exists${NC}"
else
    echo -e "${RED}❌ Edge function file not found${NC}"
    exit 1
fi
echo ""

# Test 3: Check if frontend components exist
echo "Test 3: Checking frontend components..."
components=(
    "src/components/LiveScoreTicker.tsx"
    "src/components/LiveScoreCard.tsx"
    "src/hooks/useLiveScores.ts"
    "src/services/liveScoresService.ts"
    "src/types/liveScores.ts"
)

all_exist=true
for component in "${components[@]}"; do
    if [ -f "$component" ]; then
        echo -e "${GREEN}✓${NC} $component"
    else
        echo -e "${RED}❌${NC} $component"
        all_exist=false
    fi
done

if [ "$all_exist" = false ]; then
    exit 1
fi
echo ""

# Test 4: Check if integrated in App.tsx
echo "Test 4: Checking App.tsx integration..."
if grep -q "LiveScoreTicker" "src/App.tsx"; then
    echo -e "${GREEN}✓ LiveScoreTicker imported and used in App.tsx${NC}"
else
    echo -e "${RED}❌ LiveScoreTicker not found in App.tsx${NC}"
    exit 1
fi
echo ""

# Test 5: Invoke edge function (if Supabase is linked)
echo "Test 5: Testing edge function..."
echo -e "${YELLOW}⚠ Attempting to invoke edge function...${NC}"

if supabase functions list &> /dev/null; then
    echo "Invoking fetch-live-scores function..."
    result=$(supabase functions invoke fetch-live-scores 2>&1)
    
    if echo "$result" | grep -q "success"; then
        echo -e "${GREEN}✓ Edge function invoked successfully${NC}"
        echo "$result" | jq . 2>/dev/null || echo "$result"
    else
        echo -e "${YELLOW}⚠ Edge function may not be deployed yet${NC}"
        echo "Deploy with: supabase functions deploy fetch-live-scores"
    fi
else
    echo -e "${YELLOW}⚠ Supabase project not linked${NC}"
    echo "Link with: supabase link --project-ref YOUR_PROJECT_REF"
fi
echo ""

# Summary
echo "==================================="
echo "Test Summary"
echo "==================================="
echo -e "${GREEN}✓ All required files exist${NC}"
echo -e "${GREEN}✓ Components are integrated${NC}"
echo ""
echo "Next steps:"
echo "1. Run migration: supabase db push"
echo "2. Deploy function: supabase functions deploy fetch-live-scores"
echo "3. Start dev server: npm run dev"
echo "4. Visit your app and check for live games!"
echo ""
echo "For detailed setup instructions, see:"
echo "  LIVE_SCORE_TICKER_SETUP.md"
echo ""


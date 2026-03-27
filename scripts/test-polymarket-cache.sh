#!/bin/bash

# Test script for Polymarket Cache Update Function
# Tests NCAAB Polymarket data fetching

echo "==================================="
echo "Polymarket Cache Update Test"
echo "==================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found${NC}"
    echo "Install it with: brew install supabase/tap/supabase"
    exit 1
fi

echo -e "${GREEN}✓ Supabase CLI found${NC}"
echo ""

# Check if project is linked
echo "Checking if Supabase project is linked..."
if supabase projects list &> /dev/null; then
    echo -e "${GREEN}✓ Supabase CLI is configured${NC}"
else
    echo -e "${YELLOW}⚠ Supabase project may not be linked${NC}"
    echo "Link with: supabase link --project-ref YOUR_PROJECT_REF"
fi
echo ""

# Test the edge function
echo -e "${BLUE}Invoking update-polymarket-cache function...${NC}"
echo ""

result=$(supabase functions invoke update-polymarket-cache 2>&1)

# Check if result contains JSON
if echo "$result" | grep -q "{"; then
    echo -e "${GREEN}✓ Function executed successfully${NC}"
    echo ""
    echo "Response:"
    echo "$result" | jq . 2>/dev/null || echo "$result"
    echo ""
    
    # Check for NCAAB data in response
    if echo "$result" | grep -q "ncaabGames"; then
        ncaab_count=$(echo "$result" | jq -r '.ncaabGames // 0' 2>/dev/null || echo "0")
        if [ "$ncaab_count" != "0" ] && [ "$ncaab_count" != "null" ]; then
            echo -e "${GREEN}✓ NCAAB games found: $ncaab_count${NC}"
        else
            echo -e "${YELLOW}⚠ No NCAAB games found (this may be normal if no games today)${NC}"
        fi
    fi
    
    # Check for NCAAB events
    if echo "$result" | grep -q "NCAAB"; then
        echo -e "${GREEN}✓ NCAAB events found in response${NC}"
    fi
    
    # Check for errors
    if echo "$result" | grep -q '"errors"'; then
        error_count=$(echo "$result" | jq -r '.errors | length' 2>/dev/null || echo "0")
        if [ "$error_count" != "0" ] && [ "$error_count" != "null" ]; then
            echo -e "${YELLOW}⚠ Found $error_count errors${NC}"
            echo "$result" | jq -r '.errors[]' 2>/dev/null || echo "Check response for error details"
        fi
    fi
    
else
    echo -e "${RED}❌ Function invocation failed${NC}"
    echo "$result"
    echo ""
    echo "Troubleshooting:"
    echo "1. Make sure the function is deployed: supabase functions deploy update-polymarket-cache"
    echo "2. Check function logs: supabase functions logs update-polymarket-cache"
fi

echo ""
echo "==================================="
echo "Test Complete"
echo "==================================="


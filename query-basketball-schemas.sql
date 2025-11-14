-- Query schemas for NBA and NCAAB tables
-- Run this in Supabase SQL Editor to get full column information

-- 1. NBA Input Values View Schema
SELECT 
    'nba_input_values_view' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length,
    numeric_precision,
    numeric_scale
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'nba_input_values_view'
ORDER BY ordinal_position;

-- 2. NBA Predictions Schema
SELECT 
    'nba_predictions' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length,
    numeric_precision,
    numeric_scale
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'nba_predictions'
ORDER BY ordinal_position;

-- 3. CBB Input Values View Schema
SELECT 
    'v_cbb_input_values' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length,
    numeric_precision,
    numeric_scale
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'v_cbb_input_values'
ORDER BY ordinal_position;

-- 4. NCAAB Predictions Schema
SELECT 
    'ncaab_predictions' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length,
    numeric_precision,
    numeric_scale
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'ncaab_predictions'
ORDER BY ordinal_position;

-- Also check if these are views and get their definitions
SELECT 
    table_name,
    table_type,
    view_definition
FROM information_schema.views
WHERE table_schema = 'public' 
  AND table_name IN ('nba_input_values_view', 'v_cbb_input_values')
ORDER BY table_name;

-- Get sample data to understand ID/key fields (limit 1 row each)
SELECT 'nba_input_values_view_sample' as source, * FROM nba_input_values_view LIMIT 1;
SELECT 'nba_predictions_sample' as source, * FROM nba_predictions LIMIT 1;
SELECT 'v_cbb_input_values_sample' as source, * FROM v_cbb_input_values LIMIT 1;
SELECT 'ncaab_predictions_sample' as source, * FROM ncaab_predictions LIMIT 1;


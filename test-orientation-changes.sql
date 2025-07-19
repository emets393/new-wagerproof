-- Test script to verify orientation changes work correctly

-- 1. Check that the new tables exist and have the correct columns
SELECT 
  'training_data_team_with_orientation' as table_name,
  COUNT(*) as row_count,
  COUNT(orientation_unique_id) as orientation_ids_count
FROM public.training_data_team_with_orientation
LIMIT 1;

SELECT 
  'input_values_team_format_with_orientation' as table_name,
  COUNT(*) as row_count,
  COUNT(orientation_unique_id) as orientation_ids_count,
  COUNT(primary_vs_opponent_id) as primary_vs_opponent_ids_count
FROM public.input_values_team_format_with_orientation
LIMIT 1;

-- 2. Check sample data to verify orientation_unique_id format
SELECT 
  primary_team,
  opponent_team,
  date,
  orientation_unique_id,
  primary_vs_opponent_id
FROM public.input_values_team_format_with_orientation
LIMIT 5;

-- 3. Check that orientation_unique_id is unique for each team orientation
SELECT 
  orientation_unique_id,
  COUNT(*) as count
FROM public.training_data_team_with_orientation
GROUP BY orientation_unique_id
HAVING COUNT(*) > 1
LIMIT 10;

-- 4. Check that primary_vs_opponent_id format is correct
SELECT 
  primary_team,
  opponent_team,
  primary_vs_opponent_id,
  CASE 
    WHEN primary_vs_opponent_id = CONCAT(primary_team, '_vs_', opponent_team) 
    THEN 'CORRECT' 
    ELSE 'INCORRECT' 
  END as format_check
FROM public.input_values_team_format_with_orientation
LIMIT 10;

-- 5. Test pattern matching logic
-- Find a sample pattern and see if it matches games with correct orientation
SELECT 
  'Sample pattern matching test' as test_name,
  p.pattern_name,
  p.orientation_unique_id as pattern_orientation,
  g.orientation_unique_id as game_orientation,
  g.primary_vs_opponent_id,
  CASE 
    WHEN p.orientation_unique_id = g.orientation_unique_id 
    THEN 'MATCH' 
    ELSE 'NO MATCH' 
  END as orientation_match
FROM public.saved_trend_patterns p
CROSS JOIN public.input_values_team_format_with_orientation g
WHERE p.orientation_unique_id IS NOT NULL
LIMIT 5; 
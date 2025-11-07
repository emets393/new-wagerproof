
-- Check if we have a training_data table with the required columns
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'training_data' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- If training_data doesn't exist, let's check what game data tables we have
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%games%'
ORDER BY table_name;

-- Let's also check the structure of one of the team game tables to understand the data format
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'angels_games' 
AND table_schema = 'public'
ORDER BY ordinal_position;

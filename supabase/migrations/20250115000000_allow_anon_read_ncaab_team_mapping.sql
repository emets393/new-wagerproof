-- Allow anonymous users to read from ncaab_team_mapping table
-- This is needed for the NCAAB page to display team logos

-- Only apply if the table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'ncaab_team_mapping'
  ) THEN
    -- First, ensure RLS is enabled on the table
    ALTER TABLE ncaab_team_mapping ENABLE ROW LEVEL SECURITY;

    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Allow anonymous read access to ncaab_team_mapping" ON ncaab_team_mapping;
    DROP POLICY IF EXISTS "Allow authenticated read access to ncaab_team_mapping" ON ncaab_team_mapping;

    -- Create a policy that allows anonymous users to SELECT from the table
    CREATE POLICY "Allow anonymous read access to ncaab_team_mapping"
    ON ncaab_team_mapping
    FOR SELECT
    TO anon
    USING (true);

    -- Also allow authenticated users to read
    CREATE POLICY "Allow authenticated read access to ncaab_team_mapping"
    ON ncaab_team_mapping
    FOR SELECT
    TO authenticated
    USING (true);
  ELSE
    RAISE NOTICE 'Table ncaab_team_mapping does not exist, skipping migration';
  END IF;
END $$;


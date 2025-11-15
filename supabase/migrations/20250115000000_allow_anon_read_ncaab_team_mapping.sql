-- Allow anonymous users to read from ncaab_team_mapping table
-- This is needed for the NCAAB page to display team logos

-- First, ensure RLS is enabled on the table
ALTER TABLE ncaab_team_mapping ENABLE ROW LEVEL SECURITY;

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


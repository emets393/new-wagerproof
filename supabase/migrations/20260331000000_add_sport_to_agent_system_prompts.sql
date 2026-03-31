-- =============================================================================
-- Migration: Add sport column to agent_system_prompts
-- Purpose: Support sport-specific system prompts (e.g., a dedicated MLB prompt)
-- while keeping the existing default prompt for all other sports.
-- =============================================================================

-- Add nullable sport column (null = default/all sports)
ALTER TABLE agent_system_prompts ADD COLUMN sport text;

COMMENT ON COLUMN agent_system_prompts.sport IS
  'Sport this prompt is specific to (e.g., ''mlb''). NULL = default prompt used for all sports without a sport-specific prompt.';

-- Drop old unique index that only allowed one active prompt total
DROP INDEX IF EXISTS idx_agent_system_prompts_active;

-- New unique index: one active prompt per sport (null sport = default)
-- COALESCE maps null to '__default__' so the unique constraint works for the null case
CREATE UNIQUE INDEX idx_agent_system_prompts_active_per_sport
  ON agent_system_prompts (is_active, COALESCE(sport, '__default__'))
  WHERE is_active = true;

-- Update the existing v1_default row to explicitly have sport = NULL (no-op, but clear)
-- This ensures the default prompt continues to work for non-MLB sports
UPDATE agent_system_prompts SET sport = NULL WHERE id = 'v1_default';

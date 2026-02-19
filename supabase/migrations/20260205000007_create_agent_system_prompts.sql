-- =============================================================================
-- Migration: Create agent_system_prompts table
-- Purpose: Store remotely-editable system prompts for AI agent pick generation
-- Developers can update prompt text via Supabase dashboard without code deploys
-- =============================================================================

CREATE TABLE IF NOT EXISTS agent_system_prompts (
  id text PRIMARY KEY,                        -- slug identifier (e.g., 'default', 'v2_experimental')
  prompt_text text NOT NULL,                  -- the full system prompt template
  is_active boolean NOT NULL DEFAULT false,   -- only ONE should be active at a time
  version integer NOT NULL DEFAULT 1,         -- version number for tracking changes
  description text,                           -- developer notes about this prompt version
  updated_by text,                            -- who last edited (developer name/email)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure only one prompt is active at a time via a partial unique index
CREATE UNIQUE INDEX idx_agent_system_prompts_active
  ON agent_system_prompts (is_active)
  WHERE is_active = true;

-- Auto-update updated_at timestamp
CREATE TRIGGER set_agent_system_prompts_updated_at
  BEFORE UPDATE ON agent_system_prompts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Comment on table for dashboard discoverability
COMMENT ON TABLE agent_system_prompts IS
  'Remotely-editable system prompts for AI agent pick generation. Only one row should have is_active=true at a time.';

COMMENT ON COLUMN agent_system_prompts.prompt_text IS
  'The system prompt template. Use {{AGENT_NAME}}, {{AGENT_EMOJI}}, {{AGENT_SPORTS}}, {{PERSONALITY_INSTRUCTIONS}}, {{CUSTOM_INSIGHTS}}, {{CONSTRAINTS}} as placeholders for dynamic per-agent content.';

-- RLS: Allow service role full access (edge functions use service role key)
-- No user-facing RLS needed since this is developer-only
ALTER TABLE agent_system_prompts ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS by default, but add a read policy for anon just in case
CREATE POLICY "Allow read access to active system prompts"
  ON agent_system_prompts
  FOR SELECT
  USING (is_active = true);

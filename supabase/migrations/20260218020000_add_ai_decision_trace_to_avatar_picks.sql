-- Add AI decision trace metadata for agent pick auditing
ALTER TABLE public.avatar_picks
  ADD COLUMN IF NOT EXISTS ai_decision_trace jsonb;


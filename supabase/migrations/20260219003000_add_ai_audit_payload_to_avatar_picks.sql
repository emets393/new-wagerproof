ALTER TABLE public.avatar_picks
  ADD COLUMN IF NOT EXISTS ai_audit_payload jsonb;

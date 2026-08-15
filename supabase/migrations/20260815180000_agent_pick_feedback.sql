-- =============================================================================
-- Agent pick feedback ("How did we do?") from agent detail.
-- Append-only inbox so we can periodically review pick-quality reports.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.agent_pick_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.avatar_profiles(id) ON DELETE SET NULL,
  agent_name text,
  user_description text NOT NULL DEFAULT '',
  picks_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  agent_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  platform text NOT NULL DEFAULT 'web'
    CHECK (platform IN ('web', 'ios', 'android')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_pick_feedback_created_at
  ON public.agent_pick_feedback (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_pick_feedback_agent_id
  ON public.agent_pick_feedback (agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_pick_feedback_user_id
  ON public.agent_pick_feedback (user_id);

COMMENT ON TABLE public.agent_pick_feedback IS
  'User reports from the agent-detail "How did we do?" card. Review periodically.';

ALTER TABLE public.agent_pick_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can submit agent pick feedback" ON public.agent_pick_feedback;
CREATE POLICY "Users can submit agent pick feedback"
  ON public.agent_pick_feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read their own agent pick feedback" ON public.agent_pick_feedback;
CREATE POLICY "Users can read their own agent pick feedback"
  ON public.agent_pick_feedback
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can read all agent pick feedback" ON public.agent_pick_feedback;
CREATE POLICY "Admins can read all agent pick feedback"
  ON public.agent_pick_feedback
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete agent pick feedback" ON public.agent_pick_feedback;
CREATE POLICY "Admins can delete agent pick feedback"
  ON public.agent_pick_feedback
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT ON public.agent_pick_feedback TO authenticated;
GRANT DELETE ON public.agent_pick_feedback TO authenticated;

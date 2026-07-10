-- MLB Historical Analysis saved filters (main project).
-- Mirrors nfl_analysis_saved_filters / cfb_analysis_saved_filters.

CREATE TABLE IF NOT EXISTS public.mlb_analysis_saved_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  bet_type text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mlb_analysis_saved_filters_user_created_idx
  ON public.mlb_analysis_saved_filters (user_id, created_at DESC);

ALTER TABLE public.mlb_analysis_saved_filters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mlb_analysis_saved_filters_select_own ON public.mlb_analysis_saved_filters;
CREATE POLICY mlb_analysis_saved_filters_select_own
  ON public.mlb_analysis_saved_filters FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS mlb_analysis_saved_filters_insert_own ON public.mlb_analysis_saved_filters;
CREATE POLICY mlb_analysis_saved_filters_insert_own
  ON public.mlb_analysis_saved_filters FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS mlb_analysis_saved_filters_delete_own ON public.mlb_analysis_saved_filters;
CREATE POLICY mlb_analysis_saved_filters_delete_own
  ON public.mlb_analysis_saved_filters FOR DELETE
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON public.mlb_analysis_saved_filters TO authenticated;

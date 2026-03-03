-- =============================================================================
-- Agent Pick Overlap RPC
-- Batch lookup: for a set of pick IDs, find other public agents who made the
-- same pick (same game_id, bet_type, and normalized pick_selection).
-- =============================================================================

-- Composite expression index for fast overlap lookups
CREATE INDEX IF NOT EXISTS idx_avatar_picks_overlap
  ON public.avatar_picks (game_id, bet_type, (lower(trim(pick_selection))));

-- Batch RPC: returns overlap rows for an array of source pick IDs
CREATE OR REPLACE FUNCTION public.get_agent_pick_overlap_batch(p_pick_ids uuid[])
RETURNS TABLE (
  source_pick_id uuid,
  overlap_avatar_id uuid,
  avatar_name text,
  avatar_emoji text,
  avatar_color text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH src AS (
    SELECT
      ap.id            AS pick_id,
      ap.avatar_id,
      ap.game_id,
      ap.bet_type,
      lower(trim(ap.pick_selection)) AS norm_selection
    FROM public.avatar_picks ap
    WHERE ap.id = ANY(p_pick_ids)
  )
  SELECT
    src.pick_id       AS source_pick_id,
    op.avatar_id      AS overlap_avatar_id,
    prof.name         AS avatar_name,
    prof.avatar_emoji,
    prof.avatar_color
  FROM src
  JOIN public.avatar_picks op
    ON  op.game_id  = src.game_id
    AND op.bet_type = src.bet_type
    AND lower(trim(op.pick_selection)) = src.norm_selection
    AND op.avatar_id != src.avatar_id
  JOIN public.avatar_profiles prof
    ON  prof.id = op.avatar_id
    AND prof.is_public  = true
    AND prof.is_active  = true
  ORDER BY src.pick_id, prof.name;
$$;

-- Grant access to authenticated and anon roles (public agent data)
GRANT EXECUTE ON FUNCTION public.get_agent_pick_overlap_batch(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_agent_pick_overlap_batch(uuid[]) TO anon;

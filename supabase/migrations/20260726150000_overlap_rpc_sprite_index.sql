-- =============================================================================
-- get_agent_pick_overlap_batch: return sprite_index
--
-- Agent avatars render as pixel-people sprites, never emoji, so every RPC that
-- feeds an avatar UI has to carry `sprite_index`. Without it the client can only
-- fall back to FNV-1a(avatar_id), which is right for the ~96% of agents that
-- have no explicit sprite but shows the WRONG character for the ~65 that do.
--
-- Returned RAW and nullable on purpose — the client applies
-- "explicit override wins, else hash" (src/utils/agentSprites.ts). Coalescing
-- here would collapse most avatars onto sprite 0.
--
-- `avatar_emoji` is still returned so any surface not yet migrated keeps working.
-- =============================================================================

-- Adding an OUT column changes the row type, which CREATE OR REPLACE refuses.
-- Wrapped in a transaction so the drop/recreate is atomic — this function is
-- live in the agents UI and must never be observably missing.
BEGIN;

DROP FUNCTION IF EXISTS public.get_agent_pick_overlap_batch(uuid[]);

CREATE FUNCTION public.get_agent_pick_overlap_batch(p_pick_ids uuid[])
RETURNS TABLE (
  source_pick_id uuid,
  overlap_avatar_id uuid,
  avatar_name text,
  avatar_emoji text,
  avatar_color text,
  avatar_sprite_index integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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
    prof.avatar_color,
    prof.sprite_index AS avatar_sprite_index
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

GRANT EXECUTE ON FUNCTION public.get_agent_pick_overlap_batch(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_agent_pick_overlap_batch(uuid[]) TO anon;

COMMIT;

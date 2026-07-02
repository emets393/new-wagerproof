-- User-chosen pixel-office character for an agent. The iOS client historically
-- DERIVED the character from a hash of the agent id (AgentSpriteIndex.forSeed);
-- the Settings screen now lets the owner pick one of the 8 sprites explicitly.
-- NULL = legacy behavior (hash-derived), so existing agents keep the character
-- they've always shown until their owner picks one.

ALTER TABLE public.avatar_profiles
  ADD COLUMN IF NOT EXISTS sprite_index integer
  CHECK (sprite_index IS NULL OR (sprite_index >= 0 AND sprite_index <= 7));

COMMENT ON COLUMN public.avatar_profiles.sprite_index IS
  'Owner-picked pixel-office character (0-7, the avatar_N sprite sheets). NULL = derive from a hash of the agent id (legacy).';

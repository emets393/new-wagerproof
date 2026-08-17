-- Preferred sportsbooks follow the signed-in profile across iOS, Android, and web.
-- NULL  = never set (first login may seed from this device).
-- {}    = user chose "all books".
-- {k..} = Odds-API book keys the user holds.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_sportsbooks text[];

COMMENT ON COLUMN public.profiles.preferred_sportsbooks IS
  'Odds-API book keys this user prefers. NULL = unset, empty = any book.';

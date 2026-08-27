-- APPLIED TO PROD (CFB project jpxnjuwglavsjbgbasnl) 2026-08-27 via MCP apply_migration.
--
-- Owner rule: a stale prop line must never LEAVE the server. Client apps
-- (anon/authenticated) query nfl_player_props without season/week filters on
-- older builds, and "latest snapshot per player" served backup QBs' 2023-2025
-- closing lines as a live 2026 board (Bagent O1.5 +200 from Nov 2023). The
-- client read policy is now scoped to the current football week's captures;
-- the service role bypasses RLS, so research, graders, and backfills keep the
-- full 1.4M-row history. Client-side season/week filters (web + mobile builds
-- from cd4da207b) remain as defense in depth.
--
-- Verified post-apply with the anon key: Bagent/Jameis unfiltered queries -> 0
-- rows; Maye/Darnold -> current 2026 wk1 lines only; service key -> all rows.
DROP POLICY IF EXISTS nfl_player_props_public_read ON public.nfl_player_props;
CREATE POLICY nfl_player_props_public_read ON public.nfl_player_props
  FOR SELECT TO public
  USING (snapshot_time > now() - interval '9 days');

-- Clients have no business writing an odds capture table — the hourly collector
-- uses the service key. The blanket write grants were inert (no RLS write
-- policies existed) but should never have been granted.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.nfl_player_props FROM anon, authenticated;

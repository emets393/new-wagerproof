-- Widget votes: Reddit-style up/down votes on game-detail widget cards.
-- Spec + contract: .claude/docs/34_widget_votes_share.md
--
-- ACCESS MODEL — RPC only. RLS is on with NO policies and every table privilege
-- is revoked from anon/authenticated, so the three tables are reachable only
-- through the SECURITY DEFINER functions below. That is deliberate and differs
-- from community_pick_votes (20250210000000), where clients write vote rows
-- directly: here nobody can read another user's vote, forge a voter id, or
-- touch a count.
--
-- WHY NO widget_key ALLOW-LIST: every new widget on any client would need a
-- seed migration, and prod drifts from migration history. Shape checks + the
-- rate limit bound the junk a single account can write.
--
-- WHY game_id IS ONLY SHAPE-CHECKED: games live in the CFB Supabase project,
-- votes live here in MAIN. There is nothing to foreign-key against.

-- ---------------------------------------------------------------- tables ---

CREATE TABLE IF NOT EXISTS public.widget_votes (
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sport      text        NOT NULL CHECK (sport IN ('nfl', 'cfb', 'nba', 'ncaab', 'mlb')),
  -- Printable ASCII, no surrounding whitespace. Same canonical key agent
  -- consensus joins on (see 18_agent_consensus.md "Join key").
  game_id    text        NOT NULL CHECK (game_id ~ '^[!-~]([ -~]{0,94}[!-~])?$'),
  widget_key text        NOT NULL CHECK (widget_key ~ '^[a-z][a-z0-9_]{1,47}$'),
  -- 0 = voted then retracted. Kept as a row (not deleted) so "changed their
  -- mind" stays distinguishable from "never voted" in the admin summary.
  vote       smallint    NOT NULL CHECK (vote IN (-1, 0, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, sport, game_id, widget_key)
);

-- get_widget_vote_summary scans by recency.
CREATE INDEX IF NOT EXISTS widget_votes_updated_at_idx ON public.widget_votes (updated_at);

-- Denormalized so a detail sheet reads O(widgets), not O(votes ever cast on the
-- game). Kept exact by the trigger below, in the voter's own transaction.
CREATE TABLE IF NOT EXISTS public.widget_vote_counts (
  sport      text        NOT NULL,
  game_id    text        NOT NULL,
  widget_key text        NOT NULL,
  upvotes    integer     NOT NULL DEFAULT 0 CHECK (upvotes >= 0),
  downvotes  integer     NOT NULL DEFAULT 0 CHECK (downvotes >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sport, game_id, widget_key)
);

-- One row per user. A count over widget_votes would not work as a limiter:
-- toggling ONE vote row forever never grows a row count.
CREATE TABLE IF NOT EXISTS public.widget_vote_rate_limits (
  user_id      uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  minute_start timestamptz NOT NULL,
  minute_count integer     NOT NULL,
  day          date        NOT NULL,
  day_count    integer     NOT NULL
);

ALTER TABLE public.widget_votes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.widget_vote_counts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.widget_vote_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.widget_votes, public.widget_vote_counts, public.widget_vote_rate_limits
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.widget_votes, public.widget_vote_counts, public.widget_vote_rate_limits
  TO service_role;

-- --------------------------------------------------------------- trigger ---

-- Applies each vote change to the counts row as a delta. A trigger (rather than
-- arithmetic inside cast_widget_vote) so EVERY write path is covered — most
-- importantly the ON DELETE CASCADE when an account is deleted, which never
-- goes near the RPC.
CREATE OR REPLACE FUNCTION public._apply_widget_vote_delta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_old smallint := CASE WHEN TG_OP = 'INSERT' THEN 0 ELSE OLD.vote END;
  v_new smallint := CASE WHEN TG_OP = 'DELETE' THEN 0 ELSE NEW.vote END;
  v_up   integer := (v_new = 1)::integer  - (v_old = 1)::integer;
  v_down integer := (v_new = -1)::integer - (v_old = -1)::integer;
  v_row  public.widget_votes;
BEGIN
  IF TG_OP = 'DELETE' THEN v_row := OLD; ELSE v_row := NEW; END IF;

  -- A vote is never re-pointed at another target; allowing it would need the
  -- delta split across two count rows. Nothing legitimate does this.
  IF TG_OP = 'UPDATE' AND (OLD.user_id, OLD.sport, OLD.game_id, OLD.widget_key)
       IS DISTINCT FROM (NEW.user_id, NEW.sport, NEW.game_id, NEW.widget_key) THEN
    RAISE EXCEPTION 'widget_votes keys are immutable' USING ERRCODE = '22023';
  END IF;

  IF v_up = 0 AND v_down = 0 THEN
    RETURN NULL;
  END IF;

  -- The upsert takes the counts row lock, so concurrent voters on the same
  -- widget serialize here and no delta is lost.
  INSERT INTO public.widget_vote_counts AS c (sport, game_id, widget_key, upvotes, downvotes)
  VALUES (v_row.sport, v_row.game_id, v_row.widget_key, GREATEST(v_up, 0), GREATEST(v_down, 0))
  -- Clamped at 0: if a count was ever hand-edited out of step, a decrement must
  -- not trip the CHECK and abort the vote — or, worse, an account deletion.
  ON CONFLICT (sport, game_id, widget_key) DO UPDATE
    SET upvotes    = GREATEST(c.upvotes + v_up, 0),
        downvotes  = GREATEST(c.downvotes + v_down, 0),
        updated_at = now();
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public._apply_widget_vote_delta() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS widget_votes_apply_delta ON public.widget_votes;
CREATE TRIGGER widget_votes_apply_delta
  AFTER INSERT OR UPDATE OR DELETE ON public.widget_votes
  FOR EACH ROW EXECUTE FUNCTION public._apply_widget_vote_delta();

-- ------------------------------------------------------------------ cast ---

CREATE OR REPLACE FUNCTION public.cast_widget_vote(
  p_sport      text,
  p_game_id    text,
  p_widget_key text,
  p_vote       integer
)
RETURNS TABLE (widget_key text, upvotes integer, downvotes integer, my_vote integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  -- The voter is ALWAYS the JWT subject. There is no user-id parameter to forge.
  v_uid     uuid := auth.uid();
  v_current smallint;
  v_minute  integer;
  v_day     integer;
  c_per_minute CONSTANT integer := 30;
  c_per_day    CONSTANT integer := 600;
  c_keys_per_game CONSTANT integer := 64;
BEGIN
  -- Anonymous-sign-in sessions carry the `authenticated` role too; they are
  -- free to mint, so they must not be able to vote.
  IF v_uid IS NULL OR COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  -- Validate here as well as in the table CHECKs so a bad call fails with a
  -- clean 22023 BEFORE it can spend rate-limit budget or take a lock.
  IF p_sport IS NULL OR p_sport NOT IN ('nfl', 'cfb', 'nba', 'ncaab', 'mlb')
     OR p_game_id IS NULL OR p_game_id !~ '^[!-~]([ -~]{0,94}[!-~])?$'
     OR p_widget_key IS NULL OR p_widget_key !~ '^[a-z][a-z0-9_]{1,47}$'
     OR p_vote IS NULL OR p_vote NOT IN (-1, 0, 1) THEN
    RAISE EXCEPTION 'Invalid widget vote' USING ERRCODE = '22023';
  END IF;

  -- One cast per user at a time. Without this, two devices can both read the
  -- old vote below under READ COMMITTED and both decide they are a real change.
  PERFORM pg_advisory_xact_lock(hashtextextended('widget_vote:' || v_uid::text, 0));

  SELECT wv.vote INTO v_current
  FROM public.widget_votes wv
  WHERE wv.user_id = v_uid AND wv.sport = p_sport
    AND wv.game_id = p_game_id AND wv.widget_key = p_widget_key;

  -- Only a real change writes or spends budget. Clearing a vote that was never
  -- cast must not create a row either.
  IF COALESCE(v_current, 0) <> p_vote THEN
    -- get_widget_votes returns every key ever voted on a game, so without a
    -- cap one account could pad a real game's payload for every reader with
    -- hundreds of junk keys. No sheet has anywhere near this many widgets.
    IF v_current IS NULL
       AND NOT EXISTS (SELECT 1 FROM public.widget_vote_counts c
                       WHERE c.sport = p_sport AND c.game_id = p_game_id AND c.widget_key = p_widget_key)
       AND (SELECT count(*) FROM public.widget_vote_counts c
            WHERE c.sport = p_sport AND c.game_id = p_game_id) >= c_keys_per_game THEN
      RAISE EXCEPTION 'Invalid widget vote' USING ERRCODE = '22023';
    END IF;

    -- Fixed UTC buckets (so up to 2x the per-minute figure can straddle a
    -- boundary — fine for an abuse brake). One atomic upsert: the increment
    -- and the read are the same statement. Over the limit we RAISE, which
    -- rolls the increment back — refused calls never consume budget.
    INSERT INTO public.widget_vote_rate_limits AS r (user_id, minute_start, minute_count, day, day_count)
    VALUES (v_uid, date_trunc('minute', now()), 1, (now() AT TIME ZONE 'utc')::date, 1)
    ON CONFLICT (user_id) DO UPDATE
      SET minute_count = CASE WHEN r.minute_start = EXCLUDED.minute_start THEN r.minute_count + 1 ELSE 1 END,
          minute_start = EXCLUDED.minute_start,
          day_count    = CASE WHEN r.day = EXCLUDED.day THEN r.day_count + 1 ELSE 1 END,
          day          = EXCLUDED.day
    RETURNING r.minute_count, r.day_count INTO v_minute, v_day;

    IF v_minute > c_per_minute OR v_day > c_per_day THEN
      RAISE EXCEPTION 'Too many votes, slow down' USING ERRCODE = 'program_limit_exceeded';
    END IF;

    -- The WHERE makes a concurrent duplicate (two devices, same tap) a no-op
    -- instead of a second write; the trigger would compute a zero delta anyway.
    INSERT INTO public.widget_votes AS wv (user_id, sport, game_id, widget_key, vote)
    VALUES (v_uid, p_sport, p_game_id, p_widget_key, p_vote::smallint)
    -- ON CONSTRAINT, not a column list: `widget_key` is also a RETURNS TABLE
    -- output variable in this function, so a bare column list is ambiguous
    -- (42702). Caught by supabase/tests/widgetVotes.test.ts.
    ON CONFLICT ON CONSTRAINT widget_votes_pkey DO UPDATE
      SET vote = EXCLUDED.vote, updated_at = now()
      WHERE wv.vote IS DISTINCT FROM EXCLUDED.vote;
  END IF;

  -- Return the fresh server counts so the client reconciles its optimistic
  -- state against the truth (other people voted while the sheet was open).
  RETURN QUERY
  SELECT p_widget_key,
         COALESCE(c.upvotes, 0),
         COALESCE(c.downvotes, 0),
         p_vote
  FROM (SELECT 1) AS one
  LEFT JOIN public.widget_vote_counts c
    ON c.sport = p_sport AND c.game_id = p_game_id AND c.widget_key = p_widget_key;
END;
$$;

COMMENT ON FUNCTION public.cast_widget_vote(text, text, text, integer) IS
  'Cast (+1/-1) or clear (0) the caller''s vote on one game-detail widget. Voter is auth.uid(). Rate limited. See .claude/docs/34_widget_votes_share.md.';

REVOKE ALL ON FUNCTION public.cast_widget_vote(text, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cast_widget_vote(text, text, text, integer) TO authenticated;

-- ------------------------------------------------------------------ read ---

CREATE OR REPLACE FUNCTION public.get_widget_votes(
  p_sport   text,
  p_game_id text
)
RETURNS TABLE (widget_key text, upvotes integer, downvotes integer, my_vote integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  -- Every column is table-qualified: the RETURNS TABLE names are PL/pgSQL
  -- variables here and shadow bare column references (42702) — the same trap
  -- that broke get_game_agent_consensus in 20260914180000.
  RETURN QUERY
  SELECT c.widget_key, c.upvotes, c.downvotes, COALESCE(wv.vote, 0)::integer
  FROM public.widget_vote_counts c
  LEFT JOIN public.widget_votes wv
    ON wv.user_id = v_uid AND wv.sport = c.sport
   AND wv.game_id = c.game_id AND wv.widget_key = c.widget_key
  WHERE c.sport = p_sport AND c.game_id = p_game_id
  ORDER BY c.widget_key
  LIMIT 100;
END;
$$;

COMMENT ON FUNCTION public.get_widget_votes(text, text) IS
  'Vote counts for every voted-on widget of one game, plus the caller''s own vote. Aggregates only: individual votes never leave the database.';

REVOKE ALL ON FUNCTION public.get_widget_votes(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_widget_votes(text, text) TO authenticated;

-- --------------------------------------------------------- admin summary ---

CREATE OR REPLACE FUNCTION public.get_widget_vote_summary(p_days integer DEFAULT 30)
RETURNS TABLE (
  sport text, widget_key text, upvotes bigint, downvotes bigint,
  retracted bigint, voters bigint, games bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT COALESCE(public.has_role(auth.uid(), 'admin'), false) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT wv.sport, wv.widget_key,
         count(*) FILTER (WHERE wv.vote = 1),
         count(*) FILTER (WHERE wv.vote = -1),
         count(*) FILTER (WHERE wv.vote = 0),
         count(DISTINCT wv.user_id),
         count(DISTINCT wv.game_id)
  FROM public.widget_votes wv
  WHERE wv.updated_at >= now() - make_interval(days => LEAST(GREATEST(COALESCE(p_days, 30), 1), 365))
  GROUP BY wv.sport, wv.widget_key
  ORDER BY count(*) DESC, wv.sport, wv.widget_key;
END;
$$;

COMMENT ON FUNCTION public.get_widget_vote_summary(integer) IS
  'Admin-only: per (sport, widget) vote totals over the trailing p_days (1-365). The product signal for which widgets users rate up or down.';

REVOKE ALL ON FUNCTION public.get_widget_vote_summary(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_widget_vote_summary(integer) TO authenticated;

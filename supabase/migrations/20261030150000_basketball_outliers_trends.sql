-- Basketball Outliers trends: the NBA/NCAAB counterparts of nfl_outliers_trend_cards + the NBA history / team-trends
-- substrate the cards are built from (college already had ncaab_games_hist + ncaab_team_trends, 2026-10-28).
-- Writers: new-wagerproof research/bball-odds/export_nba_games_hist.py (one-off history), cfb_automation
-- scripts/cfb/nba_team_trends_daily.py (daily), scripts/cfb/bball_outliers_cards.py --sport nba|ncaab (daily cards).
-- Applied to the CFB project (jpxnjuwglavsjbgbasnl) on 2026-10-30.

CREATE TABLE IF NOT EXISTS public.nba_games_hist (
    espn_game_id bigint PRIMARY KEY,
    season integer NOT NULL,                 -- END-year (2027 = 2026-27)
    date_et date NOT NULL,
    start_utc timestamptz,
    home_team text NOT NULL,
    away_team text NOT NULL,
    home_team_id integer,                    -- balldontlie ids (nba_teams_master.team_id_bdl)
    away_team_id integer,
    home_abbr text,
    away_abbr text,
    neutral_site boolean,
    game_type text,                          -- regular | postseason
    home_score integer,
    away_score integer,
    home_h1 numeric,
    away_h1 numeric,
    close_spread numeric,                    -- HOME line, consensus close (median across books, last capture before tip)
    close_total numeric,
    close_ml_home numeric,
    close_ml_away numeric,
    h1_spread numeric,
    h1_total numeric,
    h1_ml_home numeric,
    h1_ml_away numeric,
    tt_home numeric,
    tt_away numeric,
    line_source text,
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nba_games_hist_season ON public.nba_games_hist (season, date_et);
CREATE INDEX IF NOT EXISTS idx_nba_games_hist_home ON public.nba_games_hist (home_team_id);
CREATE INDEX IF NOT EXISTS idx_nba_games_hist_away ON public.nba_games_hist (away_team_id);
COMMENT ON TABLE public.nba_games_hist IS
    'Every NBA game since 2020-21 with final + first-half scores and the consensus close in every market (FG spread/total/ML, 1H spread/total/ML, team totals). Spread is the HOME line. Team ids are balldontlie. History from new-wagerproof research/bball-odds/export_nba_games_hist.py; the current season is appended daily by cfb_automation nba_team_trends_daily.py from nba_schedule + nba_odds_snapshots.';
ALTER TABLE public.nba_games_hist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read nba_games_hist" ON public.nba_games_hist;
CREATE POLICY "Public read nba_games_hist" ON public.nba_games_hist FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.nba_team_trends (
    team_id integer NOT NULL,                -- balldontlie
    team_abbr text,
    team_name text,
    season integer NOT NULL,
    through_date date,
    games integer,
    su_w integer, su_l integer, su_record text,
    ats_w integer, ats_l integer, ats_p integer, ats_pct numeric,
    ou_o integer, ou_u integer, ou_p integer, over_pct numeric,
    tt_o integer, tt_u integer, tt_games integer, tt_over_pct numeric,
    h1_su_w integer, h1_su_l integer,
    h1_ats_w integer, h1_ats_l integer, h1_ats_p integer, h1_ats_games integer, h1_ats_pct numeric,
    h1_ou_o integer, h1_ou_u integer, h1_ou_games integer, h1_over_pct numeric,
    last5_su text[], last5_ats text[], last5_ou text[], last5_tt text[], last5_h1_su text[], last5_h1_ats text[], last5_h1_ou text[],
    game_log jsonb NOT NULL DEFAULT '[]'::jsonb,
    splits jsonb NOT NULL DEFAULT '{}'::jsonb,
    matchups jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (season, team_id)
);
COMMENT ON TABLE public.nba_team_trends IS
    'Same contract as ncaab_team_trends / nfl_team_trends, keyed by balldontlie team_id: season-to-date record in 7 markets, cross-season last5_*, game_log (this season), splits {market: {overall|home|away|favorite|underdog|division|conference: {3|5|7: {h,l,p,n,pct}}}}, matchups {opp_team_id: per-market {h,n,pct} + games[]} for this season''s opponents. Written daily by cfb_automation nba_team_trends_daily.py.';
ALTER TABLE public.nba_team_trends ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read nba_team_trends" ON public.nba_team_trends;
CREATE POLICY "Public read nba_team_trends" ON public.nba_team_trends FOR SELECT USING (true);

-- One card table per sport, the nfl_outliers_trend_cards contract with (season, slate_date) in place of (season, week).
CREATE TABLE IF NOT EXISTS public.nba_outliers_trend_cards (
    card_id text PRIMARY KEY,
    season integer NOT NULL,
    slate_date date NOT NULL,                -- ET date of the slate
    game_id text NOT NULL,                   -- the id the /games feed uses for the matchup (NBA: ESPN game id)
    espn_game_id bigint,
    tip_utc timestamptz,
    matchup_label text NOT NULL,
    subject_kind text NOT NULL CHECK (subject_kind IN ('team', 'coach', 'referee', 'player')),
    subject_name text NOT NULL,
    subject_detail text,
    team_abbr text,
    team_id integer,
    player_id text,
    market_key text NOT NULL,                -- spread | moneyline | total | team_total | h1_spread | h1_total
    bet_type_label text NOT NULL,
    trend_value numeric NOT NULL,
    trend_sample_n integer NOT NULL,
    sort_rank numeric NOT NULL,
    trend_hit_side boolean NOT NULL,
    headshot_url text,
    rows jsonb NOT NULL DEFAULT '[]'::jsonb,
    betting_lines jsonb NOT NULL DEFAULT '[]'::jsonb,
    betting_lines_updated_at timestamptz,
    is_player_overflow boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nba_outliers_trend_cards_slate ON public.nba_outliers_trend_cards (season, slate_date);
CREATE INDEX IF NOT EXISTS idx_nba_outliers_trend_cards_game ON public.nba_outliers_trend_cards (game_id);
CREATE INDEX IF NOT EXISTS idx_nba_outliers_trend_cards_sort ON public.nba_outliers_trend_cards (slate_date, sort_rank DESC);
COMMENT ON TABLE public.nba_outliers_trend_cards IS
    'Render-ready Outliers trend cards for one day''s NBA slate (nfl_outliers_trend_cards contract, keyed by slate_date). Written by cfb_automation scripts/cfb/bball_outliers_cards.py --sport nba.';
ALTER TABLE public.nba_outliers_trend_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read nba_outliers_trend_cards" ON public.nba_outliers_trend_cards;
CREATE POLICY "Public read nba_outliers_trend_cards" ON public.nba_outliers_trend_cards FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.ncaab_outliers_trend_cards (
    card_id text PRIMARY KEY,
    season integer NOT NULL,
    slate_date date NOT NULL,
    game_id text NOT NULL,                   -- v_cbb_input_values.game_id (the CBBD game id the /games feed uses)
    espn_game_id bigint,
    tip_utc timestamptz,
    matchup_label text NOT NULL,
    subject_kind text NOT NULL CHECK (subject_kind IN ('team', 'coach', 'referee', 'player')),
    subject_name text NOT NULL,
    subject_detail text,
    team_abbr text,
    team_id integer,                         -- CBBD team id (ncaab_team_mapping.api_team_id)
    player_id text,
    market_key text NOT NULL,
    bet_type_label text NOT NULL,
    trend_value numeric NOT NULL,
    trend_sample_n integer NOT NULL,
    sort_rank numeric NOT NULL,
    trend_hit_side boolean NOT NULL,
    headshot_url text,
    rows jsonb NOT NULL DEFAULT '[]'::jsonb,
    betting_lines jsonb NOT NULL DEFAULT '[]'::jsonb,
    betting_lines_updated_at timestamptz,
    is_player_overflow boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ncaab_outliers_trend_cards_slate ON public.ncaab_outliers_trend_cards (season, slate_date);
CREATE INDEX IF NOT EXISTS idx_ncaab_outliers_trend_cards_game ON public.ncaab_outliers_trend_cards (game_id);
CREATE INDEX IF NOT EXISTS idx_ncaab_outliers_trend_cards_sort ON public.ncaab_outliers_trend_cards (slate_date, sort_rank DESC);
COMMENT ON TABLE public.ncaab_outliers_trend_cards IS
    'Render-ready Outliers trend cards for one day''s college basketball slate (nfl_outliers_trend_cards contract, keyed by slate_date). Written by cfb_automation scripts/cfb/bball_outliers_cards.py --sport ncaab.';
ALTER TABLE public.ncaab_outliers_trend_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read ncaab_outliers_trend_cards" ON public.ncaab_outliers_trend_cards;
CREATE POLICY "Public read ncaab_outliers_trend_cards" ON public.ncaab_outliers_trend_cards FOR SELECT USING (true);

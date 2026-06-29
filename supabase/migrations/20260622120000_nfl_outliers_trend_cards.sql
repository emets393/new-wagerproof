-- Pre-rendered Outliers trend cards for the NFL dry-run / production slate.
-- Populated by research/nfl-extreme-outcomes/gen_nfl_outliers_trend_cards.py

CREATE TABLE IF NOT EXISTS public.nfl_outliers_trend_cards (
    card_id text PRIMARY KEY,
    season integer NOT NULL,
    week integer NOT NULL,
    through_week integer NOT NULL,
    game_id text NOT NULL,
    matchup_label text NOT NULL,
    subject_kind text NOT NULL CHECK (subject_kind IN ('team', 'coach', 'referee', 'player')),
    subject_name text NOT NULL,
    subject_detail text,
    team_abbr text,
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

CREATE INDEX IF NOT EXISTS idx_nfl_outliers_trend_cards_slate
    ON public.nfl_outliers_trend_cards (season, week);

CREATE INDEX IF NOT EXISTS idx_nfl_outliers_trend_cards_game
    ON public.nfl_outliers_trend_cards (game_id);

CREATE INDEX IF NOT EXISTS idx_nfl_outliers_trend_cards_sort
    ON public.nfl_outliers_trend_cards (season, week, sort_rank DESC);

COMMENT ON TABLE public.nfl_outliers_trend_cards IS
    'Render-ready Outliers trend cards; iOS reads directly instead of assembling client-side.';

ALTER TABLE public.nfl_outliers_trend_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read nfl_outliers_trend_cards"
    ON public.nfl_outliers_trend_cards
    FOR SELECT
    USING (true);

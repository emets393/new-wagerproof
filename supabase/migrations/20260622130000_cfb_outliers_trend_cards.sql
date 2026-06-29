-- Pre-rendered Outliers trend cards for the CFB dry-run / production slate.
-- Populated by research/cfb-model/gen_cfb_outliers_trend_cards.py

CREATE TABLE IF NOT EXISTS public.cfb_outliers_trend_cards (
    card_id text PRIMARY KEY,
    season integer NOT NULL,
    week integer NOT NULL,
    through_week integer NOT NULL,
    game_id text NOT NULL,
    matchup_label text NOT NULL,
    subject_kind text NOT NULL CHECK (subject_kind IN ('team', 'coach')),
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

CREATE INDEX IF NOT EXISTS idx_cfb_outliers_trend_cards_slate
    ON public.cfb_outliers_trend_cards (season, week);

CREATE INDEX IF NOT EXISTS idx_cfb_outliers_trend_cards_game
    ON public.cfb_outliers_trend_cards (game_id);

CREATE INDEX IF NOT EXISTS idx_cfb_outliers_trend_cards_sort
    ON public.cfb_outliers_trend_cards (season, week, sort_rank DESC);

COMMENT ON TABLE public.cfb_outliers_trend_cards IS
    'Render-ready CFB Outliers trend cards; iOS reads directly instead of assembling client-side.';

ALTER TABLE public.cfb_outliers_trend_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read cfb_outliers_trend_cards" ON public.cfb_outliers_trend_cards;
CREATE POLICY "Public read cfb_outliers_trend_cards"
    ON public.cfb_outliers_trend_cards
    FOR SELECT
    USING (true);

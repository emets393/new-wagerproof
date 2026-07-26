-- Widget headline summaries
--
-- Adds the big plain-language one-liner that sits at the TOP of each game-detail
-- widget ("Prediction markets show no clear favorite, but 68% of the money is on
-- Pittsburgh"). This reuses the existing ai_completions row rather than adding a
-- table: the (game_id, sport_type, widget_type) key is already exactly right, and
-- the widget already reads that row for its body prose.
--
-- headline_text is deliberately SEPARATE from completion_text. completion_text is
-- the long "What this means" paragraph; headline_text is the one-sentence verdict.
-- Keeping both lets the two surfaces diverge (and lets us roll the headline out
-- without regenerating existing bodies).
--
-- Every headline is written by one model then judged by a second (see
-- agents-v3/trigger/dailyWidgetSummaries.ts). Only qc_status='pass' is published
-- to users, so the QC columns are load-bearing, not just telemetry.

-- ---------------------------------------------------------------------------
-- 1. Headline + QC columns
-- ---------------------------------------------------------------------------

ALTER TABLE ai_completions
  ADD COLUMN IF NOT EXISTS headline_text TEXT,
  ADD COLUMN IF NOT EXISTS headline_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS headline_model TEXT,
  -- 'pass' | 'corrected' | 'fail'. NULL = no QC pass has run yet (legacy rows).
  ADD COLUMN IF NOT EXISTS qc_status TEXT,
  ADD COLUMN IF NOT EXISTS qc_notes TEXT,
  ADD COLUMN IF NOT EXISTS qc_model TEXT;

ALTER TABLE ai_completions
  DROP CONSTRAINT IF EXISTS ai_completions_qc_status_check;
ALTER TABLE ai_completions
  ADD CONSTRAINT ai_completions_qc_status_check
  CHECK (qc_status IS NULL OR qc_status IN ('pass', 'corrected', 'fail'));

COMMENT ON COLUMN ai_completions.headline_text IS
  'One-sentence plain-language verdict shown large+bold at the top of the widget. Only rendered when qc_status IN (''pass'',''corrected'').';
COMMENT ON COLUMN ai_completions.qc_status IS
  'Verdict from the second-pass quality-check agent. fail => headline withheld from users.';

-- The read path is "give me every published headline for this game", so index the
-- lookup key with the QC gate folded in.
CREATE INDEX IF NOT EXISTS idx_ai_completions_published_headlines
  ON ai_completions (game_id, sport_type)
  WHERE headline_text IS NOT NULL AND qc_status IN ('pass', 'corrected');

-- ---------------------------------------------------------------------------
-- 2. Admit MLB
-- ---------------------------------------------------------------------------
-- MLB was excluded when these tables were created (nfl/cfb only) and never added
-- when basketball was. It is the richest data set in the app and has the most
-- detail widgets, so it is the biggest single win for this feature.

ALTER TABLE ai_completions
  DROP CONSTRAINT IF EXISTS ai_completions_sport_type_check;
ALTER TABLE ai_completions
  ADD CONSTRAINT ai_completions_sport_type_check
  CHECK (sport_type IN ('nfl', 'cfb', 'nba', 'ncaab', 'mlb'));

ALTER TABLE ai_completion_configs
  DROP CONSTRAINT IF EXISTS ai_completion_configs_sport_type_check;
ALTER TABLE ai_completion_configs
  ADD CONSTRAINT ai_completion_configs_sport_type_check
  CHECK (sport_type IN ('nfl', 'cfb', 'nba', 'ncaab', 'mlb'));

COMMENT ON COLUMN ai_completions.sport_type IS 'Sport type: nfl, cfb, nba, ncaab, or mlb';
COMMENT ON COLUMN ai_completion_configs.sport_type IS 'Sport type: nfl, cfb, nba, ncaab, or mlb';

-- ---------------------------------------------------------------------------
-- 3. Seed prompts for the widgets we are launching with
-- ---------------------------------------------------------------------------
-- Widget types are keyed to the BETTING QUESTION, not to a UI component, because
-- web and the native apps render different component trees for the same question
-- (web NFL has a Spread card; iOS NFL renders pick-groups off nfl_dryrun_picks).
-- Keying to the question means one generated row serves every surface.
--
--   market_odds          -> the Polymarket / prediction-market widget (all 5 sports)
--   spread_prediction    -> already seeded for nfl/cfb/nba/ncaab; MLB has no spread widget
--   ou_prediction        -> already seeded for nfl/cfb/nba/ncaab; add MLB
--   moneyline_prediction -> MLB only today (the other sports have no dedicated ML widget)

-- Shared voice rules. The writer prompt is per (widget_type, sport_type) so admins
-- can tune one sport without touching the others, but they all start from this.
DO $$
DECLARE
  v_voice TEXT := E'\n\nWRITING RULES:\n'
    || E'- Output ONE sentence, max 20 words. It is rendered large and bold at the top of the widget.\n'
    || E'- Plain English a casual bettor understands. No jargon like "EV", "vig", "CLV".\n'
    || E'- Lead with the conclusion, not the setup.\n'
    || E'- Use ONLY numbers present in the supplied data. Never invent or round-trip a figure.\n'
    || E'- If the data is genuinely inconclusive, say so plainly - that is a useful answer.\n'
    || E'- Never give betting advice or tell the user what to bet. Describe what the data shows.\n'
    || E'- No emojis, no markdown, no quotes around the sentence.\n'
    || E'Respond with JSON: {"headline": "<your sentence>"}';
BEGIN

  -- market_odds: all five sports. This is the widget from the feature request -
  -- "no clear favorite, but X% of the money is on Pittsburgh".
  INSERT INTO ai_completion_configs (widget_type, sport_type, system_prompt, enabled)
  SELECT
    'market_odds',
    s.sport,
    'You summarize a prediction-market (Polymarket) widget for a single game. '
    || 'You are given the market''s implied win probabilities for the moneyline, the spread and '
    || 'the total, alongside the sportsbook lines. Say what the prediction market believes.'
    || E'\n\n'
    || 'TREAT EACH MARKET SEPARATELY. The side favored on the moneyline is frequently NOT the '
    || 'side favored on the spread, and the total is a separate question again. Never carry a '
    || 'conclusion from one market over to another.'
    || E'\n'
    || 'Only mention a disagreement with the sportsbook when the two genuinely differ by a wide '
    || 'margin. If they broadly agree, just say what the market believes - do not manufacture a '
    || 'gap. You are given sportsbook PRICES, not sportsbook probabilities, so do not claim a '
    || 'numeric gap between the two unless it is obvious.'
    || E'\n'
    || 'If a market is missing from the data, do not mention it. Prefer describing ONE market '
    || 'clearly over cramming all three in.'
    || v_voice,
    true
  FROM (VALUES ('nfl'), ('cfb'), ('nba'), ('ncaab'), ('mlb')) AS s(sport)
  ON CONFLICT (widget_type, sport_type) DO NOTHING;

  -- ou_prediction for MLB (the other four sports already have a row).
  INSERT INTO ai_completion_configs (widget_type, sport_type, system_prompt, enabled)
  VALUES (
    'ou_prediction',
    'mlb',
    'You summarize the model''s total (over/under) projection for one MLB game. '
    || 'You are given the model''s projected run total, the Vegas total, the resulting edge, '
    || 'and the first-5-innings equivalents where available. State which side the model leans '
    || 'and by how many runs. Park factors, weather and starting pitchers are the usual drivers - '
    || 'name one only if the data supports it.'
    || v_voice,
    true
  )
  ON CONFLICT (widget_type, sport_type) DO NOTHING;

  -- moneyline_prediction: MLB only. This is the "Moneyline Projection" widget.
  INSERT INTO ai_completion_configs (widget_type, sport_type, system_prompt, enabled)
  VALUES (
    'moneyline_prediction',
    'mlb',
    'You summarize the model''s moneyline projection for one MLB game. '
    || 'You are given the model''s win probability for each side, the Vegas moneyline prices, '
    || 'the edge percentage, and the first-5-innings equivalents where available. '
    || 'Name the side the model favors and how strongly. If the model and the market agree, '
    || 'say that plainly rather than manufacturing a disagreement.'
    || v_voice,
    true
  )
  ON CONFLICT (widget_type, sport_type) DO NOTHING;

END $$;

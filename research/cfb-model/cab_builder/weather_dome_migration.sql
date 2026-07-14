-- CFB analysis: weather condition + dome, backfilled from CFBD /games/weather (2016-2025)
-- Target warehouse: jpxnjuwglavsjbgbasnl (collegeFootballSupabase — production for this feature).
-- Idempotent — safe to re-run. Does not load data; see load_cfb_weather_dome.py for backfill.

ALTER TABLE cfb_analysis_base ADD COLUMN IF NOT EXISTS weather_condition text;
ALTER TABLE cfb_analysis_base ADD COLUMN IF NOT EXISTS dome boolean;

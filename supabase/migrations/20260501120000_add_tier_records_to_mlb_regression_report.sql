-- Add tier_records column so the regression report ETL can persist the
-- per-tier W-L-P + ROI snapshot. The narrative consumes this directly
-- to write the "Model Performance Update" section. Replaces the legacy
-- cumulative_record (which counted every pick ever, including pre-tier
-- picks that no longer surface in the UI).
--
-- Without this column, the upsert at the end of mlb_daily_regression_report.py
-- fails with PGRST204 ("Could not find the 'tier_records' column...") — the
-- entire report payload is rejected and the new narrative is discarded.
ALTER TABLE public.mlb_regression_report
  ADD COLUMN IF NOT EXISTS tier_records jsonb;

COMMENT ON COLUMN public.mlb_regression_report.tier_records IS
  'Per-tier season-to-date W-L-P + units + ROI for the 4 Perfect Storm '
  'tiers (hammer, ps, lean, watch) plus a combined total. Computed by '
  'build_tier_record_summary() in mlb_daily_regression_report.py.';

-- ============================================================================
-- Migration: Enable Agent Performance V2 Flags
-- Description:
--   - Enables the V2 agent read-path flags for production testing
--   - Keeps keys stable so legacy clients remain unaffected
-- ============================================================================

INSERT INTO public.app_settings (setting_key, setting_value)
VALUES
  ('agents_v2_leaderboard_enabled', jsonb_build_object('enabled', true)),
  ('agents_v2_top_picks_enabled', jsonb_build_object('enabled', true)),
  ('agents_v2_agent_detail_enabled', jsonb_build_object('enabled', true)),
  ('agents_v2_shadow_compare_enabled', jsonb_build_object('enabled', true))
ON CONFLICT (setting_key)
DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  updated_at = NOW();

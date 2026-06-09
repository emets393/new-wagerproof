# 080 — Agent settings conditional fields (sport-specific)

**Status**: deferred
**Owner**: B14 wizard implementer (shared input primitives)
**Source**: `wagerproof-mobile/app/(drawer)/(tabs)/agents/[id]/settings.tsx:622-752` (Data Trust + conditional blocks)

## Summary

The RN settings form exposes sport-conditional fields:

- **Football (NFL/CFB)**: `fade_public`, `public_threshold`, `weather_impacts_totals`, `weather_sensitivity`
- **Basketball (NBA/NCAAB)**: `trust_team_ratings`, `pace_affects_totals`
- **NBA only**: `weight_recent_form`, `ride_hot_streaks`, `fade_cold_streaks`, `trust_ats_trends`, `regress_luck`
- **NBA/NCAAB**: `fade_back_to_backs`
- **NCAAB only**: `upset_alert`
- All sports: `home_court_boost`

The RN screen also has a Custom Insights section (4 long-text fields:
betting_philosophy, perceived_edges, avoid_situations, target_situations).

B15's Swift port includes the always-present fields (risk, dog, o/u,
confidence, chase_value, max picks, autopilot, visibility, delete) but does
not yet expose the conditional + custom-insights inputs.

## Required work

1. Build the `SliderInput`, `ToggleInput`, `OddsInput`, and long-text inputs
   in `Features/Agents/Components/Inputs/` (shared with B14 wizard).
2. Add a "Data Trust" section to `AgentSettingsView` that mirrors the RN
   conditional logic — surface only the inputs relevant to the agent's
   `preferredSports`.
3. Add a "Custom Insights" section with the four text areas (50/500/300/300
   character limits) backed by the existing `AgentCustomInsights` model.

The model layer (`AgentPersonalityParams`, `AgentCustomInsights`) already
supports every field; this is purely a UI/wiring task.

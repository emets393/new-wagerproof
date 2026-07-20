# Cross-sport filter parity — handoff from parallel session (2026-07-19)

Recorded verbatim from the completing session. Treat everything below as DONE and LIVE — verified in
this session (pages contain the Systems UI + split heroes; 67/67 tests pass).

Warehouse (jpxnjuwglavsjbgbasnl), via Supabase migrations mlb_last_game_h2h_parity_cols,
cfb_rest_bye_cols, systems_filter_parity_rpc_extend:
- mlb_analysis_base: new leak-safe columns last_rl_covered, last_ou_over, last_is_favorite,
  opp_last_rl_covered, opp_last_ou_over, opp_last_is_favorite, h2h_last_rl_cover, h2h_last_home,
  h2h_last_fav — window LAG over (game_date, time_et, game_pk), DH-safe. Validated (99.3% agree vs
  prev_result; H2H pairing 100% consistent with the Python-built h2h_last_win).
- cfb_analysis_base: new rest_days (date diff per team+season) and pre_bye (next game ≥13 days out).
  Regular season only — bowls/playoffs have NULL game_date so they never enter rest chains.
- RPCs nfl_analysis / cfb_analysis / mlb_analysis extended and probed: NFL+CFB accept
  opp_loss_streak_min/max, opp_ppg_min/max, opp_pa_pg_min/max; CFB adds rest_min/rest_max/pre_bye and
  last_blowout REMOVED; MLB adds last_covered/last_over (1/0), last_favorite (bool),
  opp_last_covered/opp_last_over/opp_last_favorite, h2h_last_ats_win (1/0 = RL cover),
  h2h_last_home/h2h_last_fav (bool).

Frontend (working tree):
- normalizeSavedFilterSnapshot.ts: shared as-of type gained oppLossStreak/oppPpg/oppPaPg (NFL+CFB);
  CFB gained restBye, lost lastBlowout (old saves auto-convert to margin via cfbBlowoutFallback); MLB
  snapshot gained lastAts/lastTotal/lastRole + opp mirrors + h2hLastAts/h2hLastHome/h2hLastFav.
- Schemas updated: NFL 69 dims, CFB 68, MLB 72 (incl. betType); new dims classified side-BREAKING.
  CFB restBye: off_bye → rest_min=13, short → rest_max=6 (CFB-specific), pre_bye → true.
- NFLAnalytics.tsx: +3 Opponent Record controls. CFBAnalytics.tsx + MLBAnalytics.tsx: FULL Systems
  filter UI (all groups, chips, resetAll, snapshot/restore round-trip) + SymmetricSplitHero gated by
  isSideSymmetricCfb / isSideSymmetricMlb.
- NL artifacts regenerated (all 3) + nl-filter-patch redeployed — chat knows all new dims.
- 67/67 tests in src/features/analysis; no new tsc errors.

Docs: 05_LIVE_FILTER_KEYS.md § "Cross-sport filter parity (2026-07-19)" = authoritative key contract.

Product decisions (do not revisit): no avg-cover-margin for MLB; CFB blowout permanently replaced by
signed margin; MLB last_favorite inherits base is_favorite semantics (ML < 0 — both sides of a
−105/−115 game count).

Still open: *_analysis_upcoming RPCs don't expose as-of/new cols; NBA/NCAAB unbuilt; 6 duplicate
mixed-case Ath rows await owner-OK delete; iOS port pending; branch not pushed.

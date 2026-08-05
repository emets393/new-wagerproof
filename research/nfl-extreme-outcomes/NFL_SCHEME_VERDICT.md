# NFL Scheme & Formation Research — program verdict (vault)

> Hand-written verdict for the formations/coverage research program (2026-08-02). Companion to
> `NFL_PROPS_VERDICT.md` (the prop model program). Everything graded at the close, per-season,
> sigma printed, complements run, `sign_conventions.assert_ats_sane` enforced.

## The data foundation (built, committed, rerunnable)
`nfl_scheme_context.py` → three leak-safe as-of tables from `scheme_plays.parquet` (nflverse PBP +
participation + FTN charting, 2018–2025; coverage labeled on ~60% of pass plays):

| Table | Grain | Holds |
|---|---|---|
| `nfl_def_scheme.parquet` | season-week-team | defense identity entering the game: two-high rate (COVER 2/4/6/2-MAN share), man rate, pressure rate, blitzers, heavy/light box; s2d + l8 |
| `nfl_off_scheme.parquet` | season-week-team | offense identity: aDOT, deep rate, shotgun, pass EPA, time-to-throw, PA/motion/RPO (FTN 2022+) |
| `nfl_player_vs_scheme.parquet` | season-week-player | receiver CAREER as-of splits: yds/target + EPA/target + targets vs MAN vs ZONE and vs 1-HIGH vs 2-HIGH, plus differentials (62% of player-weeks have ≥15 tgts both families) |

Smell test passed: 2025 two-high ladder = BUF .57 / MIN .58 top (McDermott/Flores), CLE .20 bottom
(Schwartz). All windows `shift(1)` before rolling — the current game never feeds its own feature.

## What WORKED — player-prop feature family (the program's payoff)
Raw interaction cells ("man-beater vs man-heavy D → over") are **PRICED** — every cell at its
unconditional rate (`nfl_prop_scheme_battery.py`). But as **model features** the same data converts
the receiving UNDER side from dead to Tier-1 (`nfl_prop_scheme_sweep.py`, matched baselines):
- **receptions UNDER (point p65): 54.8%/−4.5 → 61.5%/+7.5 ROI** (n=650, 62/61 both seasons, >σ)
- **reception_yds UNDER (q-band): 51.2%/−4.1 → 56.7%/+6.8** (n=402, 56/58 both)
- receiving OVER band cells unchanged (+7.6/+10.6) → receiving is now genuinely two-sided
- pass_yds: −0.455 MAE gain did NOT convert to bets → SCHEME excluded there
Chosen sets: `nfl_prop_chosen_v3.json` (SCHEME → receptions, reception_yds only).

## What DIDN'T — game markets (a genuine, well-tested null)
`nfl_scheme_matchup_study.py` + `nfl_scheme_game_models.py`:
- **Increment-over-close test** (predict actual from [line] vs [line + both teams' scheme
  identities], GBM WF 2019-25 wk4-18): FG TOTAL **+0.373 MAE (worse)**, FG SPREAD **+0.515 (worse)**.
  Game lines fully price team-level scheme identity. No bet cell significant.
- **Owner hypothesis** (offense struggled recently vs this defense TYPE → fade on the rematch of
  type): dead both directions on sides (45.7%/48.0%) after the sign fix.
- **TT / 1H**: inherit the null via the derived-market rotation law (parents show zero increment).
- **LAW: scheme granularity pays at the PLAYER level, not the game level.** Don't re-run game-level
  scheme screens.

## TRACKING (real pattern, under-powered — watch live 2026, do not flag)
- **Extreme-vertical-offense ATS fade** (main effect, no opponent condition): 52.0% @p75 → 54.0%/+3.1
  @p92, 6/8 seasons, complement symmetric (46%). A lean, under sigma.
- **Blitz-heavy D vs slow-release QB → fade offense**: 58.8%, 3/4 seasons, n=102; clean interaction
  (vanishes vs quick-release). Under-powered.
- Unexplained UNDER residue (58.9%, 8/8) in thrived-vs-2-high cells — no mechanism, treated as scan
  noise unless it earns one.

## Method incidents (why the guardrails exist)
- **Spread-sign bug #2**: nflverse `spread_line>0` = HOME FAVORED (`ats = result − spread_line`);
  the flipped sign made favorites "cover" 76% and produced fake 66% cells. Canonical conventions +
  mandatory favorite-cover assert now live in `sign_conventions.py` — import in every ATS script.
- Coach-move ATS numbers corrected after the fix: new-coach teams wk1-3 = 38.7% (early-fade
  candidate), not the flat 44% first recorded (see FOOTBALL_PROFILES.md).

## PRODUCT USE — the user-facing matchup card (supported, with framing rules)
The tables directly support a per-prop scheme-matchup insight, e.g.:
> "J. Jefferson averages **9.8 yds/target vs man** (7.9 vs zone). The Bears play **man at the
> 4th-highest rate** in the NFL."
Rules: (1) this is **context, not an edge** — the raw interaction is priced, so never render it as a
pick by itself; the EDGE layer is the model flags (scheme-aware UNDER / band OVER cells). (2) Show
the split only where the career sample supports it (≥15 targets per family — already enforced in
the differential columns). (3) Ship path: add `nfl_scheme_context.py` to `run_nfl_week.sh` (its
input `scheme_plays.parquet` is already refreshed weekly by `b46_pull_scheme.py`), load a
`nfl_player_scheme_splits` table to Supabase, join by player_id + opponent on the prop card.

## STILL OPEN
- NGS own-form family leak audit (excluded from models until resolved).
- OC-level scheme transfer (needs PFR scrape; HC-only covered in FOOTBALL_PROFILES.md).
- Live 2026 tracking for the two under-powered game-market leans.

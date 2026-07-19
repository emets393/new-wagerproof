# Systems / Historical Analysis — Data Coverage by Sport & Market

**Purpose:** the single source of truth for *how far back our data goes* for every betting market,
so we can (a) build the Systems feature honestly and (b) show users exactly what history backs each trend.

**Confidence:** NFL/CFB/MLB ranges are sourced from the live warehouse builders + Analytics page code
(`src/pages/*Analytics.tsx`, `nfl/cfb/mlb_analysis_base`). NBA/NCAAB ranges are **verified directly** by
reading min/max `commence_time` from the parsed parquet in `research/bball-odds/data/parquet/`
(2026-07-18). Where the README disagreed with the data, the data wins (see NBA/NCAAB note).

**Depth tiers used below:**
- **DEEP** = 6+ seasons, safe for serious backtesting
- **MODERATE** = ~4–5 seasons
- **LIMITED** = ≤3 seasons — flag in UI, warn on thin samples

---

## Quick reference

| Sport | Market group | Coverage | Seasons | Tier | Warehoused? |
|-------|--------------|----------|---------|------|-------------|
| **NFL** | Full-game spread / ML / total | 2018–2025 | 8 | DEEP | ✅ live (`nfl_analysis_base`) |
| **NFL** | 1H spread / ML / total, team total | 2023–2025 | 3 | LIMITED | ✅ live |
| **CFB** | Full-game spread / total | 2016–2025 | 10 | DEEP | ✅ live (`cfb_analysis_base`) |
| **CFB** | Full-game moneyline | 2021–2025 | 5 | MODERATE | ✅ live (ML odds start 2021) |
| **CFB** | 1H spread / ML / total, team total | 2023–2025 | 3 | LIMITED | ✅ live |
| **MLB** | Moneyline / run line / total | 2023–2026 | 4 | MODERATE | ✅ live (`mlb_analysis_base`) |
| **MLB** | F5 ML / F5 run line / F5 total | 2023–2026 | 4 | MODERATE | ✅ live (odds caveats below) |
| **NBA** | Full-game h2h / spread / total | 2022-23 → 2025-26 | 4 | MODERATE | ❌ parquet only |
| **NBA** | 1H + team totals | 2023-24 → 2025-26 | 3 | LIMITED | ❌ parquet only |
| **NBA** | Player props (10 markets) | 2023-24 → 2025-26 | 3 | LIMITED | ❌ parquet only |
| **NCAAB** | Full-game h2h / spread / total | 2022-23 → 2025-26 | 4 | MODERATE | ❌ parquet only |
| **NCAAB** | 1H + team totals | 2023-24 → 2025-26 | 3 | LIMITED | ❌ parquet only |
| **NCAAB** | Player props | — | — | none acquired | ❌ |

---

## Details & caveats

### NFL — `nfl_analysis_base` (live)
- Full-game **spread, moneyline, total** = **2018–2025** (8 seasons), deep enough for real backtests.
- **1H spread/ML/total and team total = 2023+ only** (odds capture started 2023). UI floors the season
  picker to 2023 for these and shows a "Limited history (2023+)" badge (`LIMITED_MARKETS` in NFLAnalytics.tsx).
- **Moneyline ROI is hidden** — ML shows W-L record only (no historical ML price stored; ROI not computable).

### CFB — `cfb_analysis_base` (live)
- Full-game **spread & total = 2016–2025** (10 seasons) — our deepest history.
- **Moneyline = 2021+ only** — CFB ML odds don't exist in source before 2021; earlier games have null `team_ml`.
- **1H + team total = 2023+** (same limited badge as NFL).
- Weather *condition text* is complete 2022+, partial 2018–2021, sparse 2016–2017 (CFBD source) — a
  secondary caveat only relevant to weather filters, not the core markets.

### MLB — `mlb_analysis_base` (live)
- **Moneyline, run line, total = 2023–2026** (4 seasons). All MLB markets are 2023+; no deep history exists.
- **F5 (First Five) ML / RL / total = 2023–2026.** Odds caveats:
  - **F5 ML**: no historical F5 moneyline odds captured → ROI shows "—".
  - **F5 run line**: no historical F5 RL lines → uses an honest proxy (favorite −0.5 / underdog +0.5).
  - **F5 total**: real line (`f5_total_line`).

### NBA — parquet only, **NOT yet warehoused** (`research/bball-odds/data/parquet/`)
- **Full-game h2h / spread / total = 2022-23 → 2025-26** (4 seasons). Verified: `openclose_nba_2022-23`
  earliest `commence_time` = 2022-10-18.
- **1H + team totals = 2023-24 → 2025-26** (3 seasons; `h1tt_nba_*`). T-60 closes only.
- **Player props (10 markets) = 2023-24 → 2025-26** (3 seasons; `props_nba_*`, ~3.1M rows).
- ⚠️ **README said "2020+" — that is not backed by data.** The earliest parsed grid/openclose file is
  2022-23. Treat NBA full-game as 4 seasons, not deep.
- **Blocker for the feature:** needs a Supabase warehouse table + RPC (like the MLB migration) before it
  can power Systems. Until then NBA cannot be exposed.

### NCAAB — parquet only, **NOT yet warehoused**
- **Full-game h2h / spread / total = 2022-23 → 2025-26** (4 seasons). Verified: `openclose_ncaab_2022-23`
  earliest = 2022-11-07.
- **1H + team totals = 2023-24 → 2025-26** (3 seasons; `h1tt_ncaab_*`).
- **Player props: none acquired** (cost-prohibitive at backfill time).
- Same warehouse-table + RPC blocker as NBA.

---

## What this means for the Systems feature

1. **Two sports are launch-ready in the warehouse today: NFL, CFB, MLB.** NBA & NCAAB need a warehousing
   step (parquet → Supabase table + RPC) before they can appear.
2. **Full-game markets are the strong suit** (NFL 2018+, CFB 2016+). Everything else — all 1H, all team
   totals, all props, all of MLB, all of NBA/NCAAB — is **2022-23/2023+ shallow**. A "system" built on a
   shallow market has far fewer historical games; sample-size warnings matter more there.
3. This is why the coverage must be **shown per market, not per app.** A user building a CFB full-game
   spread system is backtesting 10 years; the same user on a CFB 1H total is backtesting 3.

## User-facing coverage display (requirement)

The user explicitly wants players to know what history backs each trend. Plan:
- **Per-market "Data since YYYY" label** on the builder and on every saved system card (driven by the
  market's floor season in this doc, surfaced via the RPC `coverage {season_min, season_max, n_games}`).
- Keep/extend the existing **"Limited history (2023+)" badge** for LIMITED-tier markets.
- On a system's result, show the **actual span used** ("Backtested 2018–2025 · 1,240 games"), not just a
  win rate — the span is part of the credibility of the number.
- Sample-size guardrail: below a threshold (e.g. <30 games) show a "thin sample" caution, as the current
  Analytics page already does.

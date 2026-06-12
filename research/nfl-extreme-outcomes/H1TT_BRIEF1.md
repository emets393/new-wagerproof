# H1TT BRIEF #1 — 1st-Half + Team-Total Edge Mining (2023-2025)

**Data:** `nfl_historical_odds` 1H/TT backfill (same snapshots as FG lines, ~9-12 books),
855 games with quarter scores. Frame: `h1tt_frame.py` → `data/h1tt_frame.parquet`
(open = first achievable snapshot per market, close = last; consensus = median line +
median **payout** across books). Grading: close bets vs consensus close, trigger bets vs
the line+price at the trigger snapshot. Per-season always. Team totals are FULL-GAME,
graded vs final scores; 1H bets graded vs h1 scores (no OT issue).

Scripts: `h1tt_p1_baseline.py` (baselines, ratios, FG-implied residuals),
`h1tt_p2_movement.py` (staleness/steam), `h1tt_p3_books.py` (book lead/lag, line-shop),
`h1tt_p4_teamtotals.py` (TT batteries), `h1tt_p5_confluence.py` (P11 confluence, situational).

---

## KEEPERS (bet-flag candidates)

### K1. TT-sum residual top quintile → game OVER  `tt_sum_q5_over`
`(tt_home_close + tt_away_close) − posted game total`, ranked **within season**, top 20%
→ bet FG OVER at close.
- 2023 +7.3% | 2024 +19.1% | 2025 +7.2% — **58.4% / +11.2% pooled (n=171, ~3.3/wk)**
- Under mirror (q1 → UNDER) is DEAD (−7.8%) — same over-only asymmetry as P11.
- Structural cousin of LOCKED P11 (ATD-implied total): when a derivative market sums
  above the posted total, the over wins. **Confluence check: nearly independent of P11**
  (20/168 overlap in 2024-25). P11-only +25.5%, TT-sum-only +10.8%,
  either +16.9% (61.4%, n=188). TT-sum q5 = volume extension of the P11 family.
- Use within-slate/season rank, never a fixed point threshold (resid distribution drifts).

### K2. Big favorite anywhere → HOME team-total OVER  `bigfav_home_tt_over`
|FG close spread| ≥ 7 → bet **home** TT OVER at close.
- 2023 +15.5% | 2024 +15.8% | 2025 +12.5% — **60.4% / +14.4% pooled (n=219, ~4/wk)**
- It is specifically the HOME total: dog-TT-over (+7.3% pooled, 2024 negative) and
  fav-TT-over (+5.2%, 2025 negative) framings both fail. Home big fav subset +8.4%,
  **away big fav subset: home TT over 67.7% / +29.8% (n=62)** — books appear to shade
  the home total down hardest when the road team is heavily favored.
- Independent of K1 (overlap n=38; works at +14.0% outside it).

### K3. Follow 1H spread steam in non-blowout spreads  `h1_steam_follow_small`
1H spread moved ≥ 1.0 within its open→close window AND |FG close spread| < 7
→ bet the steam direction on the 1H spread at close.
- 2023 +8.0% | 2024 +4.5% | 2025 +15.7% — **57.6% / +10.3% pooled (n=224, ~4/wk)**
- Big-spread games are the poison (2023 −39.7%); unfiltered steam-follow is only +5.5%.
- Fading 1H steam loses every season (−14.4% pooled). 1H **total** steam: dead both ways.
- Price-shopping the same consensus line at close adds ~2pp: **+12.8% pooled**.

### K4. Offshore-led stale chase on 1H spreads  `offshore_stale_h1sp`
BetUS or BetOnline moves its 1H spread ≥ 1.0 (first such move of the game); at the SAME
snapshot a US book (DK/FD/MGM/Caesars/BetRivers) still posts the old line → bet the move
direction at the stale US book's line+price (graded at that line+price, not close).
- 2023 +4.0% | 2024 +21.2% | 2025 +17.7% — **60.4% / +13.2% pooled (n=139, ~2.5/wk)**
- Leader identity is the whole edge: same chase with DK leading = −2.6%, Bovada −2.7%.
  BetUS alone +13.2%, BetOnline alone +11.4%; ≥1.5-pt moves: 63.6%/+19.2% (n=23).
- 1H **total** version dead for every leader. Live requires polling offshore boards
  (our 2h snapshot cadence found these; finer cadence likely catches more).

## TRACKING ONLY (not bettable yet)

- **Home TT over, all games**: +6.3/+2.3 in 2024/25 but −1.3 in 2023 — the broad lean
  behind K2; book shading of home totals may be growing.
- **SNF 1H under** (+8.1% pooled, but only 2025 was big) and **Thu/Fri 1H over**
  (+11.9% pooled, all from 2023's +52%) — classic regressed slot splits.
- **Windy (outdoor ≥12mph) 1H under** +3.4% — right sign, sub-vig.
- **"Either K1 or P11" over portfolio**: 61.4%/+16.9% (2024-25, n=188) — candidate
  consolidated totals-confluence flag once P11 has another season.

## DEAD ENDS (don't re-litigate)

1. **FG-implied 1H residuals** (OLS spread+total → implied 1H, vs posted 1H): no
   monotonicity, signs flip across all 6 fit/test combos. 1H lines are priced off FG.
2. **h1/fg ratio extremes** (total and spread): noise; the one positive bucket was a
   tie-artifact (n=50).
3. **Stale 1H vs FG consensus move at trigger** (FG moved ≥1/1.5, 1H unmoved): −4.5%
   spread, −8.3% total. Consensus 1H reprices fast enough.
4. **1H total steam** follow AND fade; **TT steam** follow AND fade — juice eats both.
5. **TT lag behind FG total move** → bet TT in FG direction: flips by season/side.
6. **Stale-book chase when DK or Bovada leads** (they lead most moves — 27%/20% of
   first-to-level — but their moves carry no chase value; only offshore moves do).
7. **TT-implied margin vs spread** (tt_home − tt_away + spread residual): priced.
8. **1H spread home/dog splits** (home FG dog → bet away 1H): +11/+7 in 2023/24,
   flipped to −13.5% in 2025.
9. **TT-sum q1 → game UNDER** (the K1 mirror): −7.8% — over-only asymmetry, same as P11.

## Caveats

- 1H/TT markets are thin: fewer books (~9-12 carry them), lower limits, ~−115 typical
  juice both sides. Pooled n per keeper is 139-224 over three seasons — these are
  spot-sized flags, not models.
- K4 is graded at the laggard's posted line+price at a 2h-cadence snapshot — achievable
  but assumes the stale number is still up when you click. Treat live perf as the test.
- Pooled "open" for 1H/TT is the market's own first posting (mid-week), not FG open.
- 2023 odds coverage is sparser early-week (fewer snapshots); window-based signals
  (K3/K4) are most trustworthy 2024-25.

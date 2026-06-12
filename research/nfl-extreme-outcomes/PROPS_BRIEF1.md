# Props Brief #1 — NFL Player Prop Deep Dive (2024–2025)

**Data**: 915K prop-snapshot rows → 131,898 (game, player, market, book) frame rows.
4 books (DK, FD, MGM, Caesars), 6 markets, ~10 snapshots/game (daily + every 2h gameday + close).
**Grading**: every signal graded at the line/juice available AT signal time (close signals → close line, the book actually bet). Per-season splits mandatory; nothing below is pooled-only.
**Scripts**: `props_p1_frame.py` (frame) → `props_p2_player.py` / `props_p3_context.py` / `props_p4_books.py` / `props_p5_movement.py`.

---

## 1. Market calibration (the lay of the land)

- **Yardage lines sit BELOW the mean outcome but ABOVE the median** (rec yds mean err +4.5, rush yds +3.1): right-skewed distributions. Overs hit 47–50% — the blow-up games pay the mean, not the bettor.
- **Receptions is the most under-leaning market** (46.7–47.8% over both seasons).
- **No book is sharper than the others at close** (mean closeness-rank all ≈2.45–2.50 of 4). The consensus IS the model.
- **When one book's line stands apart from the other three, the OUTLIER is wrong**: outlier closer to actual only 42.5–47.3% of the time, every book.
- **ATD Yes prices are overpriced in every bucket from 15%–70% implied** (gap −2 to −10 pts). Blind-yes all props: −2.2%. Only sub-15% longshots are fairly priced.

## 2. ACTIVE CANDIDATE FLAGS (validated both seasons)

| # | Flag | Rule | 2024 | 2025 |
|---|------|------|------|------|
| P1 | **QB pass yds — trust the line vs form** | gp≥4; line >+5% above L5 avg → OVER | 60.0% / +12.6% (n=578) | 56.4% / +6.1% (n=541) |
| P2 | (mirror) line 5–20% BELOW L5 avg → UNDER | | 40.7% over / +11.6% (n=477) | 42.5% over / +7.9% (n=506) |
| P3 | **QB pass TDs line ≥40% above form** → OVER | gp≥4 | 55.6% / +21.1% (n=354) | 52.1% / +15.0% (n=242) |
| P4 | **No-history QB unders** (gp_prior=0: Wk1 + returns) | pass TDs UNDER / pass yds UNDER | +36.5% / +26.9% (n≈148 ea) | +17.4% / +11.5% (n≈144 ea) |
| P5 | **ATD drift-down → YES at close** | yes-prob fell ≥5pts open→close | +6.1% (n=1,560) | +5.0% (n=1,642) |
| P6 | **ATD steam-up = NEVER BET** | yes-prob rose ≥5pts → avoid/fade | −28.2% (n=763) | −19.3% (n=477) |
| P7 | **Rush yds vs very tough run D** (allowed <0.8× lg, wk≥5) → UNDER | | 40.2% over / +10.3% (n=971) | 44.1% over / +4.6% (n=1,001) |
| P8 | **Rush yds line shopping** — spread ≥3 across books → UNDER at highest line | | 55.7% / +4.5% (n=289) | 56.7% / +6.1% (n=416) |
| P9 | **QB pass-TD cold streak → OVER** | under the TD line 2 straight prop-weeks → OVER next | 55.0% / +11.2% (n=100) | 56.3% / +13.7% (n=103) |
| P10 | **Receptions line raised 2 straight weeks → UNDER** | consensus line up 2 consecutive prop-weeks | 68.4% / +19.5% (n=59) | 64.7% / +12.8% (n=70) |
| P11 | **Prop-implied total above posted total → game OVER** | sum of ATD yes-probs (both teams) implies total in top quintile vs posted total | 58.5% / +11.3% (n=53) | 60.8% / +16.0% (n=51) |

**The P1–P3 story**: when a book moves a QB line away from recent form it has a reason (game environment, matchup) — and it systematically doesn't move FAR ENOUGH. Bet WITH the line's deviation from form. Corroborated independently by movement: pass-yds lines that steamed up 7–15% intraweek went over 59.4%/64.9% (small n≈35/season).

**The P5–P6 story**: TD-scorer money is the most public money in the building. Late steam on a TD prop is pure overpricing (implied 0.34 vs actual 0.26); a TD prop the market gave up on is the only +EV ATD entry.

**The P9 story**: pass-TD lines are sticky (almost always 1.5) and TDs are high-variance — a QB missing 2–3 straight gets no line relief but the over drifts to plus money (med payout ≈ +100/+111). Pure regression-to-mean the line can't express. The 3-straight subset is stronger (57.5%/+16.9% n=40; 65.0%/+34.9% n=40). Pass-YDS version does NOT replicate (−14%/+8.6%) — TD-specific.

**The P10 story**: receptions lines move in 0.5 steps on ~4.5 medians, so two consecutive raises = a cumulative ~0.8-unit (~20%) jump — the market chasing target volume. It overshoots: overs hit only 30.5%/34.3%. Threshold-insensitive (any 2-week raise qualifies); WR consistent both seasons (+13.4%/+17.3%), TE positive but weaker in 2025.

## 3. TRACKING ONLY (real but thin or juice-eaten)

- **Receptions one-book-high outlier fade**: under at the outlier book wins 61.7%/64.7% — but avg juice −166/−174 → ROI −1.3%/+2.5%. The book knows its line is high and prices it. Use as a *confirmation* layer, not standalone. (Betting the consensus book instead: unstable, −5.7%/+3.1%.)
- **Receptions gameday line-spike → under**: line up >7% on gameday → over only 37.0%/38.2%, but under ROI just +2.8%/+1.4% after juice.
- **Questionable-and-played mild under lean** (esp. receptions/rush): direction consistent, ROI ≈ flat. Note: Questionable players play 80%; Doubtful/Out ≈ 0%.

## 4. DEAD ENDS (tested, discarded — don't re-litigate)

- **Defense matchup index is priced** (over% flat across buckets except P7). The seductive combos (soft D + line below form, tough D + line above form) flip sign between seasons.
- **Teammates-out beneficiary overs**: books price replacement volume well; no bucket profits either season.
- **"Anomaly" lines** (above season max / ≥1.5× avg / ≤0.6× avg): all ≈ both-sides-lose; books set shock lines correctly. The user-intuition case "line far above anything shown" = line ABOVE season max → over only 43.6%/44.6%, but under ROI just −4.0%/−0.6% — juice eats it.
- **Receptions/rec-yds/rush-yds form-deviation** versions of P1/P2: unstable. The form-deviation edge is QB-ONLY.
- **Open→close movement follow/fade at close** (yardage markets): priced. Same for juice-steam with flat line.
- **Line shopping the LOW line for overs**: negative everywhere (low-line books juice the over).

## 4b. Book-vs-book dynamics (`props_p6_leadlag.py`)

- **DraftKings is the price originator**: first book off its opener on 59.6% of props where ≥2 books moved, and when DK leads the other books' eventual move matches DK's direction **93.8%** of the time. Caesars also reliable when it leads (92.3%) but leads only 3.3%. MGM leads 27.7% / followed 75.9%; FD leads 9.4%. → DK movement = market direction; use as the trigger feed for movement-based flags (P5/P6 ATD steam especially).
- **Stale-book chase is DEAD**: when 3-book consensus moves ≥thr and one book hasn't repriced, betting the move direction at the stale book loses ~−5 to −9% pooled. Mechanism: books defend stale lines with juice — avg odds at trigger were −80 to −95 on the chase side. Scattered 2025 positives (rush-yds down-chase +12.1%, Caesars +11.2%) have negative 2024 mirrors → sign-flip noise. The 4 US majors are too synchronized (2h snapshots): laggards reprice juice within one snapshot even when the line is stale.
- **Books moving opposite directions on the same prop**: only 1.7% of multi-book props — too rare to trade.

## 4c. Regression, trap lines & schedule-inflated form (`props_p7_regression.py`)

Weekly consensus panel: one row per (season, week, player, market) = median close line + median payout across books; lags over the player's prop appearances. 17,522 panel rows with a prior prop week.

**KEEPERS** (promoted to flags table): P9 QB pass-TD cold-streak over, P10 receptions raised-2-weeks under.

**Tracking-only (direction consistent, thin or weak)**:
- **Rush-yds trap-down → OVER**: beat the line 2+ straight but line dropped ≥5% → over +1.3%/+10.7% (n=54/72). The only trap-line cell that pays — and it pays by *fading* the trap (trust the player, not the dropped line).
- **Receptions trap-up → UNDER**: lost to the line 2+ straight yet line raised ≥5% → under +4.0%/+12.1% (n=45/45). Same direction as P10 — rising receptions lines are over-eager regardless of streak context.
- **Rush-yds raised 2 straight weeks → under**: +7.7%/+1.7% (n=194/194) — real lean, juice-thin.
- **Pass-TDs hot + soft slate → over**: +15.1%/+5.3% (n=38/44) — consistent but tiny.

**DEAD ENDS (all priced — don't re-litigate)**:
- **Streak regression generally**: over/under the consensus line 2–3 straight weeks → next game ≈ coin flip in every yardage/receptions market, both sides −ROI. Books don't naively chase results.
- **1-week line momentum**: every bucket (dropped big → raised big) loses both sides both seasons. "Raised big → under" flips sign (−7.2% then +1.6%).
- **Trap lines as a class**: TRAP DOWN / TRAP UP pooled ≈ −3 to −9% both sides; CONFIRM UP/DOWN the same. The dramatic "line suddenly much lower after 3 good games" spot exists (~250/season) but the dropped line is *right* on average.
- **Schedule-inflated form is fully priced** — the user-intuition RB case: hot RB whose tear came vs soft run defenses → unders lose −5.0%/−9.6% (n=152/219); same vs tough current opponent −5.7%/−6.1%. Cold-vs-tough "due for breakout" overs ≈ flat. Books already strength-of-schedule-adjust form. Consistent with the §4 defense-matchup dead end.
- **ATD streaks/droughts**: scored-3-straight YES −5.1%/−15.4% (implied 0.52 vs actual 0.48/0.38); drought-3 YES −12 to −23%; drought + price rising −18%/−30% (reinforces P6: ATD steam = never bet). TD streak money is the most over-taxed bet in the dataset.

## 4d. Props → game lines (`props_p8_gamelines.py`)

Question: do aggregated player-prop closes predict the game total or spread beyond the posted line? Cross-season OLS (fit 2024 → grade 2025 out-of-sample, and reverse), graded vs nflverse close total/spread with close juice. 514 games joined.

**Facts established:**
- Prop lines and game lines are the same opinion: team prop aggregates reconstruct the posted total at R² 0.84–0.88; home−away ATD-prob diff correlates 0.87–0.91 with the spread. A prop-built total predicts the actual total exactly as well as the posted line (MAE ~10.2 vs ~10.0).
- **The residual is a real totals signal — over side only (P11).** When the prop-implied total sits in the top quintile above the posted total, the game goes OVER. Simplest version is strongest: **ATD probs alone** (sum of every player's median yes-prob, both teams → expected total via prior-season fit): top quintile = 60.8% / +16.0% (2025 test) and 58.5% / +11.3% (2024 test), ~51–53 games/season ≈ 3/week. Full 5-feature version: 58.8%/+12.3% and 56.6%/+7.9% — same story.
- Not a totals-level artifact (over% not monotonic in posted total; flagged games are mid-range 42–45 totals) and stable across half-season splits (53–65% everywhere).
- Mechanism: ATD probs encode TD-vs-FG scoring composition. When books price more TD scorers than the total implies, the total is too low — the two markets aren't reconciled.
- **Under mirror DEAD** (bottom-quintile under +4.1% then −9.7% — flip). **Spreads DEAD**: prop-implied margin residual flips sign across seasons in every bucket and threshold. Props don't out-predict the spread.
- Deployment: fixed-point thresholds unstable (fit intercept drifts season to season) — use within-slate rank (top ~20% of the week's residuals) or recalibrate the ATD→total mapping each season. Natural confluence input for the LOCKED consensus-totals model.

## 5. Mechanics worth remembering

- Books reprice props mostly via JUICE, not line moves (median line range across the week = 1 unit; receptions/pass-TD lines almost never move).
- Cross-book spreads: pass yds ~4 yds typical, rec/rush yds ~2, receptions 0–0.5.
- Week-1 prop volume is the lowest-information spot of the year for books → P4.
- 12.6% of rows ungraded = DNP voids (mirrors book voiding); Questionable ≠ avoid (80% play rate).

## 6. Next steps for 2026 season

1. Wire P1–P8 into a `props_harness.py` analogous to `forecast_harness.py` (close-line triggers, per-flag ledger).
2. P5/P6 need intraweek snapshots live → reuse `props_backfill.py` cadence on live endpoints (~2,800 credits/mo).
3. Watch for P4 (Week 1 QB unders) immediately in Sept 2026 — highest-ROI, earliest-available flag.
4. Possible interaction to test with more data: P1 × P5 overlap (QB over + his own ATD drift).

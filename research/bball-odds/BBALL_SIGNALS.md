# BBALL_SIGNALS — the locked NBA/NCAAB signal vault

Consolidated from the 2026-07 research program (briefs in this directory).
Every record below: graded at the **T-60 consensus** line and **decimal-median**
price per the closing-line policy; per-season records in the source briefs.
Breakeven at -110 = 52.4%. Do not redefine a signal without re-validating.

## Definitions used everywhere

- **Regular**: ≥5 prior appearances, prior minutes/game ≥22 (CBB) / ≥24 (NBA),
  appeared in ≥60% of team games to date. Roles from strictly-prior stats.
- **Fresh absence**: player was in the team's PREVIOUS game box, missing from
  this one. (`build_player_flags.py`)
- **big** = team's top prior-rebounds regular; **guard** = top prior-assists.
- **Style percentiles**: strictly-prior expanding profile, ranked within
  sport-season (`build_style_features.py` / `style_nba.parquet`). hi ≥0.70,
  lo ≤0.30 unless stated.
- **STAR big (NBA)** = same player is top-minutes AND top-rebounds regular.

## S1 — CBB big-out ATS fade (VALIDATED, flagship)

Fade (bet against) the NCAAB team whose big is freshly out. n=751 base,
positive all 4 seasons at every tier. Conviction ladder (units MAMMOTH-style):

| Tier | Condition | Record |
|---|---|---|
| Base | big freshly out | 57.8% / +10.4% (n=751) |
| +Paint | attacker paint-share ≥70th pct | 62.3% / +19.1% (n=247) |
| +Thin bench | own KenPom bench ≤30th pct | 61.8% / +17.8% (n=136) |
| +Tall center lost | own Hgt5 ≥70th pct | 59.2% / +13.0% (n=223) |
| **MAX** | paint attacker AND thin bench | **75.0% / +43.2% (n=88)** |

Boosters: ≥2 regulars freshly out 67.2%/+28.2% (n=64); conference play (Jan+)
59.5% vs nonconf 54.2%; mid/low conference 58.1% vs power 55.6% (positive in
both). Attacker TT OVER side: 55.5%/+4.4% (paint-or-FT attacker 56.2%/+5.4%).
NOT a tier: attacker OREB, rest days. **FRESH-ONLY: stale (2nd+ game)
absences 51.4%, returns priced — the edge is a ONE-GAME news lag**
(CBB_SIDES_BRIEF4.md).
**NEW TIER — model agreement (NCAAB_SIDES_MODEL_BRIEF.md): the 142-feature
sides GBM agreeing (edge ≥1 same direction) lifts the base to ≈61.7%/+18%
(big_out-away+agree → HOME 64.0%/+22.3% n=100; big_out-home+agree → AWAY
59.6%/+14.0% n=109; all test seasons positive).**
**Production: needs pregame CBB injury/lineup feed (covers.com).**

## S2 — NBA star-big totals over (VALIDATED)

NBA books move the spread for a missing big but under-adjust the TOTAL.
Bet game OVER when a STAR big is freshly out. All tiers positive all 4 seasons.

| Tier | Condition | Record |
|---|---|---|
| Base (any big) | big freshly out | 54.8% / +4.7% (n=724) |
| STAR big | top-mins ∩ top-reb out | 57.7% / +10.1% (n=307) |
| +FT-drawing opp | attacker FTR ≥70th | 59.8% / +14.1% (n=184; star-only 67.1%/+28.1% n=79) |
| +Pace | own pace ≥70th | 56.9% / +8.6% (n=239) |

Mechanism check both sports: 3-heavy attackers (don't attack rim) ≈49-54%.
ATS versions in NBA = fully priced, do not bet.
**Production: official NBA injury report suffices (info public, still mispriced).**

## S3 — Style composite game over (VALIDATED-LEAN)

Both offenses style-advantaged (3-channel strength×weakness composite —
3P/paint/FT — each team top quintile) → game OVER: 54.3% / +3.6% (n=838).
Related: 3-heavy O vs elite 3PT D → that team's TT OVER 54.4%/+2.3% (n=1,124;
25-26 negative — the market over-shades the popular under story). 5-channel
composite is WEAKER; keep 3 channels. No feed needed — boxscore-derived.

## S4 — Portal rebuilt-roster back (TRACK-PLUS, era-emerging)

Back rebuilt (continuity ≤25th pct within season) AWAY teams in Nov-Dec,
strongest when rebuilt with EXPERIENCED transfers (Exp ≥60th): 57.8%/+10.3%
(n=258). Era trend: negative pre-portal-maturity, +7/+8% in 24-25/25-26.
Dead by January (market catches up). Bet small 2026-27, re-validate, expect
adaptation. (PORTAL_BRIEF1.md)

## S5 — Press-vulnerability fade (VALIDATED, archetype system)

Team faces a D_PRESS defense (top-30% TO-forcing + above-median pace,
prior-only labels) having underperformed its season offensive efficiency by
≥5 pts/100 across ≥3 prior same-season meetings with presses → FADE ATS:
**57.6% / +10.1% (n=604, all 4 seasons: 65/57/53/56).** Asymmetric: press-
proficiency carries nothing (51.8%) — only weakness persists. Mid-season
signal by construction (needs 3 prior press meetings). No injury feed needed
— fully computable from boxscores/plays. (ARCHETYPE_BRIEF1.md)

## Type-vs-type grid (2026-07-17, team_types.parquet, 83 cells n≥150)

**O3-TT-OVER family: methodical-3PT offenses (Houston/Purdue O-type) team
total OVERS are systematically under-priced** — vs pack-line D2: 54.5%/+2.5%
(n=1,258, 3/3, mirror under = worst cell -14.4%/0-3 = complement-confirmed);
vs D4 +1.2% (3/3); vs D0 +0.5% (3/3). Mechanism: pack-line concedes threes,
methodical bombers take them; market over-weights the "slow team low total"
story (kin to the extremity finding). ATS leans (sub-vig, 4/4 consistent):
O2 transition-rim vs D4 perimeter-permissive 51.9%; O2 vs D0 gambling-press
51.9%. Full grid in type_grid_results.csv.

## Extremity dials (2026-07-17) — types + within-type extremity, not more splits

**BOTH teams SUPER-slow (pace ≤8th pct, Houston-tier) → game OVER: 56.1% /
+7.1% (n=139, ALL FOUR seasons 58/60/55/53).** Mild-slow pairs (20-35th pct,
Purdue-tier): REVERSED (over 46.9%/-10.4%). Lumping them = the old washy
52.1%. The 6th narrative-overpricing instance: "slow teams = under" is
over-applied at the extremes — the more famous the narrative, the more
over-priced. Design law: keep discrete types for structure, use CONTINUOUS
percentile extremity as the conviction dial (dose-response testing), never
hard low/med/high splits (combinatorial sample death).

## Team-consistency tool (2026-07-17)

Per-team, per-archetype sign-consistency (share of ≥4 same-season prior
meetings below own baseline). Findings:
- **Magnitude (S5's mean ≤ −5) remains the bet trigger: 58.3%/+11.4% WITHOUT
  the consistency filter vs 54.5%/+4.0% with it** — consistency adds noise-
  sign meetings, not information.
- **ATS-record-based consistency REVERSES** (fade teams 0-4 ATS vs a profile
  → loses 44.7-49.2%): the market watches ATS records and re-prices them.
  Build splits on efficiency-vs-own-baseline (our private computation), never
  on ATS records (public).
- **The tool ships as the SCOUTING layer**: end-of-25-26 flags incl. Virginia
  11/11 below baseline vs paint-walls, UConn 7/8 vs presses, Colorado State
  7/7 vs presses — interpretable team cards for the app/agents; the S5
  magnitude trigger does the betting.

## Bench-quality round (bench_quality.parquet, 2026-07-17)

2x2 profiles (usage x efficiency, prior-only): DEEP_EFF 14% / DEEP_INEFF 12%
/ SHORT_EFF 12% / SHORT_INEFF 14% of team-games.
- Standalone bench-quality ATS: ALL ~50% — bench quality alone is priced.
- **S1 NEW TIER — big_out × bench-EFFICIENT → FADE 60.2%/+15.0% (n=251,
  64/63/61/53).** Counterintuitive and mechanism-consistent: the market
  treats an efficient bench as absence insurance ("they have depth, they'll
  absorb it") and under-moves the line — but garbage-time bench efficiency
  does not replace a big man. 5th instance of the narrative-overpricing
  meta-law. Inefficient-bench version: 56.8%/+8.4% (n=333).
- **CAUTION on the depth-narrative fade**: it weakened under our in-season
  minutes-share depth definition (KenPom bench-minutes definition carried
  the 4/4 result). Definition-sensitive → keep at TRACK, use the KenPom
  definition, revalidate 2026-27.

## Grid finds (GRID_BRIEF1.md — exhaustive archetype cross, 110 cells)

- **DEPTH-NARRATIVE FADE: deep-bench vs short-bench matchup → back the SHORT
  bench 53.4% (n=3,811, 4/4 seasons)** — market overprices depth. 4th
  over-priced narrative (press, shutdown, ranked-road, depth).
- O_THREE_GUN vs D_SOFT_FOUL → TT OVER 55.4%/+4.2% (n=502, 3/3; complement
  confirms). O_PAINT_BIG vs D_PAINT_WALL → TT UNDER lean (3/3).
- S5 robust in every roster slice (58.8-60.3%); × DEEP bench 59.9%/+14.5%
  (n=207, 4/4) — depth does not cure press vulnerability.

## Lineup-derived TEAM profiles (4th profile group, 2026-07-17)

From stint data, prior-only (build_lineup_profiles.py → lineup_profiles.parquet,
33.9k team-games): **star_dep** (top player on/off = ceiling dependence),
top2_share, **rotation_depth**, bench_dropoff. Two proven uses:
1. **TIER the absence fades**: big_out × STAR-DEPENDENT team (star_dep ≥70th)
   → 60.4%/+15.3% home, 60.0%/+14.7% away vs balanced control 54.7%/57.9%.
   Star-dependent rosters get punished harder for absences — mechanism the
   box couldn't see. (small n=53/60; directionally clean.)
2. **IMPROVE the models**: fg_margin MAE −0.091 (LARGEST single-group gain in
   the whole lab — possession/KP-recompute gave ~0), h1_margin −0.056,
   tt_away −0.039, fg_total −0.018. Wired into production_models.py permanently
   (margins + away TT + fg_total). Roster SHAPE moves margin models where team-
   average efficiency does not.

## S6 — Impact-weighted availability fade (player-impact layer, 2026-07-17)

On/off impact ratings from 629k lineup stints (player_impact_ncaab.parquet;
shrunk on-net minus off-net; lineup-id→name bridge in lineup_id_map.parquet).
**Fade the team missing a FRESH absentee, tiered by the absent player's
measured impact: ≥+8 → home-side fade 56.7%/+8.3% (n=418), away 53.6%/+2.4%
(pooled ≈55.2%/+5.4%, n=875); fringe absentees (<+3): ≈50-52.5% (control) —
the market under-adjusts PROPORTIONALLY to the missing player's on/off
value.** Role-agnostic upgrade/generalization of S1 (any position, any
role). Coverage: lineups in 73% of games, 2023-24 onward.
**v2 RIDGE-RAPM (player_rapm_ncaab.parquet, within-team ridge on stint
net-rating, seconds-weighted) is the production version — cleaner gradient
than raw on/off, BOTH sides positive all 3 seasons: home ≥+4 → 54.1%/+3.3%
(n=690), away ≥+4 → 54.0%/+3.1% (n=715); fringe absentees (<+1.5) correctly
null/negative (away -5.9% control). Raw on/off had a hotter but noisier home
cell (≥+8 → 56.7%/+8.3%) that leaked value onto collinear teammates.**
OPEN v3: raise ridge alpha (current coef max ~247 = under-shrunk tiny-minute
players; aggregate betting gradient robust to it); add cross-season prior.

## S7 — NBA shared 1H-total streak fade (VALIDATED-LEAN, 2026-07-29)

First real NBA-side edge in this program (NBA props/movement/FG/1H-univariate
all came back priced). NBA_HALVES_BRIEF2/3.md, nba_halves_study2/3.py.

**When BOTH teams are riding the SAME 3+ game 1H over/under streak, bet
against it in the 1H total: 61.9% / +18.1% (n=113, 57/60/67 per season, gate
min 20 games played).** Dose-response 2+ streak → 54.8%/+4.6% (n=458) → 3+ →
61.9%. Both signs fire: both-over-streak → 1H UNDER 64.3%/+22.7% (n=56);
both-under-streak → 1H OVER 59.6%/+13.7% (n=57). Symmetric + dose-response +
3/3 seasons is why this survives scan-honesty where a lone 62% cell wouldn't.

Robustness: flat -110 grading +18.3%; drop-any-season worst +11.5%; works
whether the streak agrees with or contradicts season 1H over% record.

**The conjunction IS the signal** — ONE team on a 3+ streak is nothing
(50.2%, -4.2%, n=640); OPPOSED streaks nothing (52.0%). Never bet the
single-team version.

**Mechanism (measured, not assumed):** the book lifts the 1H total only ~0.7
for shared over-streaks (114.9 vs 114.2 baseline) but CUTS it 2.8 for shared
under-streaks (111.4) — while actual 1H points barely move (113.9 / 113.4).
Realized over% swings 35.7% → 59.6% across cells whose lines differ by 3.5.
**1H-specific: the identical rule on the FULL-GAME total is dead (51.3%,
-2.0%)** — so this is derivative-market mispricing, not scoring regression
(which is fully priced per REGRESSION_BRIEF1). This is the owner's
overcorrection theory finally confirmed — in the thin market, not the main one.

Season 1H over% alone (as-of-date, both teams) is priced-to-overpriced and
ASYMMETRIC: both ≥55% → OVER 46.1%/-12.2% (UNDER +3.0%); both ≤45% → UNDER
+5.7%. The book only overcorrects UPWARD. Recency (streak) >> season record.

Gate note: **30+ games played makes things worse, not better** — see below.

## NBA 1H spread: both-team record cross (TRACK-PLUS, 2026-07-29)

The both-team cross works where the univariate version was priced (method law
again): hot team (season 1H cover% ≥58%) vs terrible team (≤42%) → BACK hot =
56.8%/+8.2% (n=146, 55/58/58); ≥60% vs ≤40% → 57.6%/+9.5% (n=92); cover%-gap
≥20pp → 55.4%/+5.5% (n=303, 3/3 seasons).

Quality control (the better-cover team is the favorite in 70% of these):
inside a spread bucket the gap still adds — |spread|≥9 gap≥20pp = 56.6% vs
47.3% for the gap≤5pp control; |spread| 6-9 = 64.1% but decaying (76/61/50).
Only lives on the FAVORITE side (56.8%, n=213) — dog side null (52.2%).

**Gate finding that contradicts the "wait 30 games" intuition: the cross PEAKS
in the 20-30 game window and decays after.** 58/42 tier 56.8% at 20+ → 53.8%
at 30+; 55/45 tier 52.8% → 51.2%; only the gap≥20pp version holds both (55.4%
/ 55.1%). The streak fade (S7) is gate-flat (61.9% / 60.2%). Use 20+ gp.

Streak-based spread cells (3+ covers vs 3+ fails) are thin and season-driven
(hot dog 57.6% n=66 is 43/80/44) — the BRIEF1 fade-cold-favorite at n=363
(54.0%, 56/56/50) is the more stable form. Do not stack them.

## S8 — NBA moderate-absence 1H spread back (VALIDATED, 2026-07-30)

Strongest NBA finding in the program. NBA_AVAIL_1H/2H/3/4_BRIEF.md,
nba_availability_1h/2h/3/4_study.py, absence detail from build_nba_absence.py.

**One moderate scorer (prior 18–25 ppg) FRESHLY out, opponent has nobody 18+
out, |FG spread| < 8, both teams 25+ games played → BACK the depleted team on
the 1H spread: 60.9% / +16.0% (n=271, 63/60/60 per season).**

Robustness: flat -110 grading +16.2%; drop-any-season worst 60.0%; favored
60.5% / dog 61.0%; home 58.2% / away 63.8%. No sub-split carries it.

**Dose ladder (back the depleted team, 1H, by total ppg removed):** 8-15 →
50.9%, 15-20 → 52.6%, **20-25 → 59.3%**, 25-32 → 52.0%, 32+ → 48.5%. An
inverted U, not a monotone — the market OVER-adjusts a rotation scorer and
UNDER-adjusts a real star. Excluding 32+ is not a fitted gate, it is unstable
(per-season 70/40/39) and small.

**PLACEBO PASSES — this is the test that makes it real.** STALE absences of
the same size (already out for multiple games) in the same close games run
51.2% / -2.4% (n=389, 49/48/56). Only FRESH news is mispriced.

**Sign flips on the FULL GAME at the top of the ladder:** 25-32 ppg removed,
other side clean → **FADE the depleted team on the FG spread = 57.2% (n=173,
57/58/56)**, 61.0% inside close games; the 1H version of that cell is dead
(52.0%). TRACK-PLUS, not vaulted — the ladder breaks above it (32+ fades at
only 52.6%) and n is thinner.

**Mechanism (measured):** the 1H line is a mechanical 0.573× of the FG line and
carries **+0.009** extra for a star out — nothing beyond proportional
pass-through. Actual 1H margin shifts -1.518 for a moderate absence vs +0.483
for a severe one; actual FG margin -1.018 vs +1.697. Absence damage is
BACK-LOADED and a proportional 1H line cannot express that.

**Clean negative control — FULL-GAME TEAM TOTALS price absences exactly:**
≥18ppg star out → own team total under 48.9% / over 51.1% (n=689) against a
nobody-out control of 49.5%/50.4%; 40+ ppg removed → own under 51.8%. The book
gets "how many points does this team score" right and "how those points split
across halves" wrong. Same shape as S7 — the NBA edge is in the DERIVATIVE.

Do not read the 2H numbers in those briefs as bets: real 2H lines open at
halftime off the actual 1H score, the synthetic 2H column is diagnostic only.

Needs a live pregame inactives feed to fire (same blocker as S1/S6).

## S9 — NBA dead-home-team favourite (VALIDATED, 2026-07-30)

**First real edge on the NBA FULL-GAME SPREAD**, and the only signal in this
vault that fires with no injury feed. NBA_DEAD_HOME_BRIEF.md +
NBA_DEAD_HOME_ROBUST_BRIEF.md; `nba_standings_features.py`, `nba_dead_home.py`,
`nba_dead_home_robust.py`.

**Late season (both teams 50+ games played), the HOME team is ELIMINATED or
TANKING → BACK THE FAVOURITE. 62.3% / +19.03% (n=324, 60/58/68/63 per season,
79–85 bets every season).**

**The comparator is 53.05%, not 50%.** Favourites already cover 53.05% across
all 1,817 late-season games, so this is +9.3 points over the right baseline.
Quoting it against a coin overstates it by three points. `delta cell` (blind
favourite reweighted to the selection's own |open spread| bucket mix) = +17.34.
Bootstrap p5 over 10k resamples = 58.0% — the 5th percentile clears breakeven.

Definitions, all from schedule + final scores STRICTLY BEFORE tip
(`nba_standings_feats.parquet`, keyed on `game.id`):
- **eliminated** — further behind the 10/11 play-in boundary than there are
  games left, and under 25 games remaining
- **tank** — 12th or worse in its conference with under 20 games left
- `playin_edge` is signed games clear of the 11 seed; `gb()` returns games BACK
  so it is negated. Getting that sign wrong makes clinched 0% and eliminated
  43% — that is the tripwire if these are ever rebuilt.

**Mechanism (predicted before the split was run, then confirmed):** the spread
carries a standing ~2–3 pt home-court adjustment premised on home teams trying
harder. A home team that has quit is the one case where that premise is false,
and the book cannot quietly drop the adjustment without declaring the team has
quit. A road team that has quit never had the premium. So the effect must be
one-sided — and it is.

**Controls, all passed:**
| check | result |
|---|---|
| venue placebo — AWAY team dead | 53.7%, delta cell **-0.48** (nothing) |
| quality placebo — bad home team, NOT dead | 50.8% |
| season placebo — bottom-4 home team mid-season | 47.1%, delta **-10.99** |
| clinched home team (idle, not quit) | 49.2% — only QUITTING counts |
| concentration — 18 distinct dead home teams | top team 19% of profit; drop the best team entirely → **61.0% on 310** |
| fatigue | rested 62.6% vs back-to-back 61.1%; home-more-rested 62.0% |
| both teams dead | 62.8% (n=78) — does not need a motivated opponent |

**Line timing — survives to the close, so it is feed-bettable:** open 62.3% /
+19.03, T-24 63.4%, T-4 59.0%, **T-60 (house closing-line policy) 58.7% /
+12.06** against a 52.8% all-late favourite comparator at the same snapshot.
Bet the open when available; the close still pays. Not a stale-opener proxy:
in the 140 games where the line moved under 1 pt it is 58.6% / +11.80.

**Dose:** under 10 games left 63.8%, 15+ games left 55.0%. April 65.1%, March
60.9%. 8+ games out of the play-in 62.8%.

Graded against the OPENING spread because that is the line the signal uses
(house grading rule), with T-60 reported alongside.

## How S9 was found — the phase discipline that produced it

Worth preserving, because three consecutive steps each predicted the OPPOSITE
of what came back and the finding is on the far side of all three:

1. `nba_spread_phase.py` — the FG spread model is **anti-informative** late:
   -16.1 vs naive at the top 10% of its own edge, monotone. Averaged over all
   nine method families, so not cell-picking.
2. `nba_late_diagnose.py` — the loss is NOT in games nobody cares about. There
   the model is fine (54.5%). It is concentrated where the standings still mean
   something (44.3%, -16.6 vs naive). Mean |edge| is 1.80 pts in both groups —
   the model cannot tell the situations apart. Feature audit: **zero** columns
   matching rank/seed/stand/elim/clinch/trade in all 977.
3. `nba_motivation_control.py` — a standings SIDE-PICKING rule looked strong
   (56.1%) until compared to blind favourite INSIDE its own games, where it
   added **+0.0**. Dead as a side-picker. But the subset it selected showed
   favourites covering 62.2% instead of 53.05%.

The signal was never the side. It was **which games to back the favourite in**.
`fav in-subset` — the comparator computed on the identical games a rule fires
on — is what separated the two, and any favourite-heavy rule (fav share >85%)
must carry it or the cell-matched number will flatter it.

## S10 — NBA concentrated player-heat fade (VALIDATED-LEAN, 2026-07-30)

**Second edge on the NBA FULL-GAME SPREAD, and the first one built from
play-by-play.** Verdict doc `NBA_PLAYER_REGRESSION_SUMMARY.md` — where the
stage briefs disagree with it, they are wrong. `nba_player_regression.py`,
`nba_player_model.py`, `nba_conc_controls.py`, `nba_conc_walkforward.py`.

**A team whose recent shooting above each player's OWN career finishing rate is
CONCENTRATED in one or two high-volume players → FADE that team on the spread.**

Walk-forward, thresholds picked only from strictly prior seasons and applied
blind (`nba_conc_walkforward.py` — 2022 is the training seed and is never bet):

| grading | bets | win % | slice base % | edge | ROI % | seasons |
|---|---|---|---|---|---|---|
| vs OPENER | 433 | 55.4 | 52.2 | +3.2 | **+5.8** | +6.8 / +0.4 / +10.2 |
| vs **T-60 close** | 446 | 54.0 | 50.4 | +3.6 | **+3.2** | +3.1 / −0.5 / +7.4 |

**It clears the close**, which is what separates it from S6 and the absence work
— that was a news-latency/CLV artifact, this is not. Thin, and labelled LEAN for
it: 1 SE ≈ 2.4pp, 2024 is a wash at −0.5%, ~150 bets/season. **Do not quote the
in-sample +5.5%** — the HHI sweep is non-monotone (p50 +2.8, p60 +1.8, p70 +6.2,
p80 +3.2), which is the fingerprint of a cut chosen after seeing the answer and
is exactly why the walk-forward number above is the one that ships.

What is measured, all leak-safe (expanding, shifted):
- `own_finish` — the player's **own** long-run points-above-shot-location-
  expectation per shot. This is SKILL. Good finishers beat a location model every
  year; grading them against a league-average expectation labels them permanently
  lucky and destroys the signal.
- `heat` = trailing-10 finishing − `own_finish`, aggregated over the projected
  rotation weighted by **shot volume, not minutes** — a hot player only regresses
  to the extent he keeps shooting.
- `conc_drv` — HHI of that heat on the side carrying it. A **moderator, not a
  signal**: diffuse heat does not regress at all (+1.45).

**The two load-bearing controls:**
| check | result |
|---|---|
| C3 — team aggregate `d_luck_net` in the SAME cell | −1.7% ROI, p=.77 — **fails** |
| C4 — raw hottest player, NO own-baseline subtraction | **−7.9% ROI — fails** |
| nested — player heat with team aggregate projected out | survives, −1.74 / −2.07 |
| nested mirror — aggregate with player heat projected out | **+0.19 / +1.13, wrong sign** |
| C5 — is concentration a disguised favourite/talent rule? | no: corr −0.9 spread, +0.0 talent |

C4 is the one to remember: **fading the guy who is merely scoring a lot LOSES
money.** Subtracting his own sustainable finishing rate is the entire signal.
And the mirror nested test says team averaging was not merely diluting the
information, it was destroying it — which is what the play-by-play pull was for.

Live needs a daily hoopR PBP pull (`nba-granular-data-source`), the expected-points
table rebuilt expanding, and the prior game's rotation. **No injury feed.**

## Portfolio — S9 ∪ S10 on the NBA full-game spread (2026-07-30)

`nba_combine.py` → NBA_COMBINE_BRIEF.md. **Overlap was measured before any
combined number was computed**, because two rules on the same market in the same
part of the season can pick OPPOSITE sides.

They are **almost perfectly complementary**: S9 × S10 co-fire on only 23 of 895
games (7.0% of the smaller signal), 12 agreeing and 11 conflicting. Conflicts are
not bet — a game where the two disagree has no defensible side.

| | bets | OPEN win/ROI | T-60 win/ROI | base | T-60 by season |
|---|---|---|---|---|---|
| S9 alone | 326 | 61.9 / +18.2 | 58.3 / +11.3 | 53.4 | 59/52/66/57 |
| S10 alone | 569 | 54.3 / +3.7 | 54.1 / +3.3 | 50.8 | 53/53/53/58 |
| **union** | **862** | **56.8 / +8.4** | **55.3 / +5.6** | 51.3 | 55/52/57/57 |

**~215 bets a season at +5.6% instead of S9's ~80 at +11.3%, positive all four
seasons.** The union is the product; it is nearly free because the overlap is
tiny. The agree cell (n=12) and both conflict cells (n=11) are too small to
grade and the script refuses to print them rather than dressing them up.

**Do NOT bet the xEFG-gated version of S9.** "S9 + shot-quality process agrees"
shows 213 bets at 61.0% / +16.5% (T-60) and is the most attractive-looking cell
in the program. It does not survive its controls (`nba_combine_controls.py` →
NBA_COMBINE_CONTROLS_BRIEF.md):
- the honest comparator is blind favourite **bucket-matched over all late games**,
  not `fav in-sub` — for a rule that bets the favourite, `fav in-sub` equals the
  win rate by construction and is worthless
- the gate alone (back the favourite whenever xEFG agrees, all 1,290 late games)
  is +3.2 delta — ordinary, and nowhere near 61%, so the dead-home condition IS
  load-bearing and the finding is not secretly an xEFG rule
- **but D and E are a PARTITION of the same 326 S9 bets**, so D's lift over S9 is
  arithmetically forced once E comes in weak — it is not an independent test. The
  permutation test (does the xEFG cut split S9 better than a RANDOM cut of the
  same sizes?) gives **p ≈ .10** at both the open and the close.

Taking it would surrender a third of a validated signal's volume to chase a
refinement that has not cleared. Track it; bet plain S9.

## Tracking list (positive, not yet bettable — revisit with 2026-27 data)

- CBB guard_out × NON-pressing opponent → back attacker 54-55%/+5.3% (press
  narrative is OVER-priced; the pressing version is only 51-53%)
- CBB guard_out from TO-prone team ("fragile handle") → back attacker 55.4%/+5.9%
- CBB top1_out → game UNDER 54.6%/+4.2%
- CBB 3-heavy HOME dogs cover only 46.5% (n=846) → fade lens
- NCAAB book 1H total ≥1.5 ABOVE consensus → UNDER at that book +5.4% (n=281)
- NBA H2H ATS anti-persistence: back home team dominated in prior meetings
  55.5%/+5.9% (n=660); H2H totals tendencies persist (ran over ≥8 → over +1.4%)
- NBA small-dog ML steamed ≥2pp pockets (n<100 each)
- **NBA xEFG gate on S9** (back the dead-home favourite only when shot-quality
  process agrees): 61.0%/+16.5% T-60 on 213, but the split vs a random cut of S9
  is p≈.10 — see the S9 ∪ S10 portfolio section. Revisit with a 5th season; if it
  holds it converts S9 into a higher-conviction two-thirds
- **NBA expected-eFG from shot coordinates** correlates **+4.65** with the T-60
  spread residual while ACTUAL eFG correlates **+0.05** — the market prices
  shooting RESULTS and not shooting PROCESS. Impossible from box scores; the most
  useful thing the PBP pull produced. A feature, not a rule (best standalone cell
  is late season, +2.1% ROI, carried by one season)
- CBB OBSCURE weekday games (both KP>100, pre-7pm Mon-Thu) → BACK AWAY
  53.2%/+1.7% (n=757, 4/4 seasons); **+ attendance ≤25th pct → 53.8%/+2.8%
  (n=409, 4/4)** — crowd-less HCA discount (VENUE_BRIEF1 §C-D)
- CBB PRIMETIME marquee (both KP top-40, 7-10pm) → UNDER 54.6%/+4.3% (n=377,
  strengthening); primetime home side covers 55.6-57.6%
- CBB ALTITUDE: back altitude home vs lowlander +2.0% (n=702); fade altitude
  teams on road; use as model flags
- CBB NEUTRAL-SITE nominal-home lean: 51.6% neutral / 52.8% MTEs; NCAA
  tournament favorites 56.5% (n=235) — listing/chalk biases (CONTEXT_BRIEF1)
- **FADE-THE-MODEL in ranked-conference games**: model |edge|≥3 → bet the
  OTHER side = 57.3% (n=75, dose-response 50.6→53.7→57.3 by threshold,
  positive all 3 test seasons). Specific to ranked-conf (blue-blood/top-40
  versions ≈50-52%). Mechanism: ratings-based disagreement with the close in
  the most-analyzed games is actively wrong. Small-n scan discovery — treat
  as TRACK-PLUS, symmetric with any 58% cell. A stacked calibrator learns a
  shrunk version of this (needs the explicit edge×ranked_conf feature +
  loose leaves); the rule layer carries it at full strength meanwhile.

## Derivative-market weird lines (H1TT_BBALL_BRIEF2.md)

**TT news-lag family (S1's mechanism, 3rd independent confirmation):**
- home TT ≥3 BELOW KP score + home absence → UNDER 66.7%/+25.7% (n=66, 3/3)
- away TT ≥5 BELOW KP → UNDER (line side) 57.5%/+8.9% (n=113, 3/3)
- extreme TT devs: ALWAYS line side; ratings side -10 to -20%
1H: spread weirdness line-side at ≥2.5 (+0.8%); big-out 1H fade 53.8% (use
FG version instead); both-back-loaded → 1H UNDER 53.5% (mild).
**THE CUT LAW (all derivative markets): when books CUT a derivative total
below ratings-implied, follow it further — TT ≥5 below → U 57.5%/+8.9%;
TT below + absence → U 66.7%/+25.7%; 1H total ≥2.5 below → U 53.8%/+1.9%
(≥3.5: 54.5%/+3.3%). RAISED lines carry no information. Ratings side of any
cut: -10 to -20%.**

## Weird-lines verdict (WEIRD_LINES_BRIEF1.md)

Raw PR-vs-line deviation: line side wins the argument, vig eats it. What
carries information: deviation BY MOVEMENT (follow, 52-57%), deviation in
Jan+ (54.1%/+3.2% line side), deviation + visible absence (54.1%/+3.5% —
S1's news lag through the lines lens). NEVER bet the ratings side of ML
disagreements (-10 to -28% — KP dogs are value traps). Nov weirdness = stale
KP priors, fade the line side. dev/dev_open/became_weird → calibrator.

## NBA props verdict (PROPS_BBALL_BRIEF1/2.md)

**Vig fortress — no bettable edge from relationship signals.** Teammate-out
bumps, form-lag, style tiers, minutes trends, star-return unders, stale-book
chase (65.8% win, -4% ROI!), best-line shopping (62.5% win, -3.6%): all
juice-compensated. Structural: consensus prop lines shade HIGH vs form
(unders win 52-58% pre-juice). NFL props were beatable; NBA props are not —
at T-60, consensus, these 10 books. Future angles: projection model beating
market minutes/usage, pre-close timing, softer books, CBB props (2026-27).

## Trap-game detector (public record × line position/movement): TESTED, NULL

Owner's 3-layer hypothesis (public ATS-vs-profile record → market overcorrects
→ detect via line-vs-ratings dev or line movement): tested both versions
2026-07-17. Static dev conditioning: non-monotone (54.3% at n=70 but WORSE
than control at ≥1/≥2). Movement conditioning: trap cell 50.7% vs 53.1%
control — no confirmation. Mild mirror survivor: good-record + line steamed
TOWARD team → fade 53.2%/+1.6% (3/4, TRACK only). Why it fails: ATS-vs-
profile records are small-sample noise the market processes efficiently ON
AVERAGE; movement reflects many forces. **The layer-3 overcorrection concept
IS validated elsewhere — became-weird movement, the Cut Law, S1/S5, the five
narrative fades — those are the productionized versions of this idea.**

## NBA TEAM-luck regression: TESTED EXHAUSTIVELY, NULL (2026-07-30)

The MLB luck framing — who has been getting lucky, who has had a bad few games and is due
— ported to the NBA and run against **every market we have prices for** (FG spread at open
and T-60, moneyline, FG total, 1H spread, 1H total, both team totals). Panel:
`nba_luck_build.py` → `nba_team_luck{,_games}.parquet`, 10,556 team-games / 5,278 games, 13
luck families (pythagorean, close-game, margin-vs-own-baseline, ATS margin, three-point %
made and allowed, FT%, eFG made and allowed, off/def efficiency), 5- and 10-game windows,
all-minutes and garbage-time-stripped, every metric measured against the team's **own
expanding baseline** rather than league average.

Four independent designs, four nulls:

| design | file | result |
|---|---|---|
| 352-cell sweep, all markets | `nba_luck_sweep.py` | best edge +3.85 vs a noise ceiling of +3.18; **family-wise p = .173**, and a RATE control ranked 9th |
| gradient / composite / phase / unpriced residual | `nba_luck_stage2.py` | all decile trends flat (\|r\| ≤ .036); the rate control ranked **above** every luck composite on sides; residualising against the closing number and the open→close move killed what was left |
| dose ladder + walk-forward on the one survivor (shooting luck → UNDER) | `nba_luck_totals.py` | pooled FG total 53.1% / +3.0 edge, but **walk-forward ROI −0.9%** and the 50/33/20/10 ladder is non-monotone (+1.8, +3.0, +1.5, +4.2) |
| the conjunction (bad results AND bad luck together) | `nba_luck_divergence.py` | every pooled union row **negative ROI**; the "both channels agree" cells score the same as the "channels disagree" control cells |

**Why it is null, and why this does not contradict MLB.** Baseball's luck edge survives
because a bad month for a hitter is ~100 plate appearances and the market cannot separate
skill from variance at that sample. An NBA team plays 82 games with a stable rotation, and by
the tenth game the market has a better read on true strength than any trailing-window luck
score does. Everything the luck panel measures is already in the number.

**The control is the load-bearing part.** Shot RATES (three-point attempts taken and allowed)
are style, not luck, and cannot regress the way a percentage can. They score *as well as or
better than* the luck features in every table above. Any future version of this that reports
a 54% cell without running that control is not measuring luck.

**What would change the verdict:** a genuinely unpriced luck channel, not a re-slice of these
— referee/whistle luck, opponent-injury-timing luck, or scheduling luck at a granularity the
market ignores. Do not rebuild this from the same inputs.

## Dead list (tested honestly, do NOT rebuild without new information)

Movement follow/fade (all buckets, both sports) · KenPom-edge vs close (fully
priced; bigger disagreement = worse) · regression/streak fades (pre-regressed
into lines) · CBB H2H · raw height/experience/continuity-home clashes · pace
battles · TO-vs-TO and OREB-vs-DREB standalone · stale-book chase NBA (juice
trap) · big-fav CBB team totals (12% vig both sides) · 3-heavy dog variance
theory (backwards) · possession-level shot-luck regression (fully priced — REGRESSION_BRIEF2) · team-specific venue-history HCA · **NBA TEAM-level luck regression, all 8 markets (see section above — 4 designs, 4 nulls)** · v1/v2 GBM models vs the close (market MAE wins; model
value is baseline + confluence only).

## Segment calibration (2026-07-17, owner-prompted)

Measured signed bias (actual − model), 3 test seasons: NCAA totals run
+2.6 above model (1H +1.6, home TT +2.1); NIT +4.5 (opt-out defense
evaporation); conf-tourney home margins −0.9 (neutral under-correction);
Regular/MTE ≈ 0. **Contexts ARE structurally different — BUT naive offset
calibration FAILS out-of-sample** (2026 NCAA: +3.4 total offset made picks
WORSE, 53.7%→46.3% — tournament-year effects vary, 134-game priors can't pin
them, and the LINE adjusts too). Production policy: class flags in features
(done) + segment BET POLICIES (NIT excluded, March 1H-spread watch, unit
discipline) — no segment offsets until several more tournament years of
sample. NIT totals bias → never bet NIT unders (tracking).

## Method law (learned the hard way)

Single factors screened alone ≈ always "priced". The edges live in
INTERACTIONS: signal × style-fit × depth × timing. Build combos first.
And: books shade PRICES not lines — always grade at real prices in decimal.

**Quote every win rate next to ITS OWN slice's baseline.** A spread is a
two-way market so a coin wins 50% — but blind favourite covers 53.05% in late
NBA games, and prop UNDERS already hit 54–56% before any model touches them.
The same 56% is a +9 finding in one slice and worth nothing in another. This
caused real confusion (owner, 2026-07-30: "I keep seeing accuracies above 54%
but you keep saying things are dead"). For any rule whose picks are >85% one
naive side, the baseline must be that naive rule computed **on the identical
games the rule fires on** (`fav in-subset`), not just cell-matched across the
population — that distinction is what turned S9 from a dead side-picker into a
game-selection edge.

**But `fav in-subset` is TAUTOLOGICAL once the rule's side IS the favourite.**
S9 bets the favourite, so blind favourite over S9's games returns S9's own win
rate — the column reads 61.0 next to a 61.0 result and looks like a null when it
is arithmetic. The law above applies to rules that merely LEAN favourite; for
rules that ARE "back the favourite", the comparator must be blind favourite over
a WIDER pool, reweighted to the selection's own |spread| bucket mix (`delta
cell`, `nba_combine_controls.py:cell_matched`). Sanity check it by running the
naive rule against itself — it must return exactly 0.00, as row F does.

**A partition is not an independent test.** Splitting a validated signal in two
and reporting the good half inflates it by construction: the strong half is
strong *because* the weak half is weak. The only answerable question is whether
the cut beats a RANDOM cut of the same sizes — permute the labels, hold the split
sizes fixed. The xEFG gate on S9 looked like +5pp of free lift and came back at
p≈.10 under that test.

**Never pool a season into one number before splitting it by phase.** The NBA
FG spread looked flat pooled and hid four different regimes: early +5.5 vs
naive, mid +3.0, late **-16.1**, playoffs +23.5. A model that is monotonically
WORSE the more confident it is has found something real with the sign backwards
— that is a missing-feature diagnosis, not a dead market. Chase the inversion;
S9 came out of it. `min(h_gp, a_gp)` < 15 / 15-50 / ≥50 / postseason.

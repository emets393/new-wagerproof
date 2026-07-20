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

## Dead list (tested honestly, do NOT rebuild without new information)

Movement follow/fade (all buckets, both sports) · KenPom-edge vs close (fully
priced; bigger disagreement = worse) · regression/streak fades (pre-regressed
into lines) · CBB H2H · raw height/experience/continuity-home clashes · pace
battles · TO-vs-TO and OREB-vs-DREB standalone · stale-book chase NBA (juice
trap) · big-fav CBB team totals (12% vig both sides) · 3-heavy dog variance
theory (backwards) · possession-level shot-luck regression (fully priced — REGRESSION_BRIEF2) · team-specific venue-history HCA · v1/v2 GBM models vs the close (market MAE wins; model
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

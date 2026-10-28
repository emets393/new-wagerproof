# NCAAB: size + defense vs a paint-heavy, non-shooting offense (2026-10-28)

**Owner's theory:** a team that scores in the paint and does not shoot threes meets a team that is much bigger and plays good
defense → the small team cannot score, the big team wins, and the game stays **under**.

**Verdict in one line:** the matchup is real but the market has the *sides* right and the *total* **backwards** — these games go
**OVER**, not under. Pre-stated cell 424-344 over (55.2%, +5.4% at the price); add "and the small team shoots it badly" and it is
**258-176 (59.4%, +13.4%), six of six seasons, shuffle p .001**. Spread and moneyline are priced (big team ATS 51.5%, ML ≈ 0%).

Scripts: `size_defense_study.py` → `SIZE_DEFENSE_RUN.txt` (ladders, pre-stated cells, splits, market check);
`over_robustness.py` → `OVER_ROBUSTNESS.txt` (spread-matched control, threshold grid, ladders, per season);
`over_checks2.py` → `OVER_CHECKS2.txt` (opener, ROI at price, box-score mechanism). Six seasons 2020-21..2025-26, T-60 close,
63,882 priced team-games; style columns need ~6 prior games so 54,485 rows carry the full trigger.

## Definitions (all pregame)

| piece | source | rule |
|---|---|---|
| "scores inside, no threes" | CBBD box, expanding mean of PRIOR games, percentile within season | 3PA rate bottom quartile (≤ 25th pct) |
| "can't shoot" | same | 3P% below the season median |
| "much bigger" | KenPom roster effective height (`HgtEff`, inches above D-I average) | opponent − team ≥ +1.0 inch |
| "good defense" | KenPom AdjDE as of the game date (archive) | opponent in the top 20% of defenses that month |
| graded | T-60 close | OVER at the T-60 over price; big team ATS at −110; big team ML at its price |

Paint share (box `pointsInPaint`) is reliable only from 2022-23; the 3PA-rate version carries the same read on 2023-26 (T6/T7 in
the run), so 3PA rate is the definition.

## The thesis cell and its refinement

| cell | n | OVER | % | ROI at price | vs opener | big ATS | big ML ROI | spread-matched over expectation | shuffle p |
|---|---|---|---|---|---|---|---|---|---|
| T1 3PA bottom quartile & opp +1" & opp top-20% D | 776 | 424-344 | 55.2% | +5.4% | 55.5% | 393-370 (51.5%) | +0.4% | 51.5% (+3.7) | .011 |
| **T4 T1 & 3P% below median** | **438** | **258-176** | **59.4%** | **+13.4%** | **59.9%** | 216-214 (50.2%) | −0.8% | 51.8% (+7.7) | **.001** |
| placebo: 3PA TOP quartile vs the same opponent | 756 | 361-390 | 48.1% under / 51.9% over | −8.2% | | 50.4% | −4.9% | 51.3% (+0.7) | .34 |

T4 by season (over): 2020-21 21-16 · 21-22 47-26 · 22-23 39-29 · 23-24 56-39 · 24-25 57-31 · 25-26 38-35. Every split holds:
Nov-Dec 62.9%, Jan-Mar 56.5%, big team home 58.2% / away 56.6%, big favored 10+ 59.8% / 0-10 59.1% / big is the dog 58.1%.
T1 by season is 4 of 6 (2020-21 and 2022-23 lose narrowly).

## Dose ladders (the reason to believe it)

- **Small team's 3P% inside T1** (worst → best): over 62.2 / 57.4 / 52.8 / 45.7 / 52.8%. The worse the shooting, the more the over.
- **Opponent defense quintile** inside (3PA bottom quartile & opp +1"): best D 55.2 / 50.4 / 51.2 / 49.2 / worst D 46.8%. Monotone:
  the better the defense the small team faces, the more the over. Same shape with 3P% bottom 40% in place of 3PA rate
  (55.1 / 50.7 / 52.4 / 47.9 / 48.4).
- **Height** inside (3PA bottom quartile & top-20% D): we are 2+" taller 46.4 → 1-2" taller 47.1 → even 50.2 → they are 1-2" taller
  55.5 → 2+" taller 51.0%. A step at +1", not a dose past +2" (thin, n 146), and the *reverse* — a non-shooting team that is the
  taller side against a good defense — leans UNDER (295-334, 53.1% under).
- Threshold grid (3PA cut 0.20/0.25/0.33 × gap 0.5/1/1.5/2 × D 15/20/30%): 36 cells, 33 above 51.5%, 52-57% wherever gap ≥ 1 and
  D ≤ 20%, softer at D ≤ 30% and at gap ≥ 2.
- Any height, bad shooters (3P% bottom 40%) vs top-20% D: 1,985-1,794 over (52.5%, 5/6 seasons, p .027), placebo good shooters
  49.8%, bad shooters vs bad D 50.2%. Height adds the rest.

## Why over, not under (box scores 2022-23 on, 557 T1 games)

| | T1 games | all games |
|---|---|---|
| total line / actual | 142.3 / 144.7 | 143.1 / 144.0 |
| small team pts vs implied | **+0.86** | +0.44 |
| big team pts vs implied | **+1.52** | +0.44 |
| fouls: small team / big team | 18.2 / 16.3 | 17.1 / 17.2 |
| free throws: small / big | 17.7 / **20.8** | 19.2 / 19.2 |
| paint points: small / big | 30.1 / **34.2** | 31.3 / 31.4 |
| pace | 67.9 | 67.4 |

The market shades the total down about a point for "bad offense meets great defense" and the games come in **2.4 points higher**
than that. The small team does not get shut down — it scores slightly *above* its implied — and the big team feeds on it: more
paint points, more free throws (the small team fouls the bigs), a touch more pace. Both teams beat their implied totals. The opener
and the close agree (close moves +0.19), so the market never corrects it. Blowout share (big team wins by 15+) is 15%, same as
the league, so this is not garbage time.

## Sides: nothing

Big team ATS 51.5% (T1) / 50.2% (T4), ML at price +0.4% / −0.8% — the market has the winner and the margin. The one side cell
above noise is post-hoc and thin: big defensive team as the **dog** in T1 covers 118-87 (57.6%) and wins outright 37% vs 32%
implied (n 209). Not proposed.

## Caveats

- The sign is the **opposite of the stated theory**; the over read is post-hoc as to direction (the cells themselves were
  pre-stated). T4 is one refinement of ~15 thesis cells in the script. Treat the back-test as optimistic by a point or two.
- Height is a step at +1", not a dose; the 2+" cell is thin and softer.
- Style percentiles need ~6 prior games, so each team's first ~6 games are out; in November the trigger fires from mid-month.
- KenPom `HgtEff` is the season roster (minutes-weighted), a mild in-season look-ahead on who plays; roster height barely moves.
- Totals price at ~1.91; ROI is at the captured T-60 over price.

## Shipping proposal (not built)

`ncaab_small_vs_big_d_over`, market total, tier candidate: team 3PA rate bottom quartile and 3P% below median (season to date,
≥ 6 games) · opponent KenPom HgtEff ≥ +1.0" · opponent KenPom AdjDE top 20% as of today → **bet OVER** at the posted total.
Back-test 258-176 (59.4%, +13.4%) 2020-21..2025-26. Inputs already exist in `cfb_automation/scripts/cfb/ncaab_model/feeds.py`
(CBBD team box, `kenpom_height`, `kenpom_daily`) and the Odds API totals. Held with the other early-season signals until the
owner ships them together.

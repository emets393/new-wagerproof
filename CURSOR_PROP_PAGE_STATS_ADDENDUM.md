# Cursor Addendum: locked WHO-HE-IS stat groupings + tooltips (owner-approved)

The `ngs` payload on `nfl_prop_player_pages` now carries the full locked stat set —
reloaded for all 670 week-1 players. Replace the current WHO HE IS tile picks with the
groupings below, and update EVERY tooltip to the copy provided. Render-only as always:
every value+percentile is served; where `pctile` is null, show the value without a rank.

## Percentile semantics (important)
- `pctile` = league percentile among qualified players, **higher is always better as
  served** — `drop_rate` and `int_worthy_rate` arrive pre-inverted, so a 90 means elite
  hands / careful thrower. Render all pctiles uniformly (TOP X% badge / ring fill).
- Stats served with `pctile: null` are **descriptive** (cushion, time_to_los, pa_rate,
  rz shares) — render the value + tooltip, no good/bad coloring, no badge.

## Locked tile map — 4 headline tiles per tab, rest in a "More stats" expander

**WR/TE · Receptions:** `baseline.targets` /g · `baseline.receptions` /g · `ngs.separation` · `ngs.catch_pct`
  — expander: `ngs.cushion`, `ngs.drop_rate`
**WR/TE · Receiving Yards:** `baseline.rec_yds` /g · `ngs.air_share` · `ngs.adot` · `ngs.yac_above_exp`
  — expander: `ngs.separation`, `ngs.contested_catch`
**WR/TE · Anytime TD:** `baseline.total_td` (season count) · `ngs.air_share` · `ngs.contested_catch` · `ngs.rz_tgt_share`
  — expander: `ngs.created_rate`
**RB · Rushing Yards / Rush Attempts:** `baseline.rush_yds` /g · `baseline.rush_att` /g · `ngs.ryoe_per_att` · `ngs.eight_box_pct`
  — expander: `ngs.efficiency`, `ngs.time_to_los`
**RB · Receptions/Rec Yds:** `baseline.targets` /g · `baseline.receptions` /g · `ngs.rz_tgt_share` (if present) · `baseline.rec_yds` /g
**RB · Anytime TD:** `baseline.total_td` · `ngs.rz_carry_share` · `ngs.ryoe_per_att` · `ngs.eight_box_pct`
**QB · Passing Yards / Pass TDs:** `baseline.pass_yds` /g · `baseline.pass_att` /g · `ngs.cpoe` · `ngs.intended_air_yds`
  — expander: `ngs.time_to_throw`, `ngs.aggressiveness`, `ngs.air_yds_to_sticks`, `ngs.int_worthy_rate`
**QB · Attempts / Completions:** `baseline.pass_att` /g · comp/g (serve note: completions = att × comp% — if not present in baseline, show `ngs`-side comp via scheme.player_overall.comp_pct) · `scheme.player_overall.comp_pct` · `ngs.time_to_throw`
  — expander: `ngs.pa_rate`

## Tooltips (exact copy — replace all existing)

| field | label | tooltip |
|---|---|---|
| separation | Separation | Average yards of space he creates from the nearest defender at the moment the ball arrives. The best route-runners live above 3.0. |
| cushion | Cushion | How far defenders line up off him at the snap. Big cushion = defenses fear his speed; small cushion = they press him. |
| adot | aDOT | Average depth of target — how far downfield his targets travel. High = deep threat, low = short-game volume. |
| air_share | Air-Yard Share | His share of the team's total intended deep yardage. The single best measure of how much the offense funnels through him. |
| yac_above_exp | YAC Over Expected | Yards after catch beyond what an average receiver gains from the same catch spots. Positive = creates extra yards on his own. |
| catch_pct | Catch % | Percentage of his targets he catches. Volume-safe hands metric. |
| drop_rate | Drop Rate | Drops as a share of catchable targets (charted). Served so a higher rank = safer hands. |
| contested_catch | Contested Catch % | How often he wins when the defender is draped on him at the catch point (charted). The 50/50-ball skill — big for TD props. |
| created_rate | Created Receptions | Share of his catches that charting graded as created by the receiver (not scheme) — separation or spectacular play. |
| rz_tgt_share | Red-Zone Target Share | His share of the team's targets inside the 20 this past season. The TD-opportunity stat. |
| rz_carry_share | Red-Zone Carry Share | His share of the team's carries inside the 20 this past season. Goal-line role = TD equity. |
| ryoe_per_att | RYOE / Attempt | Rush yards over expected per carry — what he gains beyond what blocking and box count predict. The purest RB skill number. |
| efficiency | Efficiency | North-south score: total distance traveled per yard gained. LOWER = more decisive, downhill runner (descriptive). |
| eight_box_pct | 8+ Box Rate | How often defenses stack 8+ in the box against him — the respect he commands, and the context for the box matchup below. |
| time_to_los | Time to LOS | Seconds from handoff to crossing the line of scrimmage. Quick = one-cut; slow = patient/bounce runner (descriptive). |
| cpoe | CPOE | Completion percentage above expected — accuracy after accounting for how hard his throws are. The best single QB skill stat. |
| time_to_throw | Time to Throw | Average seconds from snap to release. Quick release beats pressure; long hold = deep shots but sack risk. |
| intended_air_yds | Intended Air Yds | Average depth of his throws. High = aggressive downfield offense — pairs with passing-yard upside. |
| air_yds_to_sticks | Air Yds to Sticks | How far beyond the first-down marker he throws on average. Positive = attacks past the sticks. |
| aggressiveness | Aggressiveness | Share of throws into tight windows (defender within a yard). High = trusts his arm into coverage. |
| int_worthy_rate | INT-Worthy Rate | Charted share of dropbacks with a throw that should have been intercepted. Served so a higher rank = fewer dangerous throws. |
| pa_rate | Play-Action Rate | Share of his dropbacks using play-action (descriptive — scheme usage, not skill). |
| completed_air_yds | Completed Air Yds | Average downfield distance of his completions — how much of his yardage flies through the air. |
| passer/comp_pct | Completion % | Straight completion percentage on attempts. |

Also update the existing baseline-tile tooltips to match the same voice (one plain sentence
+ one "why it matters for this prop" clause). QA: Jefferson's Receiving-Yards tab should now
lead with 61.6 yds/g · Air-Yard Share 41% (TOP 10%) · aDOT 10.1 · YAC+0.89; his Receptions
tab shows Separation 3.2; his ATD tab shows Red-Zone Target Share 25%. Allen's Passing tab
leads with CPOE.

# NCAAB matchup interactions, totals first (2026-10-28)

**Direction (owner):** after the size-vs-defense over, test the other two-team fits the market might price as teams rather than
as a matchup. Pre-stated grid `matchup_grid.py` → `MATCHUP_GRID.txt` (turnovers, glass, fouls, pace, experience/bench, threes, and
the size result's cousins), follow-up `bad_o_great_d.py` → `BAD_O_GREAT_D.txt`. Six seasons, T-60 close, 52,909 team-games with
style + KenPom as-of; shuffle null within season-month; totals also compared with a spread-matched expectation (big favorites
run over on their own, 54% at 20+).

## ★ The family: a bad offense meeting a great defense goes OVER

KenPom AdjOE quintile of the offense × AdjDE quintile of the defense it faces, over %:

| offense \ defense | best D | Q2 | Q3 | Q4 | worst D |
|---|---|---|---|---|---|
| **worst O** | **56.5% (622)** | 51.4 | 51.9 | 51.5 | 48.0 |
| Q2 | 52.7 | 51.7 | 51.3 | 48.8 | 50.5 |
| Q3 | 52.8 | 51.8 | 50.4 | 51.5 | 49.2 |
| Q4 | 52.5 | 50.8 | 51.7 | 52.2 | 50.4 |
| best O | 48.9 (4,695) | 51.2 | 47.7 | 53.9 | 53.3 |

- **Worst-20% offense vs best-20% defense: OVER 350-269 (56.5%, +7.9% at the price)**, shuffle p .004, spread-matched expectation
  52.6%, five of six seasons (2020-21 14-14, then 71-58, 65-47, 63-58, 58-52, 79-40). Holds Nov-Dec 56.5% and Jan+ 56.6%, non-conf
  56.0% and conference 57.2%, home 56.1% and road 56.7%, favorite of 20+ 56.8% / 10-20 56.5% / under 10 55.0%. Thin only on totals
  under 135 (52.4%).
- Dose: 10%/10% cut 59.5% (72-49); 30%/30% cut 55.4% (1,105-891, p < .001). The best-offense row runs the other way (best O vs best
  D 51.1% under), so it is the corner, not "good defense → over".
- Same shape through the style columns: bad 3P% team vs elite eFG defense over 53.7% (1,751-1,509, p .001, 6/6); turnover-prone
  offense vs top-20% D over 53.5% (p .007). The size signal is this family's sharpest instance: the two overlap on 93 games that went
  **over 66-27 (71%)**; the size cell without a bottom-20% offense is still 56.4%, and the bad-O cell without the size trigger 54.0%.
  **Union of the two: 531-409 (56.5%, +7.8%), six of six seasons** (31-27, 106-81, 94-70, 101-88, 96-73, 103-70).
- Mechanism (same as the size study): the market shades the total down 4-5 points for the matchup (line 138 vs 143) and the games land
  3 points above that. Both teams beat their implied totals.

**Proposal:** `ncaab_bad_o_great_d_over` — KenPom AdjOE bottom 20% of Division I vs KenPom AdjDE top 20%, as of today → bet OVER.
Back-test 350-269 (56.5%, +7.9%). KenPom-only, so it fires from opening night (no six-game wait). Companion to `ncaab_small_vs_big_d_over`;
when both fire on a game the record is 66-27.

## Two side leans (not totals)

- **Glass + height:** own offensive-rebounding top quarter vs a defense that allows offensive boards (top quarter) → own ATS 52.8%
  (1,991-1,781, p < .001, 6/6) alone; **and own taller by 1+ inch: 355-286 (55.4%, +5.8%, p .006)**, four of six seasons (43-40, 62-64,
  68-49, 61-40, 43-45, 78-48); 0.5+ inch 585-481 (54.9%, 5/6); 2+ inch 82-61. Control (opponent protects its glass) 51.4%; own shorter
  51.3%. A real lean; the height cut is pre-stated in the grid but the 0.5" look is post-hoc.
- **Deep-bench fade:** team whose KenPom bench-minutes share is 10+ points above the opponent's covers 46.8% → fade 2,765-2,436 (53.2%,
  +1.5%, p < .001), 5/6 seasons, holds at matched KenPom quality (907-782, 53.7%), as favorite (54.2%) and dog (52.5%). Real, thin.

## Nulls (do not re-run)

Turnover-prone vs forces turnovers: total 50.9%, ATS 49.9%, flat dose. Fouls (gets to the line vs fouls a lot): 50.2%, flat dose.
Pace mismatch: the **slow team dictates** tempo whether it is the favorite or the dog (realised pace 67 vs a 68.6 midpoint, 1.5-1.7
possessions toward the slow team) and the total already knows (50.9%); slow-vs-slow over 53.4% (+1.9%) is the known tempo lean.
Experience (KenPom Exp gap) 50.4-50.5% ATS everywhere incl. road / neutral / March / tournaments. 3-heavy offense vs allows-threes
defense over 52.2% = the known 3-heavy over lean, not a matchup.

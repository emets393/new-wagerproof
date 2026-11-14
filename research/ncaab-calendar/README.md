# NCAAB early-season calendar spots (2026-10-28)

**Direction (owner):** timing spots the market may miss early in the season. Pre-stated cells in `calendar_spots.py` → `CALENDAR_SPOTS.txt`,
per-season follow-ups in `CALENDAR_FOLLOWUP.txt`. Six seasons, T-60 close, shuffle null within season-month.

## ★ First true road game of the season → fade the visitor

| cell | back the HOME team | % | ROI | seasons |
|---|---|---|---|---|
| visitor's first true road game, any prior count (n 2,143) | **1,130-978** | **53.6%** | +2.4% | 6/6 (177-157, 175-169, 189-167, 210-144, 197-160, 182-181), p < .001 |
| … visitor is the **favorite** (n 434) | **243-185** | **56.8%** | **+8.4%** | 5/6 (38-35, 46-30, 50-35, 42-23, 40-27, 27-35), p .007 |
| … visitor is the dog | 883-792 | 52.7% | +0.8% | |
| … it is also the visitor's season opener | 542-482 | 52.9% | | |
| … after 2-4 / 5+ home-or-neutral games | 326-278 / 262-218 | 54.0% / 54.6% | | |
| control: visitor's 2nd road game | 1,046-1,075 | 49.3% | | |
| control: visitor's 3rd road game | 1,026-1,083 | 48.6% | | |

The read is the first trip, not road teams: the second and third trips run below 50% from the same side. First-trip visitors are
+9.1 dogs on average and lose by 10.0; the market gives them a point too much. Built as `ncaab_first_road_game_fade` (home team ATS,
conviction med when the visitor is favored), held with the stack.

## Leans worth a paper track, not signals

- **Conference opener after a hard non-conference schedule**: team that went ≤ .500 against a top-quarter non-conf schedule → fade in
  conference game 1, 120-91 (56.9%, p .046, 6/6 seasons); team that went ≥ .700 against the same kind of schedule → back, 110-76 (59.1%,
  p .019, 5/6 + one 16-16). Record against a real schedule carries into conference play more than the market credits. Two of ~25 cells,
  n ~200 each; the "soft schedule, shiny record" fade the theory predicted does NOT exist (games 1-3 back 78-56 with a non-monotone
  schedule ladder 61.7 / 48.2 / 44.9 / 57.9 / 54.1%).

## Nulls (do not re-run)

- **Three games in three days** (November events): ATS 49.7%, total 47% under (p .25); nothing by rest edge, bench depth or experience.
  Conference-tournament third days 53.1% ATS / 55.3% under on 324 games, inside the null. Second game in two days 50.0%.
- **December exam-break layoff** (8+ days off): ATS 49.9%, over 52.8% (p .08); 10+ days 47.5% ATS. January layoffs 49.3%.
- **MTE last day** could not be built: the panel's `tournament` column is empty for MTE rows (event names live in `notes`); skip unless the
  notes are parsed.

# NBA player-availability signal — what it is, and what it is not

Consolidated result of the RAPM absence work. Read this instead of the intermediate briefs;
where they disagree with this file, this file is the adjudication.

## The rule

Reindex every player onto his team's schedule (an unlisted game is an absence). Give each
player a rotation-minute baseline from a 10-game rolling mean that counts an absence as zero
minutes. For each team, take the rotation players (baseline ≥16 min) who are out tonight AND
were out last game, value them in RAPM margin points per 48 weighted by their share of the
team's rotation minutes, and sum. Back the side whose OPPONENT is more depleted.

## What it does

Graded against the **opening** full-game spread, 4 seasons, 5,060 joined games:

| bets | win % | slice base % | ROI % | p vs 2,000-perm null | by season |
|---|---|---|---|---|---|
| 400 | 54.2 | 51.2 | +3.6 | 0.052 | 56 / 53 / 56 / 52 |
| 800 | 54.1 | 50.1 | +3.3 | 0.003 | 57 / 55 / 54 / 52 |
| 1,600 | 53.1 | 50.7 | +1.4 | 0.001 | 57 / 51 / 53 / 52 |

Every season positive. Significance strengthens with sample size, which is what a real
effect does and what an overfit does not.

## What it is NOT — the finding that bounds everything above

Graded against the **T-60 close**, the price actually available near tip:

| market | bets | win % | slice base % | ROI % | p |
|---|---|---|---|---|---|
| FG spread T-60 | 800 | 52.4 | 51.1 | +0.0 | 0.098 |
| FG spread T-60 | 1,600 | 51.7 | 50.2 | −1.2 | 0.018 |
| 1H spread T-60 | 800 | 51.9 | 51.5 | −0.9 | 0.202 |
| 1H spread T-60 | 1,600 | 51.7 | 50.6 | −1.2 | 0.048 |

**The edge lives entirely between the opener and the close.** The market moves to price the
absence during that window, and by T-60 there is nothing left. This is a closing-line-value
signal, not an outcome-forecasting signal. Note the T-60 rows can be statistically
significant (p=.018) while losing money — significance is measured against the max-side
baseline, and clearing a hindsight-picked baseline by 1.6 points does not clear the vig.

Consequence: capturing this requires knowing tonight's availability **before the market
prices it**. That is a news-latency race against an injury feed, not a modelling edge. It is
a real category of edge and people do run it, but it is an operations problem — fast feed,
fast execution, opener-adjacent limits — and it is not what a better model buys you.

## What genuinely held up

**The RAPM valuation earns its keep** (`NBA_OUT_CONTROLS_BRIEF.md`). On identical games,
selecting by absent MINUTES scores 51.6% against a 51.9% baseline — below its own baseline,
worthless. Absent HEADCOUNT the same. The RAPM valuation of those same absences runs
59–61%. Where the two selectors disagree, following RAPM wins 53.8%. So the useful claim is
not the old "injuries are underpriced" — it is that **how much the absence is worth** is what
carries information, which is exactly what box scores cannot measure.

## Corrections to earlier claims in this repo

1. **The 61.2% headline in `NBA_OUT_SIGNAL_BRIEF.md` does not reproduce and should not be
   used.** It rested on shifting over each player's own listed box-score rows. A player
   absent long enough stops being listed at all, so 17.8% of player-team-game absences were
   invisible and a five-game absence read as consecutive appearances. On the corrected grid
   the same rule at matched bet counts falls from +8.0 edge to +4.0.

2. **`nba_out_streaks.py`'s reasoning is inverted.** It calls the decaying baseline a
   confound; it is the mechanism, acting as a recency filter. The played-only baseline it
   proposes as the fix is significant at no bet count and loses money.

3. **The `edge` metric is biased.** The slice baseline is `max(P(home covers), P(away
   covers))`, chosen with hindsight, so a coin flip scores about −2 on it rather than 0.
   Any reading of these tables against zero overstates the result by that much. Compare to
   the `null mean` column.

4. **Single-draw placebos are not evidence at these sample sizes.** At 200 bets one standard
   error is ~3.5 points; single placebos across identical cells ranged −7.0 to +5.0. All
   adjudication here uses 2,000 permutations.

5. **The mechanism split is weaker than claimed.** FRESH absences are significant at 400
   bets (p=.001) but not at 800 (p=.62), while MID is significant at both. The clean
   "market prices known absences, misprices new ones" story is not cleanly supported. What
   IS supported: LONG absences produce almost no signal at all — with the decaying baseline
   they decay out of the rotation filter entirely, which is the recency effect showing up
   structurally rather than statistically.

## Where this leaves the NBA model

Not a bettable standalone rule at the close. Two things it does buy:

- **A real feature.** RAPM-valued availability is informative about the opener→close move,
  so it belongs in a model as a feature even though it is not a rule on its own.
- **A validated pipeline.** Crosswalk (99.92% coverage, 99.96% independent score
  agreement), stint→RAPM, leak-safe player aggregates. The NCAAB port is the higher-value
  target: `nba-ncaab-odds-backfill` / `ncaab-bigout-fade-signal` show college does NOT price
  absences the way the NBA does (57.8%/+10.4%, premium tier 62.3%/+19.1%), and that is the
  market where this exact machinery should pay.

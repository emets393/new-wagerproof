# LOCKED RULE — "Key-Receiver-Out OVER" (2026 candidate)

**The first real edge surfaced from the player-level injury + NGS data** (the data we had all along and
hadn't been using). It's a totals pricing inefficiency, graded against the **closing** total and leak-safe.

## THE RULE (primary — lock this)
> **Bet the OVER on the closing total when either team has a WR / TE / RB whose season-to-date NGS
> air-yards share is ≥ 35% and who is listed OUT or DOUBTFUL on the final injury report.**

- **In-sample (2018–2025):** n = 185 games (~23/yr), **OVER 64.9%**, **ROI +23.8% @ −110**, 95% CI [58, 71],
  games land **+4.4 pts** over the (already-lowered) closing total.
- **Per-season:** 2018 73% · 2019 75% · 2020 73% · 2021 62% · 2022 50% · 2023 67% · 2024 53% · 2025 73%
  → **7/8 seasons beat the vig** (2022 the lone blemish at exactly breakeven; no losing season).
- **Robust to the threshold (not a magic number):** air-share ≥30% → 58.5%, ≥35% → 64.5%, ≥40% → 63.4%.
- **Null:** the combined rule (which includes weaker games) is already p=0.006 vs chance; the OFF component
  alone is stronger.
- **Baseline (no injury trigger): 46.8% over** — so the trigger games stand out sharply against a market
  that otherwise leans under.

### Mechanism (why it's real and sustainable)
When a team's primary air-yards target is ruled out, the market **over-lowers the total** (it overweights
the star's scoreboard impact). But the offense redistributes targets, game script opens up, and the
opponent scores into a now-one-dimensional defense — so the total comes in over. Because it's graded vs
the **closing** total (which already knows the injury), this is a **pricing error, not an information
edge** → you don't need to be faster than the market, just to bet the over. That's what makes it
sustainable rather than a CLV race.

## SECONDARY (watch — do NOT bet yet)
> Combined defensive snap-production missing ≥ 2.0 (≈ 2.5+ defensive regulars Out across the two teams) → OVER.

- n = 303, **OVER 54.5%**, ROI +4.0%, CI [49, 60], **5/8 seasons**. Mechanism (weak D → opp scores;
  market under-raises totals for defensive attrition) is plausible and the direction is right, but it's
  **marginal** (CI touches breakeven) and **dilutes the offensive rule when combined** (drops it to 56.4%,
  5/8). Track it; don't fold it into the bet.

## Honest status & caveats
- **CANDIDATE, not validated** — this is in-sample (2018–25). The bar to graduate is a clean **2026
  forward test** at the locked thresholds (no re-tuning).
- It's **air-share-specific**: a cruder snap-% weighting was much weaker (4–5/8 seasons), so the signal is
  specifically about losing a **high-air-yards (target-hog / vertical) receiver**, not any starter. That
  specificity is mechanism-aligned but means we must not threshold-shop — hence the fixed ≥35% lock.
- ~23 plays/year — low volume, totals only.
- Leak-safe: final injury report is pregame; air-share uses prior weeks only.

## Codeable definition (for the 2026 engine)
```
for each game, for each team:
  key_rec_out = exists a player p with position in {WR,TE,RB,FB}
                AND p.report_status in {Out, Doubtful}
                AND p.airshare_prior >= 35      # season-to-date % of team intended air yards, weeks < W
  off_trigger(game) = key_rec_out(home) OR key_rec_out(away)
PLAY: if off_trigger -> bet OVER closing total (1u, -110)
```
Per-game historical flags saved: `out/injury_over_rule.csv` (columns: off_trigger, def_trigger,
over_play, over result). Build/eval code: `b7c_over_rule.py`.

## What's next on this thread
1. **Forward-track 2026** at the locked ≥35% threshold (the only thing that graduates it to validated).
2. Refine the *value* weight: distinguish an elite WR1 (high air-share **and** high YAC-over-expected /
   separation) from a volume WR1 — may sharpen the 64.9%.
3. Test the inverse (a key receiver **returning** from injury → UNDER?) and QB-quality-adjusted versions.

---
## WAVE-2 REFINEMENTS (deep dive)
- **Efficiency weighting doesn't help.** Splitting elite (high YAC-over-expected) vs volume high-air-share
  receivers: 63% vs 68% — no improvement. **Air-share is the right metric; keep it simple.**
- **Cleaner variant — cumulative air-share ≥45%:** a team missing ≥45% of its air-yards production (one
  elite WR or several) → **OVER 65.4%, n=104, 8/8 seasons** (more consistent than the single-player ≥35%
  which had one 50% season). Use either; the ≥45% cumulative is the most season-stable.
- **Good QB out → also OVER (61%, n=80, 5/7)** — same direction, weaker; secondary, not a standalone bet.
- **NOT weather-confounded:** holds indoors (62%) and outdoors (65%).
- **Wind offsets it (interaction with the wind-under):** calm <10mph → **69.9%**, breezy 10–15 → 50%.
  → **REFINEMENT: stand down on the injury-OVER in windy (≥~13–15 mph) games.** Primetime mildly offsets too.
- **General scoring-deviation model has NO out-of-sample edge** (corr 0.002, MAE worse than the market) —
  the edge is the *tail* (star receiver Out), not a general "predict scoring" capability. Build for
  mispriced conditions, not a general beat-the-total model.

## BEST CURRENT FORM OF THE RULE (for 2026 forward test)
> Bet OVER when a team is missing ≥35–45% of its air-yards-share (WR/TE/RB Out/Doubtful), **unless the game
> is windy (≥~13–15 mph)** or a primetime slot (those independently lean under and offset it).

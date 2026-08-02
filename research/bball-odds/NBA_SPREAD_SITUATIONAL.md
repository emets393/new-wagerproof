# NBA spread, round 2 — the motivation block the model had never seen

Round 1 (`NBA_SPREAD_REDO.md`) found three different margin targets agreeing on +0.020 out-of-sample correlation and an ROI that does not clear the vig. Three specifications agreeing that precisely is one measurement, not three failures — the information in that feature set is fully extracted.

**But the feature set was missing a block.** Every validated NBA spread edge in this repo — S9, S11, S12, S15 — is built from elimination, tanking, season fraction and rest, and `_nba_wide_cache.parquet` carries none of them. The travel columns made it in; the motivation columns did not. So the spread model has been pronounced dead four times without ever seeing the only variables anyone has shown to move an NBA margin against the market. This closes that gap.

Motivation enters as a team DIFFERENCE (a column identical on both rows of a game cannot move an antisymmetric target) and is INTERACTED with the context that activates it — season fraction, post-deadline, both-teams-done, and the market's own price. That is deliberate: S9 is not "eliminated teams are bad", it is "eliminated AND late AND laying points". A main effect cannot represent a conjunction, which is why screening these one at a time would show noise.

| variant | features | oos corr with the margin residual |
|---|---|---|
| round 1 C (antisymmetric) | 212 | +0.0192 |
| round 1 B (full stack) | 433 | +0.0199 |
| **D** antisymmetric + motivation | 247 | **+0.0270** |
| **E** full stack + motivation | 468 | **+0.0283** |

## Ladders

Graded at the T-60 close against 20 game-level shuffles re-measured at every rung.

### D

| cut (pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| ≥1 | 2,847 | 51.8 | 50.1 | **+1.7** | **-1.1** | -0.61 | 1.19 | **+1.93** |
| ≥2 | 1,987 | 52.1 | 51.1 | **+1.0** | **-0.5** | -1.11 | 1.54 | **+1.38** |
| ≥3 | 1,326 | 52.2 | 51.4 | **+0.8** | **-0.4** | -1.55 | 1.72 | **+1.38** |
| ≥4 | 830 | 53.6 | 50.8 | **+2.8** | **+2.4** | -1.62 | 1.52 | **+2.88** |
| ≥5 | 511 | 53.0 | 51.3 | **+1.8** | **+1.3** | -2.39 | 1.79 | **+2.32** |

### E

| cut (pts) | bets | win% | base% | edge | ROI | null mean | null sd | z |
|---|---|---|---|---|---|---|---|---|
| ≥1 | 2,787 | 51.7 | 50.5 | **+1.3** | **-1.2** | -0.60 | 1.33 | **+1.39** |
| ≥2 | 1,923 | 51.8 | 50.8 | **+1.0** | **-1.0** | -1.05 | 1.50 | **+1.40** |
| ≥3 | 1,252 | 52.2 | 51.7 | **+0.6** | **-0.3** | -1.70 | 1.95 | **+1.16** |
| ≥4 | 791 | 53.6 | 50.3 | **+3.3** | **+2.3** | -1.75 | 1.76 | **+2.86** |
| ≥5 | 452 | 52.4 | 52.4 | **+0.0** | **+0.1** | -2.51 | 1.94 | **+1.30** |

## D broken out at the ≥4-point cut

**The rung was chosen after seeing the ladder, and the z above does not pay for that choice.** The ladder is not monotone, so ≥4 is a max-of-five pick and has to be discounted accordingly. What partly rescues it is that D and E — different feature counts, one of them carrying 221 extra symmetric columns the other drops — land on the same rung with the same sign and nearly the same z, which a pure selection artefact has no reason to do. Treat the seasons and phases below as the real test: a selected cut that only works in one year is a selected cut.

### by season

| season | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| 2023 | 299 | 50.8 | 50.2 | **+0.7** | **-2.9** |
| 2024 | 267 | 55.1 | 50.9 | **+4.1** | **+5.1** |
| 2025 | 264 | 55.3 | 53.8 | **+1.5** | **+5.6** |

### by phase

| phase | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| EARLY | 171 | 54.4 | 53.2 | **+1.2** | **+3.9** |
| MID | 231 | 52.4 | 51.9 | **+0.4** | **+0.0** |
| LATE | 387 | 54.3 | 52.5 | **+1.8** | **+3.6** |
| POST | 41 | 51.2 | 53.7 | **-2.4** | **-2.1** |

## Study 3 — do the model and the rules know different things?

The product bets rules, not models. The question that decides whether this model is worth anything to the betting layer is whether its disagreement with the line adds win rate INSIDE the games a rule already fires on. Each row is graded against the base rate of its own slice, and the S9/S11 rows are the published rule with no model filter, so the comparison is like for like.

| slice | bets | win% | base% | edge | ROI |
|---|---|---|---|---|---|
| S9 alone (back the favourite) | 246 | 58.1 | 52.0 | **+6.1** | **+11.0** |
| S9 AND model agrees, ≥4 pts | 73 | 58.9 | 50.7 | **+8.2** | **+12.4** |
| S11 alone (back the favourite) | 207 | 59.9 | 53.6 | **+6.3** | **+14.4** |
| S11 AND model agrees, ≥4 pts | 67 | 58.2 | 50.7 | **+7.5** | **+11.1** |
| model alone, ≥4 pts, outside S9 | 740 | 52.8 | 50.3 | **+2.6** | **+0.9** |


# Is the travel gain real, or just 54 more columns?

Adding travel moved the totals ridge from `+0.0672` to `+0.0742` out-of-sample correlation. Two boring explanations had to be ruled out before that counts: more columns give a ridge more room, and half the travel block (`km_7d`, `venues_7d`, `days_since_home`) arguably re-expresses the schedule counters that were already there.

**The placebo** permutes which GAME each travel row attaches to, within season. Same columns, same distributions, same internal correlations, same count — only the link to the game is broken. If corr still rises, the gain was capacity.

| arm | cols | oos corr | n @ k≥2 | win% | base% | edge | ROI |
|---|---|---|---|---|---|---|---|
| base (round 2) | 383 | `+0.0672` | 2280 | 53.7 | 50.4 | +3.3 | +2.5 |
| base + travel | 437 | `+0.0742` | 2290 | 53.5 | 50.3 | +3.1 | +2.1 |
| base + geography only (38 travel cols) | 421 | `+0.0648` | 2271 | 53.0 | 50.2 | +2.7 | +1.1 |
| base + cumulative load only (16 travel cols) | 399 | `+0.0726` | 2313 | 54.0 | 50.5 | +3.5 | +3.1 |
| **placebo** (travel on wrong games, 10 draws) | 437 | `+0.0640 ± 0.0037` | — | — | — | — | — |

Real gain sits **+2.76 standard deviations** above the placebo mean, and the placebo mean (`+0.0640`) sits *below* base — 54 columns attached to the wrong games make the model slightly worse, which is what should happen. The gain is travel, not capacity. Placebo range +0.0564 to +0.0696.

**Which half carries it.** Geography — tonight's flight distance, direction, altitude, body-clock hour — lands at or below base on its own. The cumulative load columns carry the gain. The acute-fatigue story is not what is in this data; the *how far has this team been dragged around lately* story is.


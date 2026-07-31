# Controls on 'S9 + xEFG agrees'

`fav ROI cell` = blind favourite over the comparison pool, reweighted to the SELECTION's own |spread| bucket mix. `delta` = the rule's ROI minus that. A rule that backs favourites is worth nothing unless delta is positive.

## OPEN

| selection | bets | win % | ROI % | fav ROI cell | delta | boot p5 |
|---|---|---|---|---|---|---|
| A. fav + xEFG agrees, ALL late games | 1,295 | 54.7 | +4.52 | +2.60 | **+1.92** | 52.4 |
| B. fav + xEFG agrees, ALL games | 2,789 | 52.7 | +0.70 | -1.16 | **+1.85** | 51.2 |
| C. S9 alone (dead home, back fav) | 323 | 61.9 | +18.20 | +3.53 | **+14.67** | 57.6 |
| D. S9 + xEFG agrees | 212 | 64.6 | +23.35 | +3.85 | **+19.50** | 59.0 |
| E. S9 + xEFG disagrees | 111 | 56.8 | +8.36 | +2.92 | **+5.45** | 48.6 |
| F. blind fav, all late games | 2,139 | 53.5 | +2.10 | +2.10 | **-0.00** | 51.7 |

## T-60

| selection | bets | win % | ROI % | fav ROI cell | delta | boot p5 |
|---|---|---|---|---|---|---|
| A. fav + xEFG agrees, ALL late games | 1,290 | 54.2 | +3.44 | +0.26 | **+3.18** | 51.9 |
| B. fav + xEFG agrees, ALL games | 2,780 | 51.6 | -1.51 | -3.66 | **+2.14** | 50.0 |
| C. S9 alone (dead home, back fav) | 326 | 58.3 | +11.27 | +0.92 | **+10.35** | 53.7 |
| D. S9 + xEFG agrees | 213 | 61.0 | +16.52 | +0.97 | **+15.55** | 55.4 |
| E. S9 + xEFG disagrees | 113 | 53.1 | +1.37 | +0.81 | **+0.56** | 45.1 |
| F. blind fav, all late games | 2,133 | 52.4 | -0.03 | -0.03 | **-0.00** | 50.6 |

## Is the D/E split better than a random cut of S9?

| grading | S9 n | agree n | agree win % | disagree n | disagree win % | gap | p(random cut ≥ gap) |
|---|---|---|---|---|---|---|---|
| OPEN | 323 | 212 | 64.6 | 111 | 56.8 | +7.9pp | **0.104** |
| T-60 | 326 | 213 | 61.0 | 113 | 53.1 | +7.9pp | **0.105** |

## Verdict

A came back FLAT (+3.18 delta at T-60 over 1,290 late games) — about what the xEFG feature was already known to be worth on its own, nowhere near 61%. So the gate is not the whole story and the dead-home condition is load-bearing. F is the machinery check: blind favourite against its own bucket-matched self is −0.00, as it must be.

**But D does not become a rule.** D and E are a PARTITION of the same 326 S9 bets, so D's lift over C is arithmetically forced the moment E comes in weak — it is not an independent test. The permutation test above is the only honest form of the question, and at p≈.10 a random cut of S9 reproduces the gap 1 time in 10. Betting the gated version means surrendering a third of a validated signal's volume to chase a refinement that has not cleared. **Track D, bet C.**


# 2026 MLB Team-Specific Run-Scoring Diagnostic

**Sample:** 1,648 team-games (31 abbreviations; `ATH`/`Ath` casing dup means
30 actual clubs — the 6 `Ath` rows are dropped throughout).
**Date range:** 2026 regular season as of report date.
**League baseline:** 4.38 runs/game · 2.43 F5 runs · 1.94 late runs (innings 6+).

**Bar for "notable":** |team-specific delta vs league effect| ≥ 0.6 runs AND
n ≥ 12. Anything looser is called out as **anecdotal** so you can read the
report at a glance and know which lines deserve weight.

---

## 1. Day vs Night

**League-wide effect: essentially zero.** Day games: 4.41 R (n=642).
Night games: 4.37 R (n=1000). The slate-wide day premium is **+0.04 runs** —
there is no league daypart effect to remove. Everything below is purely
team-specific.

### Day-game scorers (significantly better in daylight)

| Team | Day mean (n) | Night mean (n) | Team-spec Δ vs league |
|---|---|---|---|
| **DET** | 4.84 (19) | 3.36 (36) | **+1.44** |
| **BOS** | 4.41 (22) | 3.32 (31) | **+1.05** |
| **LAD** | 6.14 (14) | 5.07 (41) | **+1.03** *(day n small)* |
| **SD** | 4.69 (16) | 3.66 (38) | **+0.99** |
| **MIL** | 5.48 (21) | 4.58 (31) | **+0.86** |
| **LAA** | 4.61 (18) | 3.89 (37) | **+0.68** |
| **CLE** | 4.63 (19) | 3.92 (38) | **+0.67** |

### Night-game scorers (significantly better at night)

| Team | Day mean (n) | Night mean (n) | Team-spec Δ vs league |
|---|---|---|---|
| **WSH** | 4.56 (27) | 6.24 (29) | **−1.73** |
| **CWS** | 3.68 (25) | 5.14 (29) | **−1.50** |
| **NYM** | 3.21 (24) | 4.29 (31) | **−1.12** |
| **CHC** | 4.26 (27) | 5.00 (28) | **−0.78** |
| MIN | 4.31 (26) | 4.90 (29) | −0.63 *(borderline)* |
| HOU | 4.13 (24) | 4.69 (32) | −0.60 *(borderline)* |
| PIT | 4.63 (27) | 5.18 (28) | −0.59 *(borderline)* |

> The day/night signal is the **strongest team-specific bucket in the entire
> report**. Six teams swing >1.0 runs per game between dayparts, with WSH the
> single largest outlier in either direction (1.73 R swing toward night).

---

## 2. Opposing Starter Handedness (F5 runs)

**League-wide effect: very mild.** Mean F5 vs LHP = 2.49 (n=428). Vs RHP =
2.41 (n=1090). Pooled L-minus-R = **+0.08 runs** — basically zero.

### Crushes LHP (and/or struggles vs RHP)

| Team | F5 vs LHP (n) | F5 vs RHP (n) | Team-spec Δ vs league |
|---|---|---|---|
| **AZ** | 4.58 (12) | 2.33 (37) | **+2.17** |
| **NYY** | 3.22 (18) | 1.84 (33) | **+1.30** |
| **LAD** | 3.73 (11) | 2.56 (40) | +1.08 *(LHP n small)* |
| **BOS** | 2.80 (11) | 1.76 (38) | +0.96 *(LHP n small)* |
| **CIN** | 3.22 (10) | 2.38 (40) | +0.77 *(LHP n small)* |
| **MIN** | 3.65 (18) | 2.81 (32) | **+0.76** |
| **CLE** | 2.72 (18) | 1.94 (34) | **+0.70** |

### Crushed by LHP (favor RHP)

| Team | F5 vs LHP (n) | F5 vs RHP (n) | Team-spec Δ vs league |
|---|---|---|---|
| **TOR** | 1.36 (14) | 2.32 (37) | **−1.05** |
| **BAL** | 1.64 (14) | 2.56 (37) | **−0.99** |
| **PHI** | 1.37 (19) | 2.28 (33) | **−0.99** |
| CHC | 1.91 (11) | 2.77 (40) | −0.94 *(LHP n small)* |
| **HOU** | 2.38 (16) | 2.97 (36) | **−0.68** |
| STL | 1.70 (10) | 2.36 (40) | −0.74 *(LHP n small)* |
| SF | 1.73 (12) | 2.26 (38) | −0.62 *(LHP n borderline)* |

> Arizona's +2.17 vs LHP is **by far the largest split on the board** (more
> than 2 runs per F5 different from league pattern). At the other end,
> TOR / BAL / PHI all lose ~1 F5 run when a lefty starts against them.

---

## 3. Opposing Starter Quality Tier (F5 runs)

**League-wide effect: strong, monotonic.** F5 by opposing SP xFIP tier:
- Ace (≤3.50): **2.10** (n=630)
- Good (3.51–4.00): **2.59** (n=412)
- Average (4.01–4.50): **2.64** (n=350)
- Weak (>4.50): **2.76** (n=249)

A team that just scores 2.7 F5 vs weak SPs is **on-trend**, not notable.
What follows is teams whose F5 vs each tier diverges meaningfully from
the league mean for that tier.

### Feasts on Aces

| Team | F5 vs Ace | n | Δ vs league (2.10) |
|---|---|---|---|
| **MIN** | 3.61 | 23 | **+1.51** |
| **CWS** | 3.35 | 17 | **+1.25** |
| **WSH** | 2.86 | 21 | **+0.76** |

### Stymied by Aces

| Team | F5 vs Ace | n | Δ vs league (2.10) |
|---|---|---|---|
| **SEA** | 1.39 | 18 | **−0.71** |
| **TOR** | 1.32 | 25 | **−0.78** |
| **PHI** | 1.57 | 15 | **−0.53** *(borderline)* |
| **LAD** | 1.57 | 21 | **−0.53** *(borderline)* |

### Feasts on Good/Avg arms (overperforms expectation)

| Team | Tier | F5 (n) | Δ vs league |
|---|---|---|---|
| **LAD** | Good | 4.23 (13) | **+1.64** |
| **MIA** | Avg | 4.23 (13) | **+1.59** |
| **AZ** | Good | 3.93 (14) | **+1.34** |
| **LAD** | Avg | 4.00 (13) | **+1.36** |
| **HOU** | Avg | 3.47 (15) | **+0.82** |

### Underperforms vs weak/avg arms (suspicious — bats may be the problem)

| Team | Tier | F5 (n) | Δ vs league |
|---|---|---|---|
| **TB** | Avg | 1.40 | 11 | **−1.24** |
| **SD** | Avg | 1.50 | 12 | **−1.14** |
| **NYM** | Weak | 1.47 | 15 | **−1.30** |
| **KC** | Weak | 1.33 | 6 | −1.43 *(n small)* |

> Three teams (MIN, CWS, WSH) actually **outperform vs aces** by a margin
> the rest of the league can't replicate — this is the most interesting
> finding in the SP-quality cut, since "scoring on aces" is the rarest
> kind of upside. LAD's profile is the opposite: punished by aces, but
> turns merely "good" arms into batting practice.

---

## 4. Opposing Bullpen Quality + Fatigue (late runs, innings 6+)

**League-wide effects:**
- **Bullpen quality** (by season xFIP): late mean — strong pens (xFIP ≤4.00):
  **1.85** (n=970) · avg: 2.02 (n=356) · weak (>4.50): **2.13** (n=316).
  A ~0.28 run gap end-to-end. Real, modest.
- **Bullpen fatigue** (opp_bp_ip_last3d): **no detectable league effect**.
  Low fatigue (≤6 IP) → 2.00, mid → 1.91, high (≥12 IP) → 2.00. The signal
  betters everyone hopes for from fatigue tracking just isn't there at the
  pooled level this year.

### Late-inning feast on weak pens (team-specific deltas vs their own baseline)

| Team | Late vs weak BP (n) | Late vs strong BP (n) | Δ vs base (weak) |
|---|---|---|---|
| **LAD** | 3.56 (9) | 2.05 (39) | +1.30 *(n small for weak)* |
| **PIT** | 3.29 (7) | 1.90 (30) | +1.14 *(n small)* |
| **STL** | 3.18 (11) | 1.83 (36) | **+1.09** |
| **COL** | 2.33 (9) | 1.56 (41) | +0.64 *(n borderline)* |

> The weak-BP signal is real but slow to develop n-wise — most teams have
> only 7–15 games vs weak pens. The teams here represent ~3–5× their own
> late-inning baseline against weak bullpens, which is meaningfully more
> than the league's +0.28 weak-vs-strong gap.

### Curiously cold against weak pens

| Team | Late vs weak (n) | Δ vs base |
|---|---|---|
| **TB** | 1.14 (7) | −1.15 *(n borderline)* |
| **MIL** | 1.42 (12) | **−0.54** |
| **BOS** | 0.67 (3) | −1.03 *(n very small)* |
| **KC** | 1.00 (1) | n=1, ignore |

> Bullpen fatigue did NOT produce notable team signals at this n. Skipping
> the team-by-team table for that bucket — nothing rises above noise.

---

## 5. Series Game Number (derived via gaps-and-islands)

**League-wide effect: gentle fade across a series.**
- G1: **4.56** (n=540)
- G2: **4.35** (n=536)
- G3: **4.18** (n=502)
- G4+: 4.88 (n=64; small)

A ~0.4 run dropoff G1→G3 league-wide. Subtract that effect when judging
team deltas.

### Teams that FADE meaningfully across series (G3 deficit beyond league)

| Team | G3 mean (n) | Team baseline | Team-spec G3 Δ vs base |
|---|---|---|---|
| **WSH** | 4.00 (17) | 5.43 | **−1.43** (vs league −0.20 → team-spec **−1.23**) |
| **PHI** | 3.06 (17) | 4.00 | **−0.94** (team-spec **−0.74**) |
| **STL** | 3.53 (15) | 4.42 | **−0.89** (team-spec **−0.69**) |
| **SF** | 2.94 (17) | 3.67 | −0.73 (team-spec **−0.53** borderline) |

### Teams that BUILD across the series (G3 surge)

| Team | G3 mean (n) | Team baseline | Team-spec G3 Δ |
|---|---|---|---|
| **SD** | 5.00 (16) | 3.96 | **+1.04** vs base, **+1.24** vs league trend |
| **MIN** | 5.18 (17) | 4.62 | +0.56 vs base, **+0.76** vs league trend |
| **MIL** | 5.06 (16) | 4.94 | +0.12 vs base, +0.32 vs league trend |

### Atypical patterns worth flagging

- **MIL G1**: 6.33 (n=18) vs base 4.94 → **+1.39**. Hot series-openers.
- **PIT G2**: 6.22 (n=18) vs base 4.91 → **+1.31**. G1→G2 surge.
- **CIN G2**: 5.28 (n=18) vs base 4.50 → +0.78.
- **WSH G2**: 6.72 (n=18) vs base 5.43 → +1.29. Then crashes to 4.00 in G3.

---

## 6. Carryover from Previous Game's Runs

**League-wide effect: mild positive momentum.** Mean runs the day after:
- Shutdown (prev ≤2): **4.08** (n=542)
- Normal (prev 3–6): **4.51** (n=703)
- Exploded (prev ≥7): **4.61** (n=367)

So at the league level there IS a roughly +0.5 R bounce from explosion
vs after-a-shutdown. Notable team deviations:

### Teams that bounce HARD off a big offensive day (positive momentum)

| Team | After-exploded mean (n) | Team baseline | Δ vs base |
|---|---|---|---|
| **NYY** | 5.80 (15) | 4.96 | **+0.84** |
| **CHC** | 5.95 (19) | 4.64 | **+1.31** |
| **NYM** | 5.20 (10) | 3.82 | **+1.38** *(n borderline)* |
| **HOU** | 5.33 (15) | 4.45 | **+0.88** |
| **LAD** | 5.53 (15) | 5.35 | +0.18 (already high) |
| **ATL** | 5.72 (18) | 5.26 | +0.47 |

### Teams that CRASH after getting shut down (negative momentum)

| Team | After-shutdown mean (n) | Team baseline | Δ vs base |
|---|---|---|---|
| **NYM** | 2.88 (24) | 3.82 | **−0.94** |
| **SF** | 2.86 (22) | 3.67 | **−0.81** |
| **CHC** | 3.41 (17) | 4.64 | **−1.23** |
| **NYY** | 3.92 (13) | 4.96 | **−1.04** |
| **LAA** | 3.59 (27) | 4.13 | −0.54 *(borderline)* |
| **KC** | 3.33 (21) | 3.84 | −0.51 *(borderline)* |

### Teams that REVERSE the league pattern (bounce off shutdown, slow after explosion)

| Team | After-shutdown | After-exploded | Pattern |
|---|---|---|---|
| **MIA** | 4.77 (17, **+0.48**) | 3.71 (14, **−0.58**) | clean inversion |
| **TOR** | 4.60 (20, **+0.53**) | 3.88 (8, −0.20) | shutdown bounce |
| **CIN** | 5.00 (17, +0.50) | 4.86 (14, +0.36) | unaffected/positive both |
| **PIT** | 5.11 (19, +0.20) | 4.75 (16, −0.16) | unaffected |
| **ATL** | 5.57 (14, +0.31) | 5.72 (18, +0.46) | unaffected |
| **DET** | 4.05 (19) | 2.57 (7, **−1.30**) | crashes after explosion |

> **Pattern of interest:** NYM and CHC have the most volatile carryover —
> both swing massive in both directions (CHC: +1.31 after explosion,
> −1.23 after shutdown). NYY shows a similar but less extreme bipolar
> pattern. These look like genuinely "streaky" lineups.

---

## 7. Game ML & Total Context

**League-wide effects (these are mostly the line being right):**

- **Favorite vs underdog (closing_ml):**
  Heavy fav (≤−180): **5.59** · Slight fav (−179..−110): **4.63** ·
  Pickem (−109..+99): **3.94** · Slight dog (+100..+150): **4.15** ·
  Big dog (≥+150): **3.52**.
  Clean monotonic: ~2 runs/game between heavy fav and big dog.
- **Total band:** Low (≤7.5): **4.02** · Mid (8–8.5): **4.20** · High (≥9): **5.23**.
  +1.2 runs from low → high total. The books read scoring environment well.

### Biggest blowout-prone favorites (fav minus dog gap, scored)

| Team | Mean when fav (n) | Mean when dog (n) | Gap |
|---|---|---|---|
| PIT | 5.86 (37) | 2.94 (18) | **+2.92** |
| TB | 5.28 (36) | 3.38 (16) | **+1.90** |
| MIL | 5.35 (40) | 3.58 (12) | **+1.77** |
| KC | 4.52 (33) | 2.82 (22) | **+1.70** |
| NYM | 3.95 (42) | 2.30 (10) | **+1.65** |
| ATL | 5.36 (44) | 3.78 (9) | **+1.59** |

> SEA (3.29 gap) and LAD (no dog sample) have one-sided distributions
> and aren't comparable. ATH inverts (−1.17 gap — scores MORE as dog
> than fav) which is mostly distribution noise on a thin roster.

### Total-band swings (teams' high-total vs low-total scoring)

| Team | High (≥9) mean (n) | Low (≤7.5) mean (n) | Gap |
|---|---|---|---|
| **LAD** | 7.59 (17) | 2.20 (10) | **+5.39** |
| **CHC** | 6.36 (14) | 3.05 (20) | **+3.31** |
| **AZ** | 6.29 (21) | 3.44 (9) | **+2.84** |
| **NYY** | 6.33 (12) | 3.75 (16) | **+2.58** |
| **CLE** | 5.86 (7) | 3.41 (27) | **+2.45** |
| **CWS** | 5.80 (15) | 3.69 (16) | **+2.11** |
| **NYM** | 5.60 (10) | 3.52 (27) | **+2.08** |
| **LAA** | 4.68 (22) | 2.92 (13) | **+1.76** |
| **COL** | 4.67 (30) | 3.00 (10) | **+1.67** |

> **LAD's +5.39 R total-band gap is the largest single number in the
> report.** When the book sees ≥9 in a Dodgers game, the offense delivers
> on average 7.6 runs; in ≤7.5 games, just 2.2. They behave like two
> completely different teams depending on environment.

---

## 8. Home vs Away

**League-wide effect: essentially zero.** Home: 4.40 R (n=821). Away: 4.38 R
(n=821). Pooled home-field advantage = **+0.02 runs** — there is no league
home premium to subtract. As with day/night, every signal below is purely
team-specific.

### Home hitters (significantly stronger at home)

| Team | Home mean (n) | Away mean (n) | Home − Away |
|---|---|---|---|
| **KC** | 4.45 (31) | 3.04 (24) | **+1.41** |
| **NYY** | 5.69 (26) | 4.31 (29) | **+1.38** |
| **PIT** | 5.50 (28) | 4.30 (27) | **+1.20** |
| **TOR** | 4.52 (29) | 3.58 (26) | **+0.94** |
| **BAL** | 4.79 (29) | 4.00 (26) | **+0.79** |
| **MIL** | 5.17 (29) | 4.65 (23) | +0.52 *(borderline)* |
| **TB** | 4.96 (24) | 4.46 (28) | +0.49 *(borderline)* |
| **NYM** | 4.08 (26) | 3.59 (29) | +0.49 *(borderline)* |

### Road warriors (significantly stronger on the road — counter to typical HFA)

| Team | Home mean (n) | Away mean (n) | Home − Away |
|---|---|---|---|
| **ATL** | 4.41 (27) | 6.07 (28) | **−1.66** |
| **LAA** | 3.39 (28) | 4.89 (27) | **−1.50** |
| **LAD** | 4.59 (27) | 6.07 (28) | **−1.48** |
| **BOS** | 3.08 (26) | 4.44 (27) | **−1.37** |
| **TEX** | 3.17 (23) | 4.45 (31) | **−1.28** |
| **STL** | 3.92 (26) | 4.89 (27) | **−0.97** |
| **SD** | 3.61 (31) | 4.44 (23) | **−0.82** |

> **Five road-warrior teams swing >1 run per game in the WRONG direction.**
> ATL/LAD scoring **+1.5 R more on the road than at home** is the headline —
> two of the league's best offenses both inverted. The book sets totals
> assuming the conventional HFA; if it doesn't price these inversions, road
> games for ATL/LAD/LAA/BOS/TEX may be systematically under-totaled.

> **KC's +1.41 home premium** is the largest in MLB. Their road offense
> (3.04 R) is by far the weakest single bucket in the entire report;
> their home offense (4.45) is league-average. This isn't a "good at
> Kauffman" story so much as a "comatose away from Kauffman" one.

> **No detectable league HFA in 2026.** That alone is interesting —
> historically HFA has been ~0.1–0.2 R. If you've been adding a generic
> "home team scores more" bump to model output, drop it for now.

---

## 9. Handedness Switch (Series Game 3 after 2 same-hand starts)

**League-wide effect: zero.** F5 mean on "saw same hand twice, now opposite":
**2.46** (n=277). On "saw same hand twice, now same hand a third time":
**2.48** (n=469). The widely-discussed "lineup adjusts to a hand change"
phenomenon does not exist at the league level in this sample.

That said, individual teams show large per-team swings — but with tiny n
per team (switch is n=7-12 for most). Treat these as anecdotal.

### Apparent good adjusters (large F5 surge on hand switch)

| Team | Switch F5 (n) | Same-third F5 (n) | Diff |
|---|---|---|---|
| **AZ** | 4.38 (8) | 2.28 (18) | **+2.10** *(n small)* |
| **CIN** | 3.86 (7) | 2.36 (22) | +1.50 *(n small)* |
| **COL** | 3.38 (8) | 1.96 (22) | +1.42 *(n small)* |
| **TB** | 3.44 (9) | 2.10 (10) | +1.34 *(n small)* |
| **LAD** | 3.82 (11) | 2.76 (17) | +1.06 *(borderline)* |
| **CLE** | 3.25 (12) | 2.30 (10) | +0.95 *(borderline)* |

### Apparent bad adjusters (F5 dips on hand switch)

| Team | Switch F5 (n) | Same-third F5 (n) | Diff |
|---|---|---|---|
| **CHC** | 0.88 (8) | 2.35 (23) | **−1.47** *(n small)* |
| **WSH** | 2.75 (12) | 4.18 (11) | −1.43 *(borderline)* |
| **BAL** | 1.75 (8) | 3.07 (15) | −1.32 *(n small)* |
| **PIT** | 2.33 (9) | 3.46 (13) | −1.13 *(n borderline)* |
| **KC** | 1.64 (11) | 2.75 (16) | −1.11 *(n borderline)* |

> **Verdict: do not bet on hand-switch adjustment alone.** With n=7–12
> per team this cut is noise. Worth re-examining at midseason 2027 with
> double the sample.

---

## Team Scouting Cards (10 strongest profiles)

### 🟢 LAD — environment-amplified, road monster
- **+5.39 R** in high-total games vs low-total (largest in MLB)
- **−1.48 R** home vs away — **scores ~1.5 R MORE on the road**
- **+1.08 F5** vs LHP (n=11) — borderline but consistent
- **+1.03 R** in day games vs night
- **+1.64 F5** vs "good" SPs (mid-tier arms get destroyed)
- **−0.53 F5** vs aces (struggle against elite arms)
- **Pattern:** Boom-or-bust offense. Aces shut them down; everyone else
  gets demolished, especially in road environments the market already
  projects as scoring-heavy.

### 🟢 AZ — LHP demolisher
- **+2.17 F5** vs LHP — **largest single split in the report**
- **+1.34 F5** vs "good" tier SPs
- **+2.84 R** high vs low total
- Above-average at hand-switch (n small, anecdotal)
- **Pattern:** Lopsided platoon team — if a lefty starts, expect F5 fireworks.

### 🟢 NYY — LHP eaters, momentum-driven, Bronx-bound
- **+1.30 F5** vs LHP
- **+1.38 R** home vs away (one of the largest home premiums in MLB)
- **+2.58 R** high vs low total
- **+0.84 R** after their own offensive explosion
- **−1.04 R** after a shutdown
- **Pattern:** Volatile and platoon-sensitive. Lefty + high total + Bronx = stack.

### 🟢 WSH — night owl, fades in G3
- **−1.73 R** day vs night (largest night premium in MLB)
- **+0.76 F5** vs aces
- **−1.43 R** in series G3 (after starting series hot)
- **Pattern:** Night-only offense that wears down by series end. Avoid them in day games and G3 spots.

### 🟢 MIN — ace-killers and LHP-killers
- **+1.51 F5** vs aces — **largest "feasts on aces" delta**
- **+0.76 F5** vs LHP
- **Pattern:** Hardest-to-shut-down lineup in MLB this year. Doesn't get
  intimidated by top-of-rotation arms.

### 🟡 CWS — feast-on-aces curiosity
- **+1.25 F5** vs aces (3.35 vs league 2.10)
- **+1.46 R** day vs night (toward night)
- **+2.11 R** high vs low total
- **Pattern:** Mediocre overall offense (4.46 R baseline) but punches up
  vs elite starting pitchers. Worth modeling separately.

### 🔴 TOR — anti-LHP, anti-ace, road-fade
- **−1.05 F5** vs LHP
- **−0.78 F5** vs aces
- **+0.94 R** home vs away — strong Rogers Centre effect
- **−0.39 R** day vs night
- Sub-2 F5 baseline (1.95)
- **Pattern:** Two ways to shut them down — a lefty or a top-tier RHP.
  Toronto-only offense; on the road they drop to 3.58 R.

### 🔴 SF — slow-developing offense
- **−0.62 F5** vs LHP (borderline)
- **−0.81 R** after shutdown (largest negative carryover signal)
- **−0.53 G3 fade** vs league
- 3.67 R baseline (lowest non-AL West)
- **Pattern:** Slumps stack. A bad game predicts another.

### 🔴 NYM — carryover-driven, night-only
- **+1.38 R** after explosion
- **−0.94 R** after shutdown — bipolar carryover
- **−1.12 R** day vs night
- **+1.65 R** gap when fav vs dog
- **Pattern:** Streaky as anything in baseball. Plays to environment
  hard — bet the trend, not the mean.

### 🟡 CHC — extreme streak team
- **+1.31 R** after explosion
- **−1.23 R** after shutdown — **largest bipolar carryover in MLB**
- **−0.78 R** day vs night
- **+3.31 R** high vs low total
- **Pattern:** Day-to-day momentum dominates. Last night's box score is
  the best prior on tonight.

---

## Caveats (read these before staking)

1. **One season.** All findings descriptive of 2026 only. A team's ~55-game
   sample is not predictive — Bayes prior should pull every split substantially
   toward the league mean.

2. **Small split n per team.** "Vs LHP" is ~10–18 games, "switch game 3 after
   same-hand streak" is ~7–12. With n that small, a 1-run team-level delta has
   a ~95% CI of roughly ±0.8 runs at best.

3. **Closing line missing on ~28 early-season games.** Cut 7 (ML/total)
   excludes those — n is slightly smaller than the team total.

4. **`opp_sp_hand` null on ~124 opener / TBD-starter games.** Cut 2 and
   Cut 8 drop those entirely. The "switch" and "same-third" scenarios
   require a 3-game window of confirmed hands.

5. **`game_number` in `mlb_game_log` is the team's SEASON game number,
   not the series game number.** Cut 5 derived series games via
   gaps-and-islands (same opponent within 3 days = same series). Doubleheaders
   that span a day boundary or rain-delayed makeups can break the heuristic
   slightly; we accept that noise.

6. **Day/night cutoff at 17:00 ET** is rough. A 4:00 PM game in Boston is
   "day" by this definition but plays in shadowy conditions; a 6:00 PM
   game in Coors plays under high sun. The granular time-bucket analysis
   was not pursued — only day vs night.

7. **`ATH` (Athletics) has 55 games; `Ath` has 6 stray rows from a casing
   collision in the data load.** The `Ath` rows are excluded throughout.

8. **No multiplicity correction.** With 30 teams × 9 cuts × multiple
   sub-buckets, we're running roughly 550 implicit comparisons. Some
   "notable" deltas at the 0.6-run / n=12 bar will be false positives by
   chance alone. The Team Scouting Cards prioritize teams with **multiple
   converging signals**, which is meaningfully more robust than any single
   delta.

9. **Descriptive, not predictive.** This report says what HAS happened.
   It does NOT establish causality, nor that these patterns will persist.
   Anyone building a model from these findings should regularize hard.

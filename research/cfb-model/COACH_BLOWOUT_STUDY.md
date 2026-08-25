# Coach Blowout-Management Study — how CFB coaches handle big leads

**2026-08-25.** Built from a fresh raw extract: 2021-2025 regular seasons, 768,620 plays /
103,776 drives, **garbage time deliberately included** — the study *is* garbage time, so the
model pipeline's gt-filtered features were unusable here. Code: `coach_blowout/`
(`fetch_pbp.py` → `build_coach_blowout.py` → `betting_check.py`), outputs in
`coach_blowout/out/`. Raw pbp cached at `data/cfbd/plays_/drives_{2021..2025}.parquet`
(gitignored; rerunnable).

## Construction

Every state is defined at **drive start** from the drive's own start scores — the score when
the coach sends the offense out is the cleanest read of the posture he chose.

- **BIG** = drive starts with a lead ≥ 21 in the 2nd half. **NEUTRAL** = |lead| ≤ 7, Q1-Q3.
- End-of-half/game kneel drives excluded (universal behavior, not discretionary).
- Every metric is a delta vs the **coach's own neutral baseline**, so fast teams aren't
  "aggressive" by construction and option teams aren't "conservative":
  - `tempo_delta` — sec/play on BIG drives minus own neutral sec/play (+ = slows down)
  - `pass_delta` — early-down pass rate up big minus own neutral (2-minute situations excluded)
  - `starter_share_q4` — share of 4Q dropbacks up 21+ thrown by that game's starting QB
    (starter = most 1H dropbacks; QB parsed from playText; masked under 10 dropbacks)
  - `pts_drive_big` — points per drive on BIG drives (drive end score − start score)
  - `go4_rate` — 4th-and-≤3 go rate while up 14+ in 2H
  - `expansion_med` — final margin minus the margin when the team **first reached +21**
  - **`hammer`** — composite z-score of the five core metrics (+ = keeps hammering,
    − = calls off the dogs)
- Coach attribution: majority coach per team-season (`coach_seasons.parquet`).
  Qualification: ≥ 25 BIG drives pooled (97 coaches), ≥ 10 for the early-season cut (86).
- Cupcake = FCS opponent or pregame Elo edge ≥ 250. **No CFBD lines anywhere** — the betting
  section uses `odds_game_frame.parquet` (Odds API closes) only.

## League baseline (what "normal" looks like up 21+ in the 2H)

| state | drives | sec/play | pts/drive | early-down pass rate |
|---|---|---|---|---|
| neutral (±7, Q1-3) | 44,836 | 26.7 | 2.23 | 44.4% |
| up 21+ in 2H | 6,366 | 29.5 | 2.79 | 32.2% |

The average coach slows ~3 sec/play and cuts pass rate 12 points. The metrics measure who
deviates from that norm, in which direction.

## The hammers (top of 97, full sample)

| coach | 2026 school | hammer | n BIG | tempo Δ | pass Δ | starter 4Q | pts/drive | expansion |
|---|---|---|---|---|---|---|---|---|
| Jedd Fisch | Washington | +1.06 | 39 | +2.2 | −0.04 | 66% | 3.74 | +10.0 |
| Curt Cignetti | Indiana | +1.02 | 100 | +1.9 | −0.16 | 58% | 4.16 | +14.0 |
| Jim Mora | Colorado State | +0.96 | 33 | **−1.4** | 0.00 | 21% | 3.30 | +13.5 |
| Gus Malzahn | — | +0.84 | 68 | +0.2 | −0.05 | 43% | 3.37 | +11.0 |
| Mack Brown | retired | +0.84 | 33 | +0.6 | −0.08 | 74% | 3.03 | +9.5 |
| Lane Kiffin | LSU | +0.83 | 86 | +1.3 | −0.01 | 41% | 3.22 | +12.0 |
| Clay Helton | Georgia Southern | +0.79 | 26 | +1.0 | +0.03 | 69% | 2.65 | +7.0 |
| Greg Schiano | Rutgers | +0.76 | 41 | +0.5 | −0.17 | 51% | 4.02 | +10.0 |
| Mark Stoops | — | +0.72 | 46 | +1.0 | −0.01 | 50% | 3.28 | +7.0 |
| Mario Cristobal | Miami | +0.65 | 73 | +1.4 | −0.09 | 36% | 3.73 | +10.0 |

Cignetti is the archetype: 100 big-lead drives (most in the sample), still scoring 4.16
pts/drive, 75% go rate on 4th-and-short, median +14 more points after reaching +21.

## The mercy tier (bottom of 97)

| coach | 2026 school | hammer | n BIG | tempo Δ | pass Δ | starter 4Q | pts/drive | expansion |
|---|---|---|---|---|---|---|---|---|
| Chuck Martin | Miami (OH) | −1.67 | 34 | **+8.5** | **−0.35** | — | 2.82 | +1.5 |
| Tim Albin | Charlotte | −1.11 | 38 | +5.5 | −0.17 | 43% | 1.71 | 0.0 |
| Rick Stockstill | — | −1.07 | 36 | +10.2 | −0.27 | 67% | 1.86 | +7.0 |
| Andy Avalos | — | −1.06 | 40 | +5.8 | −0.19 | 23% | 2.17 | +3.0 |
| Jeff Traylor | UTSA | −1.06 | 79 | +6.1 | −0.15 | 24% | 2.30 | 0.0 |
| Sam Pittman | — | −0.88 | 33 | +7.0 | −0.13 | 37% | 2.09 | +3.0 |
| Kalani Sitake | BYU | −0.80 | 37 | +6.0 | −0.24 | 76% | 1.78 | +3.0 |
| Sonny Dykes | TCU | −0.74 | 61 | +6.4 | −0.17 | 37% | 2.72 | +2.0 |
| Kirk Ferentz | Iowa | −0.69 | 52 | +3.1 | −0.11 | 48% | 1.69 | **0.0** |
| Mike Elko | Texas A&M | −0.65 | 53 | +3.3 | −0.08 | 18% | 2.47 | 0.0 |

Ferentz up 21+ is the purest "get it over with": 1.69 pts/drive and a **median expansion of
zero** — the score when Iowa reaches +21 is the score you should expect at the final gun.
Traylor and Elko pull the starter fastest (24%/18% of 4Q dropbacks).

Household names cluster mid-pack — Day +0.19 (34th), Swinney +0.15, Kirby +0.05 (49th),
Sarkisian +0.05, Freeman +0.31, Heupel +0.22. The tails are where coach identity lives.

## Early season vs cupcakes (weeks 1-3, the requested focus)

86 coaches with ≥ 10 big drives. The behavior is *louder* early — median expansions of
+21 to +35 among the pushers:

- **Pushers**: Cignetti (+35 median expansion — up 21 on a cupcake, wins by ~56), Malzahn
  +26.5, Lanning +28.5 (Oregon), Rhule +21, Kiffin (48 early big drives, +3.4 tempo but keeps
  throwing, +25), Neal Brown +25.5, Narduzzi (**speeds up 5.2 sec/play** up big early).
- **Shut-it-down**: Whittingham (−0.87, now Michigan), Tony Elliott (−1.22, 1.30 pts/drive),
  Dickert, Chip Kelly (−0.39 pass delta — total run-out), Shane Beamer, Sean Lewis
  (+17 sec/play early — full walk-it-off).
- Starter handling is its own axis: Narduzzi/Neal Brown/Will Hall/Beamer pull the QB almost
  immediately (0% starter share) even while some keep scoring with backups; Mack Brown/Helton
  leave the starter in (70-78%).

## Is it a stable trait?

Season-vs-rest correlation of per-season hammer: **+0.22** (57 coaches with 3+ seasons,
n=211 coach-seasons). Real but noisy at one-season resolution — use pooled multi-year
estimates, refresh annually, and treat single-season readings as weak evidence.

## Does it bet? (Odds-API closes, leave-season-out tiers)

Tiers computed excluding the season being graded (no self-grading). Favorites ≥ 14 by the
close:

| cut | hammer tier | mid | mercy tier |
|---|---|---|---|
| weeks 1-3 | **59.0% cover (n=61)** | 50.8% (120) | **46.8% (n=62)** |
| all season | 55.2% (212) | — | 47.0% (217) |

Per-season honesty (wks 1-3): hammer = 50/62/73/54/50 — ≥50% in 5/5, modest but consistent.
Mercy = 73/64/37/33/33 — **regime-flipped**: it covered in 2021-22 and only became fade-able
2023+. Verdict: `coach_hammer_fav` (back hammer-tier favs ≥14, wks 1-3) is a **TRACK-tier
candidate** for 2026; the mercy fade is unstable and stays research-only. Neither ships as
an active flag without a 2026 paper season.

## Caveats

- Coach attribution is the majority coach per team-season; midseason firings blur a few rows.
- `pts_drive_big` partially reflects roster quality, not just intent (it's 1 of 5 components).
- QB starter parsing from playText is ~string matching; masked below 10 dropbacks.
- 2025 week 16 data is thin (championship-week slate). 2020 excluded (COVID).
- Behavior can change with a job change — Kiffin-at-LSU inherits Kiffin-at-Ole-Miss's index;
  the 2026 refresh should weight recent seasons.

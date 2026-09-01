# VSiN 2026 CFB Betting Guide — digest, validations, and adopted refinements

> Digested 2026-08-03 from `2026-VSiN-CFB-Betting-Guide.pdf` (348 pp; methodology core = pp. 21–47;
> team previews are narrative). What we tested against OUR data is marked ✅/❌; everything tested was
> graded at the close with `assert_ats_sane` (favs 49.1% — sane).

## 1. ✅ ADOPTED — conference-game dilution of early-season roster edges (VSiN claim REPRODUCED)
Makinen's Stability System applies **non-conference, weeks 0–3 only**; he reports conference games
dilute stability edges to ~49.5% ATS. **Tested on our validated S-CFB2 (`ret_prod_edge`, back the
higher returning-production team, ret_diff ≥ +0.20, wk1-3):**
| split | n | hit | ROI | seasons |
|---|---|---|---|---|
| ALL (previous live rule) | 687 | 54.4% | +3.9 | 9/9 |
| **NON-CONFERENCE only** | 599 | **54.9%** | **+4.9** | 8/9 |
| Conference games only | 88 | 51.1% | −2.4 | 6/9 |
| Non-conf + \|spread\|<30 (his cap) | 522 | 54.8% | +4.6 | **9/9** |

**WIRED 2026-08-03:** `ret_prod_edge` now fires in non-conference games only
(`cfb_early_roster_signals.py` takes an `is_conf` flag from `gen_cfb_slate_flags.py`). The spread<30
cap not wired (n cost > consistency gain; revisit if 2026 adds data). S-CFB3 (`portal_talent_influx`)
left unchanged — split not yet tested for it (small n).

## 2. ❌ NOT REPRODUCED — new-HC first-4-weeks fade
VSiN: new HCs 110-132 ATS (45.4%) wk0-3 vs returning HCs since 2021. Our test: fade new-HC team =
51.2% (n=168, 4/8 seasons). **Caveat: our coach table only covers school-to-school HC moves** (no
first-time HCs/promotions), so this is a partial test. To fully test we'd need a complete
first-year-at-school HC table (CFBD /coaches, all hires). Parked — not adopted, not killed.

## 3. Reference data worth knowing exists (pp. 21, 42–44, 47)
- **Team-specific HFA tiers (Adam Burke)**: 6 buckets, 3.5 → 1.0 pts, from 3-yr home SU+ATS win%
  (70%+ → 3.5; 65–70 → 3.0; 60–65 → 2.5; 40–60 → 2.0 default; 35.01–40 → 1.5; ≤35 → 1.0). Full
  138-team assignment on p. 21. **Tuning idea (untested)**: our early-week priors use uniform HFA; a
  team-tiered HFA is buildable from our own data with the same construction. Candidate, not adopted.
- **2026 Stability Scores, all 138 teams (pp. 42–44)**: HC(4) + OC(3) + DC(3) + QB(4) + returning-
  starters(0–5) = 0–19. 2026 notables — ZERO (most unstable): UConn, Iowa State, JMU, Missouri State,
  NIU, North Texas, Sacramento State, USF, Southern Miss, Toledo. 16+ (most stable): Houston 18,
  Notre Dame 18, ASU 18, Georgia 17, Texas 17, Ohio State 17, Oklahoma 17, Minnesota 17, Boise 16,
  NC State 16, New Mexico 16, FAU 16, Delaware 16, UL-Lafayette 16. A transfer QB = NEW QB
  regardless of experience (matches our S-CFB2 continuity framing).
- **Makinen 2026 power ratings (p. 47, all 138 teams)**: top — Ohio State 71, Oregon 68.5, ND 68.5,
  Georgia 67.5, Indiana 66, Texas 66. Useful as an external cross-check against our
  `cfb_early_week` priors (a big disagreement = investigate); NOT a model input (Odds-API single-
  source rule covers lines; this is ratings context only).
- **His transitional angles** (quantified, used throughout win-total picks — overlapping our
  S-CFB2/S-CFB3 evidence base): +4-or-more returning starters over prior yr → +3.2 wins avg, ATS
  +6.7% (141 teams/5yrs, only 40 declined); ≤4-win teams w/ −0.8 TO ratio → only 2/21 regressed
  ("nowhere to go but up"); 9+ off starters incl QB back from sub-50% team → +2.7 wins; lost 8+
  starters → −3.3 wins; won 60%+ w/ ≤4 off starters + new QB → −3.7 wins/−11.7% ATS; 4+ close wins
  (≤7) + 14- starters + new QB → regression (11/73 improved); 4+ blowout losses then new HC → −2.8
  wins, 44.2% ATS.

## 4. Narrative context captured (no action)
Consensus predictions concentrate on Notre Dame/Ohio State/Oregon/Georgia/Texas top tier; Texas Tech
near-unanimous Big 12 pick (soft schedule cited); UTSA popular AAC pick; books report public heavy
on ND/Oregon (liabilities) — futures-market color only. Coaching-carousel notes (35 new HCs, 25.4%)
align with our coach scheme-transfer work; VSiN's "DC changes hurt more than OC changes" (45.5% vs
49.9% ATS wk0-3) is interesting and UNTESTED by us — would need a coordinator table (PFR/manual;
same gap as the NFL OC follow-up).

## STILL OPEN
- Complete new-HC (first-year-at-school) table → properly test the HC/OC/DC-change fades (§2, DC
  claim especially).
- Team-tiered HFA for the early-week priors (§3) — buildable from our own data; test before adopting.
- S-CFB3 conference split once more seasons accumulate.

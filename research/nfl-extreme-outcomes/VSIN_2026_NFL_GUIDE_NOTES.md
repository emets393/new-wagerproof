# VSiN 2026 NFL Betting Guide — digest + validation

Source: `~/Downloads/2026-VSiN-NFL-Betting-Guide-low.pdf` (108 pp). Digested 2026-08-03,
same structure as the CFB version (`research/cfb-model/VSIN_2026_GUIDE_NOTES.md`):
**VALIDATED** (reproduced on our own data), **REFERENCE** (useful context, not testable
or not a bet), **REJECTED** (tested and failed, or unusable).

Every ATS test below ran through `sign_conventions.assert_ats_sane` (favorites covered
48.4% on n=3,883 — sane). nflverse convention: `spread_line > 0` = home favored,
`ats_h = result − spread_line`.

---

## VALIDATED — reproduced independently on 2002-2025 nflverse results

### 1. Makinen team-improvement/decline systems (guide pp. 30-31)

Tested on our own team-season frame (wins, PPG, playoff berth from `games_enriched.parquet`;
Δ measured in next-season win% scaled to 17 games). Three of his quantified systems
reproduce almost exactly:

| System | VSiN claim | Our replication (2002-2025) | 2026 qualifiers |
|---|---|---|---|
| Won 10+ but scored <23 PPG → **DECLINE** | 13/57 improved, avg −4.4 wins | **23% improved, avg −2.5 wins** (n=52) | **LAC, PHI** (exact match w/ guide) |
| Won <42% despite 22+ PPG → **IMPROVE** | 65.4% improved, avg +3.65 | **77% improved, avg +2.35** (n=30) | Ours: **CIN, DAL, NYG** (guide says CLE/KC/NO — cutoff or data-source difference; trust ours) |
| 27+ PPG but missed playoffs → **IMPROVE** | 59.5% improved | **60% improved, avg +1.31** (n=15) | **DAL, DET, IND** (exact match w/ guide) |

**Use**: season win-total / futures context and a prior for early-season power-rating
skepticism (e.g., the market still prices LAC/PHI off last year's win total; these systems
say regress). NOT per-game signals — do not wire into flags. Note DAL appears on two
improve lists.

### 2. TO-differential fade system — 2026 list verified, historical rate not

"Positive TO diff + 10+ ATS wins → decline" (VSiN: 70/104 declined, −13% outright and ATS).
Our PBP cache only has turnover columns 2023-25, so the 20-year rate is **not independently
validated** — but the 2026 qualifier list computed from our 2025 data (TO diff from PBP,
ATS wins from nflverse at close) confirms: **JAX (+13), LAR, NE, PHI** qualify (guide adds
CHI — TO diff +22 best in league but under 10 ATS wins on our lines; we add SEA). The
mechanism (TO regression) is the same one behind our validated MLB/CFB luck work, so the
direction is credible.

The mirror-improve system ("neg TO diff + outscored by 10+", VSiN: LV/NYJ/TEN) is
**under-specified** — our literal read yields 12 qualifying teams, so their extra criteria
are unknown. Reference only. 2025 TO-diff extremes for context: NYJ −21, WAS −11, DAL −11,
TEN −9 (due up); CHI +22, HOU +15, JAX +13, PIT +12 (due down).

### 3. Shoemaker Week-1 underdogs — directionally real, weaker than claimed, NOT a bet

Claim: since 2019 Week-1 dogs 56.8% ATS, road dogs 59.0%. Our replication at the close:

| Window | Wk1 dogs | Wk1 ROAD dogs | Wks 2+ dogs (control) |
|---|---|---|---|
| since 2019 | 54.1% (n=111) | 55.9% (n=68) | 51.7% |
| since 2002 | 52.3% (n=375) | 52.5% (n=240) | 50.8% |

Per-season since 2019: 60 / 44 / 75 / 50 / 63 / **44 / 44**. The lean exists long-run but
the last two seasons went the other way and n is tiny. **Context lean only, no flag.**
Consistent with our own week-1 work: the early_season_blend fix moved our cover probs off
the blanket-dog side precisely because the market already prices most of this in.

---

## REFERENCE — vaulted for context, not wired

- **Makinen power ratings + team-specific HFA** (p. 35, 37): per-team SM PR (LAR/SEA 29.5
  top, ARI 17.5 bottom) and **HM FLD / RD FLD values per team** (DET 3.2 home, BUF 2.8,
  NYJ 1.4…). Useful as an external cross-check on our early-week priors and a candidate
  input for a team-tiered HFA experiment (same idea flagged in the CFB notes with Burke's
  tiers). ⛔ Never a line source — Odds API rule.
- **His top win-total leans**: OVER Miami +1.1, Indy +0.7; UNDER Tampa Bay −2.4,
  Chargers −1.4, Dallas −1.0. Note his Dallas UNDER conflicts with two improve-list hits
  above — his ratings vs his own systems disagree; interesting to track.
- **Win-total variance** (p. 26): 13/32 teams in 2025 finished 3.5+ wins off their total.
  League is high-variance → alt/ladder win totals structurally interesting.
- **Kickoff-rule scoring drift** (p. 22): league avg O/U 43.1 (2023) → 44.6 (2024) → 44.8
  (2025), touchback to the 35 in 2025; now stabilized. Matters only if totals models train
  across the 2023/24 boundary — our recency half-life law already handles regime drift.
- **Splits methodology** (p. 23): VSiN calls a side "public" at 65/35 bets% on DK; "sharp"
  = bets% vs dollars% discrepancy ≥10pts at Circa. Aligns with how our public-side signals
  are framed.
- **Rookie market baselines** (pp. 32-33): OROY went to a top-10 pick 8 of last 10 years;
  a rookie WR has hit 1,000 yards 5 straight years. Consensus rookie projections table
  (Mendoza LV 3,088 pass yds; Love ARI 1,075 rush; Tate TEN 946 rec…) — useful priors for
  early-season rookie prop lines, where our props program has no player history (see
  NFL_PROPS_VERDICT.md early-week rules).
- **Predictions grid** (pp. 4-9): Bills/Rams heavy staff consensus; Rams most common SB
  pick. Sentiment only.

## REJECTED / NOT WIRED

- **Week-1 dog auto-flag** — see above: 44% each of the last two seasons, n too small,
  market adjusting. Keep as narrative context in early-week rendering, nothing more.
- **TO systems as per-game signals** — they are season-level angles; no game-level trigger
  exists, and the historical rates aren't independently checkable from our cache.
- **New-HC fade** — the CFB guide's version already failed replication on our partial
  coach table (51.2% vs their 45.4%); the NFL guide offers no cleaner spec. Parked until
  a complete first-year-HC table exists (see FOOTBALL_PROFILES.md).

## How this connects to our stack

1. **Early-season blend** (`early_season_blend.py`): the improve/decline lists are
   exactly the teams where prior-year carryover is most wrong-signed. If a future
   iteration wants a team-level adjustment, the two validated Makinen systems are the
   candidates — but backtest first, as continuity shrinkage may already capture it.
2. **Team-tiered HFA** — now have per-team HFA values for BOTH leagues (Makinen NFL,
   Burke CFB tiers). One shared experiment when we next touch the priors.
3. **Rookie props** — VSiN consensus projections are a usable prior for weeks 1-4 rookie
   lines; our props models exclude rookies (no history) so this is additive, not overlap.

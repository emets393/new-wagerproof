# Brief #4 — Playoff / Division-Race "Stakes" as a Betting Signal

**Mission:** build each team's playoff/division race state every week, quantify how much each game matters
(leverage), and test whether high-stakes (must-win, desperation) and no-stakes (clinched/eliminated) spots
beat the market on ATS / ML / O-U.

**Verdict: the market prices stakes. No validated edge.** The one consistent directional signal is
*contrarian and weak* — the **more-desperate / higher-leverage team systematically covers slightly LESS**
(the public over-bets the must-win narrative) — but it's small, not season-robust, and likely just
"fade the public favorite." Orthogonality confirms it: the closing line gives must-win teams essentially
what their power rating says (no motivation premium), so there's nothing to arbitrage.

---

## 1. Engine — built and validated (the backbone)

**Elo win-prob engine** (2002–2025, HFA + MOV multiplier + season carryover): calibration is excellent —
predicted vs actual home-win match across every decile (p~0.65→0.64, p~0.84→0.85); home SU 0.562, pick
accuracy 0.645 (both as expected).

**Era-correct playoff reconstruction** (6 wild-card teams pre-2020, 7 from 2020; tiebreakers via composite
record » division » conference » rating key): **288/300 = 96.0%** of real playoff teams reconstructed;
the 12 misses are all single-team swaps in deep 9-7 common-games/SOV tiebreakers (e.g. 2011 CIN/DEN).

**Monte Carlo leverage** (≥4,000 sims per season-week, frozen Elo, era-correct field): validated —
- only **1** team ever flagged "eliminated" in its last week that actually made the playoffs;
- final-week playoff% separates cleanly (**0.89 made vs 0.07 missed**);
- |leverage| and must-win%/eliminated%/clinched% all rise correctly into late season, and the engine
  **catches early high-leverage** (must-win spots appear by Week 10). 10,166 team-week states produced.

Leverage = P(make playoffs | win this game) − P(make playoffs | lose). ATS cover validated 99.8% vs the
Brief #1 master.

---

## 2. Stakes betting tests (2002–2025, per-season + per-era)

| Spot | Market | n | Hit% | ROI | Seasons beat vig | Verdict |
|---|---|---|---|---|---|---|
| **Must-win team** | ATS | 228 | **46.9%** | −10.4% | 10/22 | ❌ covers *less* (over-bet) |
| Must-win team | UNDER | 233 | 54.5% | +4.1% | 11/22 | 🟡 weak under lean |
| **Eliminated team** | ATS | 2,654 | **50.2%** | −4.1% | 7/24 | ❌ coin flip — not fadeable |
| Eliminated team | OVER | 2,678 | 49.2% | −6.0% | 8/24 | ❌ null |
| **No-stakes** (elim/clinched) | ATS | 3,792 | 50.1% | −4.3% | 4/24 | ❌ coin flip |
| **No-stakes → UNDER** | O/U | 3,827 | 50.6% | −3.4% | 10/24 | ❌ null (even wk≥16: 50.6%) |
| High-leverage (top quartile) | ATS | 2,471 | 49.6% | −5.4% | 5/24 | ❌ null |
| **Higher-leverage side** | ATS | 2,070 | **48.4%** | −7.5% | 6/24 | ❌ covers *less* (fade signal) |
| Lower-leverage side | ATS | 2,070 | 51.5% | −1.6% | 9/24 | 🟡 weak contrarian lean |
| **Must-win vs no-stakes opp** | ATS | 106 | **44.3%** | −15.3% | 4/10 | ❌ desperate team over-priced |
| Must-win vs no-stakes opp | ML (SU) | 109 | 54.1% | +3.3% | 6/11 | 🟡 wins SU but ~priced |
| Hi-lev vs no-stakes opp | ATS | 1,085 | 48.8% | −6.7% | 10/24 | ❌ null (2021–25 54% only) |
| **Division-race showdown** | UNDER | 888 | 52.0% | −0.7% | 11/24 | ❌ ~coin flip |
| Division showdown favorite | ATS | 436 | 48.4% | −7.6% | 11/24 | ❌ favorite doesn't cover |
| Early hi-lev (wk8–13) | ATS | 1,085 | 50.2% | −4.1% | 10/24 | ❌ null |
| Late hi-lev (wk16–18) | ATS | 363 | **45.2%** | −13.8% | 4/24 | ❌ over-bet hardest |

### Orthogonality (2018–25): the line already embeds stakes
For home teams, `market spread − power-rating expectation`:
- **must-win**: −0.13 pts (basically PR, no premium) · **no-stakes**: −0.17 · **baseline**: −0.07.
The market does **not** distort the line for stakes beyond what power ratings already imply, and cover
rates sit at ~50%. There is no systematic mispricing of motivation to exploit.

---

## 3. What it all means

**The intuition is wrong in the exploitable direction.** "Desperate teams try harder → back them" fails:
must-win teams cover **46.9%**, the higher-leverage side covers **48.4%**, and the supposedly-juiciest spot
(desperate vs a dead team) covers just **44.3%**. The market — and the betting public — *already* inflate
desperate teams; you'd be buying a team everyone else is buying. The only positive ML reading (desperate
team beats a dead team SU ~54%) is priced into the moneyline.

**The lone directional thread is contrarian and weak:** across five independent cuts the desperate /
higher-stakes side under-covers, so *fading* it (or backing the team with less to play for as a dog)
leans ~51–56%. But it's small, fails the per-season-consistency bar (≈half the seasons), is strongest only
on small-n extreme cuts (mismatch n=106), and is most likely just the well-known "fade the public side"
effect wearing a stakes costume — not a stakes-specific edge.

**Eliminated/no-stakes "let-down under" is a myth once measured properly.** Defining no-stakes by *leverage*
(not just Week 18), totals run 50.6% — a coin flip, even at wk≥16. The earlier weak under leans live in
specific *slots* (primetime, high wind), not in "the team has nothing to play for."

**Era note:** no spot is stable across eras. The 7-team/17-game change (2020/2021) keeps more teams alive
later (eliminated% lower, must-win pushed to wk17–18), but didn't create a tradeable stakes edge in any era;
the recent (2021–25) "hi-lev vs dead" 54% is one noisy slice, not a trend.

---

## 4. 2026 STAKES WATCHLIST (honest)

- ⚪ **No bettable stakes edge.** Don't bet "must-win" teams (they're over-valued ATS), don't auto-fade
  eliminated teams (they cover ~50%), don't blanket-under "no-stakes" games (≈coin flip).
- 🟡 **WATCH (contrarian, paper-trade only):** *fade* the desperate / higher-leverage favorite — i.e., take
  the points with the team that has less to play for — especially desperate-team-laid-as-big-favorite-vs-
  a-dead-team. Leans ~52–56% but unproven; track it, and recognize it may just be public-fade.
- 🟡 **WATCH:** must-win team → UNDER (54.5%) and division showdown → UNDER (52%) — mild, mechanism-plausible
  (tight, conservative games), not consistent enough to bet.
- ✅ Keep using the **leverage engine as a *context/abstain* tool**, not a bet trigger: it correctly flags
  rest/clinched spots (where the line is sharp and you should defer to the slot-specific signals — wind,
  primetime — from the totals work), and it quantifies *which* late games are real races.

**Bottom line:** stakes is a spot intuition says should matter, and it *does* matter on the field — but the
market has fully absorbed it. This is a clean, well-powered "no edge," with the only residual being a weak
contrarian fade of over-hyped desperation.

---

## 5. Reproducibility
`b4_build.py` (Elo + division map + standings + validation → games_enriched.parquet, elo_entering.parquet),
`b4_sim.py` (vectorized Monte Carlo leverage + clinch/elim flags → b4_stakes.parquet), `b4_test.py`
(stakes spots vs ATS/ML/OU + per-era + orthogonality). Outputs in `out/b4_*.txt`. Built on Briefs #1–3
data + crosswalk + guardrails.

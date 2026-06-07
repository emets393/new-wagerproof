# CFB Betting Strategy — how to actually use the models + signals

The operating system for turning everything in `LOCKED_MODELS.md` into weekly bets. Read this first.

## Two products — never confuse them
1. **The models = a number for every game (the website product).** Totals + sides models predict every
   game. ~50% at the close standalone, but **+CLV** — that's the display ("our number vs Vegas"), NOT a
   bet-everything signal. The models' second job: feed specific spots (model×soft-book stack, team-total models).
2. **The spots = the bet layer.** You only BET when a pre-validated spot fires.

## The core discipline (answers "which model do I use per game?")
- **Do NOT run all models and pick the best-looking number per game.** That's per-game cherry-picking and it
  destroys the edge. Each spot is a FIXED, pre-validated rule. A game gets a bet only when a spot triggers.
- **Independent edges STACK.** The biggest wins come when a *fundamentals* signal and a *market* signal agree
  (model×soft-book = 72%). Same-flavor signals do NOT stack (two "overvalued" signals overlap — see G5-fade x
  soft-gap = no synergy). Stack across independent dimensions, not within one.
- **Edges live in soft/unwatched spots** (G5 markets, cross-book gaps, form/SOS mean-reversion). Watched
  fundamentals (pace, identity matchups, bounce-back narratives) are PRICED. If ESPN would discuss it, assume priced.
- **Totals are one-directional-ish:** books shade totals UP (public over-bias) -> UNDER edges are bigger;
  OVER edges exist but are weaker and need the UNANCHORED model.

## Weekly process
1. Pull as-of CFBD stats + odds from ALL books (sharp: williamhill_us, twinspires, draftkings; soft: bovada,
   mybookieag). Ensure in-season completed games have results in model_games (as-of features need them).
2. `python3 cfb_forecast.py --season <yr> --week <wk>` -> per-game numbers + spot flags + team-total CSV.
3. Rank fired spots by conviction tier (below).
4. Apply vetoes (reversal-veto on STACK; soft-book disagreement = pass).
5. Stake by tier. Execute on the right book. Log the bet + the closing line (for CLV).

## Conviction tiers (stake bigger up top)
**TIER 1 — premium (62-74%, full unit)**
- STACK: model lean + soft-book gap agree, |gap|>=1  (72%, 2025 78%)
- Padded road team (good rating, weak SOS) WHEN line still trusts the rating (resid<=-1) -> bet HOME (62-74%)
- G5 top-2 conf team fading after loss to hi-PR opp, SETTLED line (|gap|<.5) -> fade (65%)
- Soft-book gap>=1.0 -> bet sharp side at soft number (64%)

**TIER 2 — strong (56-60%, 3/4 unit)**
- Soft-book gap>=0.5 (57%) ; STACK gap.5-1 (55%)
- Team-total UNDER: anchored model edge<=-3 (54-56%) ; Team-total OVER: unanchored edge>=+6 (54%)
- Form over-hot (both teams season over-rate>=.60) & total<=58 -> UNDER (58%)
- Lay favorite -6.5 (57%) ; Conference: AAC total 52-59 OVER (57%), SunBelt 59-66 UNDER (thin)
- Ranked-vs-ranked & home FAVORED -> bet HOME (60%, HFA underpriced in marquee games; confound-clean)
- PREMIUM model side spots: |edge|>=8 P5 lay-fav line<21 (~63%)

**TIER 3 — lean (53-56%, 1/2 unit)**
- Game-total over: unanchored model edge>=+6 (~55%), sharper in G5 (edge>=8 & both-G5 & total<54 ~56%)
- Fade high total >=60 -> UNDER (55%) ; Conf SunBelt fade home-fav / BigTen away-fav cover (55-58%)
- Take small dog +2.5/3/3.5 (54%) ; model high-edge dog/away spots
- Ranked-vs-ranked & home DOG -> bet HOME (52.6%, weaker tail of the RvR HFA edge)
- Fade low total <=50 -> OVER (weak ~52.5%)

## Conflict / veto rules
- **Reversal veto:** if a late spread reversal contradicts the model, suppress the STACK bet (model drops to 40%).
- **Soft-book disagreement:** when the model and soft-book gap disagree, the model side is sub-50 -> PASS.
- **Don't fade into a moving line:** G5-fade is skipped when the soft book's sharp side is already on the fade side.
- **Team-total over vs under never both fire** (mutually exclusive) -> no resolution needed.
- **Don't stack same-flavor signals** (e.g., G5-fade + soft-gap = overlap, not confirmation).

## Execution (which book)
- Soft-book spread spots & team totals: bet at the SOFT book (bovada/mybookie) — that's where the value is.
- Sharp-reference for the gap: williamhill_us.
- Key-number spots: DraftKings (validated there).
- Conference/form/total-level spots: any book, bet near the close.

## What to track (the scoreboard)
- **CLV first.** +CLV = the process is working even before W/L stabilizes (need ~hundreds of bets for W/L).
- Per-spot hit% + ROI vs the recorded baselines in LOCKED_MODELS.md. If a spot drifts >5pts below its baseline
  over a full season, demote/retire it (markets adapt — see pace edge decaying 2021->2025).
- Per-season, never just pooled (pooled hides decay).

## What NOT to do
- Don't bet the model number on every game (it's a website product, ~50% at close).
- Don't invent new spots mid-season off small samples (~10-game "hot" recipes = noise; shootout recipe was retracted).
- Don't trust a spot that hasn't passed: per-season consistency + 2025 holdout + a confound check.
- Don't bet P5 versions of G5 edges (G5 fade, line-overshoot are G5-specific; P5 is efficient).

# Team-Profile / Archetype Methodology — port from CBB to football (NFL / CFB)

Paste the block below into an NFL or CFB research thread.

---

I built a team-profile / archetype analysis system for college basketball
(`research/bball-odds/`, summarized in `research/bball-odds/BBALL_SIGNALS.md`
and the memory files `ncaab-bigout-fade-signal.md`, `ncaab-model-lab.md`,
`bball-movement-research.md`). I want to port the SAME methodology to football.
Read those CBB artifacts first for the full detail, then execute the football
version. Here is the method and the hard-won guardrails — follow them exactly,
they are the difference between a real edge and scan noise.

## The core idea

Build discrete TEAM PROFILES (archetypes), then measure how a team performs
against a given opponent-profile RELATIVE TO ITS OWN SEASON BASELINE, and test
whether that relative performance predicts the next meeting with that profile —
across every market (spread, total, team totals, 1H).

Three grouped profiles per team (translate the CBB groups to football):
- **Offense**: pace/tempo (sec/play, plays/game, no-huddle rate), run-vs-pass
  identity, explosive-play rate, deep-vs-short passing (the football analog of
  CBB's 3PT-vs-paint), play-action/motion rate, EPA/play + success rate,
  red-zone tendency, early-down pass rate.
- **Defense**: pressure/blitz rate (the analog of CBB "press"), takeaway rate,
  run-stuff rate, coverage lean (man/zone proxy), explosive-plays-allowed,
  what it limits (run vs pass vs deep), red-zone D.
- **Trenches/physical** (replaces CBB size+bench): OL/DL strength, run-block
  vs pass-pro identity, snap concentration / injury-adjusted starter
  continuity, personnel-package tendencies.

Cluster each group into ~4-6 discrete types (KMeans on within-season
percentiles, fit on early seasons). Verify within-season TYPE STABILITY is high
(CBB was 80-84%) — if a team's identity flips week to week the typology is
noise. Give each type a plain-language card + example teams so a human can
sanity-check it BEFORE any betting test.

## The style-split delta (the heart of it)

For each team, per opponent-archetype X: compute the team's performance
(offensive EPA/efficiency, or ATS cover margin) in prior games vs opponents of
type X, MINUS the team's overall prior-season baseline. That delta is "this
team is +/- N vs this style relative to how they usually play." Then test:
does a prior negative/positive delta predict the next meeting vs type X, at
the T-line, per market?

## NON-NEGOTIABLE guardrails (every one of these was learned the hard way)

1. **Leak-safe, prior-only, WITHIN-SEASON.** A team's 2024 profile-performance
   does not carry to 2025 (roster/scheme turnover). All deltas use strictly
   prior games IN THE SAME SEASON. ⚠️ FOOTBALL CAVEAT: NFL has ~17 games, CFB
   ~12 — far fewer than CBB's ~30. "≥3-4 prior meetings vs a profile" will
   almost never have sample. Adapt: (a) require only ≥2 prior meetings, (b)
   lean more on opponent-archetype MEMBERSHIP (this week's opp IS type X) than
   on the team's own history vs X, (c) consider pooling the delta across a
   rolling multi-week window, (d) accept most team-specific-history signals
   will be underpowered and treat the ARCHETYPE-vs-ARCHETYPE grid as the
   primary tool instead.

2. **MAGNITUDE beats CONSISTENCY as the bet trigger.** In CBB, filtering on
   mean-delta (≥ threshold) worked; filtering on sign-consistency (below
   baseline in X of Y games) diluted it. Consistency is the SCOUTING layer
   (team cards), not the trigger.

3. **Build on PRIVATE computations, never PUBLIC records.** ATS-record-vs-
   profile signals REVERSE (the market watches and re-prices ATS records).
   Efficiency-vs-own-baseline is our private computation and it works. If the
   public can look it up, it's already in the line.

4. **Extremity DIALS, not hard low/med/high splits.** Don't split each type
   into tiers (combinatorial sample death). Keep discrete types for structure;
   use CONTINUOUS percentile extremity as a conviction dial, tested for
   dose-response at the tail. (CBB: super-slow-pace pairings behaved OPPOSITE
   to mild-slow ones — the tail is a different animal.)

5. **Complement check.** A real signal's opposite bet should be symmetric-
   negative. If "X → over" wins AND "X → under" also wins, it's noise symmetry.

6. **Scan honesty.** State how many cells you tested and how many would clear
   |ROI|≥5% by chance (~5% of an N-cell scan). A cell earns belief from n +
   3-4/4-season consistency + complement check, NOT headline ROI.

7. **Grade at the line the SIGNAL uses**, per-season breakdown ALWAYS shown
   (pooled hides late-year decay), decimal prices, T-60/closing per policy.

8. **Anti-signals are symmetric.** A 42% cell is a 58% fade — never "suppress",
   flip it (and treat both at the same n-appropriate confidence).

9. **The narrative-overpricing meta-law** (the most valuable pattern found):
   whatever the public can NAME as a reason gets over-priced. In CBB this hit
   6 times (press matchups, shutdown-defense matchups, deep-bench, slow-pace-
   unders, ranked-road-teams, bench-as-injury-insurance). In football look for
   the equivalents: "great run D vs run team", "elite pass rush vs bad OL",
   "dome team outdoors", "revenge game", "get-right spot" — test whether the
   market OVER-corrects for the obvious storyline.

## How profiles feed the MODEL (not just signals)

In CBB, roster-SHAPE features (star-dependency, rotation depth) improved the
margin model by more than any other feature group — because they're ORTHOGONAL
to team-average efficiency, which the market already prices. Football analog:
scheme-identity and trench-shape features (not just team-average EPA) may carry
signal the market underweights. Add archetype/shape features to the existing
NFL/CFB models and measure walk-forward MAE — keep only what lowers it,
per-market (each market wants different features; don't kitchen-sink).

## Integrate, don't rebuild

Fold this into the existing NFL/CFB model + signal work (LOCKED_MODELS,
forecast_harness, the spots/flags) rather than starting over. Profiles are a
new FEATURE GROUP and a new SIGNAL-TIERING dimension on top of what exists.

## Deliverables

1. The 3 profile groups clustered into types, with named cards + example teams
   + within-season stability check.
2. The archetype-vs-archetype outcome grid (both perspectives, every market),
   with the scan-honesty framing.
3. Style-split deltas tested as signals (respecting the football sample caveat).
4. Profile/shape features added to the models, MAE-tested per market.
5. A clean writeup separating: validated bets, scouting-only cards, and the
   dead list — and every finding saved to a vault doc + memory.

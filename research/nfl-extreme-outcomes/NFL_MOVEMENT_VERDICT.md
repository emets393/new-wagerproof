# NFL movement microstructure — 5-season verdict (2026-08-17)

`nfl_movement_5season.py` on the extended odds_hist archive (2021-2025, multi-book,
1,455 games with results; bet-at-T24 / grade-at-T24 per the grading framework).

- **Naive continuation is DEAD, definitively**: follow the open→T24 consensus move at
  T24 = totals 50.9% (n=1245), spreads 48.4% (n=1125). Five seasons, no cell works.
  Do not re-run this scan; the category is closed for NFL like CFB.
- **Sharp books (betonlineag/lowvig) genuinely lead**: when their T24 number sits ≥0.5
  off the slow consensus, the close moves toward them 39-43% vs away 23% (~1.8:1).
  But it is a **CLV edge, not a results edge**: betting the sharp side at the slow line
  grades 51.2% (spreads) / 53.8% (totals, 2025 negative). Same class as the NBA
  absence signal — real information, already extracted by kickoff.
- 28% of total-line movement arrives after T-24 — the late window matters for capture
  cadence, consistent with the CFB late-steam finding.
- OPEN FOLLOW-UP (needs the totals model, not run): sharp-book gap as a CONFIRM layer
  on consensus_totals HC bets (model edge + sharp lean same direction).

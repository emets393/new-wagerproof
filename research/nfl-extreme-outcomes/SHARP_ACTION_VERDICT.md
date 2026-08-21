# Sharp Action indicator — backtest verdict (2026-08-19, sharp_action_backtest.py)

Composite at each snapshot: LEAD (sharp books ≥0.5 off consensus) + STEAM (consensus moved
≥0.5 with ≥3 books) agreeing = detection; graded at the DETECTION line (bet-at-detection
law), CLV = close kept moving toward the sharp side. NFL 2021-25 (1,455 games), CFB 2021-25
(3,475 games). Single-component controls (lead-only / steam-only) ~50-52% everywhere.

## It DETECTS sharp money (CLV)
Close moves toward the detected side 62-68% of the time overall, **83-94% when detected
inside 6h**. Real information, every sport/market. This is the product value.

## Standalone betting — mostly priced
| Sport/market | detected | hit @ detection | ROI | note |
|---|---|---|---|---|
| NFL spread | 25% of games | 53.8% | +2.8% | late ≤6h **60.0% / +14.5%** (n=45); public-fade side 54.9% |
| NFL total | 39% | 49.2% | −6.1% | nothing |
| CFB spread | 10% | **45.9%** | −12.3% | early (>24h) detections 44.1% — CFB early steam OVERSHOOTS (matches "early moves reverse"); late ~50% |
| CFB total | 20% | 48.4% | −7.5% | nothing |
Never ship "follow sharp action" as a bet. In CFB spreads it is closer to a fade (not stable
enough by season to ship either way).

## As MODEL CONFIRMATION — the use case
- **NFL spreads (legacy model w/ fade rule, 2025):** sharp AGREES → **64.3%** (n=28) vs
  54.5% when disagreeing or absent. One season; directionally the same law as CFB late
  steam (60%). Candidate: confidence bump + badge when sharp side matches the pick.
- CFB totals (core edge ≥4): agree 48.8% (n=86, 2024 22%) vs disagree 56.8% — no confirm
  value from this construct; the validated CFB confirm remains the toward-model steam
  LADDER (size of open→close move), not sharp-book-led synchronized steam.

## Ship recommendation
Indicator, not a bet: per-game badge "Sharp money on X (late/early)" from the 15-min live
capture, agent context field, and an NFL-spread confidence bump when it agrees with the
pick. Re-validate the NFL confirm after 2026 (n=28 is one season).

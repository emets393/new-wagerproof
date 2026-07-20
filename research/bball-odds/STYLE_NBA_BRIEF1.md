# NBA Style Brief #1 — style port + availability tiers

Profiles from BDL boxscores (low-3 = interior proxy; no paint pts in BDL).
hi ≥70th pct, lo ≤30th. T-60 prices. BE 52.4%.

## Conclusions (2026-07-16)

**NBA books move the SPREAD for a missing big but under-adjust the TOTAL for
the defensive/pace consequence.** Tiering the tracked big_out → game OVER:
- × attacker FT-DRAWING hi: **59.8% / +14.1%** (n=184, 3/4 seasons strong)
- × own pace hi: 56.9% / +8.6% (n=239, ALL 4 seasons positive)
- × attacker fast pace: 57.2% / +9.2% (n=236, all 4 positive)
- mechanism contrast: × attacker 3-HEAVY = 49.5% (-5.4%) — same as CBB: teams
  that don't attack the rim can't exploit a missing big. Non-random.

ATS availability tiers in NBA = noise (spreads price absences fully, as in
AVAILABILITY_BRIEF1). The NBA edge expression is TOTALS-side only.


## Availability × style tiers

| signal | n | win% | ROI | per season |
|---|---|---|---|---|
| big_out × att LOW-3 (interior) attacker → BACK attacker ATS | 200 | 51.0% | -2.6% | 2022-23: 26/61 43% -19% · 2023-24: 23/44 52% -0% · 2024-25: 32/52 62% +17% · 2025-26: 21/43 49% -7% |
| big_out × att FT-drawing hi → BACK attacker ATS | 183 | 53.6% | +2.3% | 2022-23: 19/44 43% -18% · 2023-24: 23/36 64% +22% · 2024-25: 27/53 51% -3% · 2025-26: 29/50 58% +11% |
| big_out × att OREB hi → BACK attacker ATS | 205 | 49.3% | -5.9% | 2022-23: 24/59 41% -22% · 2023-24: 19/42 45% -14% · 2024-25: 30/54 56% +6% · 2025-26: 28/50 56% +7% |
| guard_out × att TO-FORCING hi → BACK attacker ATS | 223 | 52.5% | +0.2% | 2022-23: 39/64 61% +16% · 2023-24: 22/43 51% -2% · 2024-25: 38/66 58% +10% · 2025-26: 18/50 36% -31% |
| guard_out × att TO-forcing NOT hi → BACK attacker ATS | 520 | 49.8% | -4.9% | 2022-23: 71/145 49% -6% · 2023-24: 55/111 50% -5% · 2024-25: 59/132 45% -15% · 2025-26: 74/132 56% +7% |
| lowto_guard_out × own TO-prone hi → BACK attacker ATS | 202 | 48.5% | -7.4% | 2022-23: 26/50 52% -1% · 2023-24: 20/44 45% -13% · 2024-25: 27/53 51% -3% · 2025-26: 25/55 45% -13% |

## Tiering the tracked big_out → game OVER (+4.3% base)

| signal | n | win% | ROI | per season |
|---|---|---|---|---|
| big_out (base) → game OVER | 724 | 54.8% | +4.7% | 2022-23: 104/186 56% +7% · 2023-24: 77/148 52% -1% · 2024-25: 107/192 56% +6% · 2025-26: 109/198 55% +5% |
| big_out × att fast pace hi → game OVER | 236 | 57.2% | +9.2% | 2022-23: 39/67 58% +11% · 2023-24: 21/39 54% +3% · 2024-25: 38/61 62% +19% · 2025-26: 37/69 54% +2% |
| big_out × att 3-heavy hi → game OVER | 220 | 49.5% | -5.4% | 2022-23: 32/58 55% +5% · 2023-24: 21/42 50% -5% · 2024-25: 21/47 45% -15% · 2025-26: 35/73 48% -8% |
| big_out × att FT-drawing hi → game OVER | 184 | 59.8% | +14.1% | 2022-23: 29/44 66% +26% · 2023-24: 17/35 49% -7% · 2024-25: 34/54 63% +20% · 2025-26: 30/51 59% +12% |
| big_out × own pace hi (they run anyway) → game OVER | 239 | 56.9% | +8.6% | 2022-23: 32/60 53% +2% · 2023-24: 30/52 58% +10% · 2024-25: 29/50 58% +11% · 2025-26: 45/77 58% +12% |
| big_out BOTH sides' pace ≥50th → game OVER | 199 | 53.8% | +2.7% | 2022-23: 30/57 53% +0% · 2023-24: 18/36 50% -5% · 2024-25: 27/49 55% +5% · 2025-26: 32/57 56% +7% |

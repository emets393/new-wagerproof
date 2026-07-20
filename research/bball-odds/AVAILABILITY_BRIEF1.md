# Availability Brief #1 — fresh regular absences vs the market

Flags from build_player_flags.py (fresh = played previous game, out this
one; roles from strictly-prior stats). Market bets at T-60 consensus.

## Conclusions (2026-07-16)

**HEADLINE — NCAAB `big_out → FADE team ATS`: 57.8% / +10.4% ROI, n=751,
positive ALL FOUR seasons (57/57/59/58%).** The CBB market under-adjusts when
a team's top rebounder is freshly out. Robustness (all cuts hold):
- home 57.3% / away 58.4%; favorite 59.3% / dog 57.0%
- big_out as the ONLY flag: 60.5% / +15.6% (n=499) — purer = stronger
- DOSE-RESPONSE: ≥2 regulars out → 67.2% / +28.2% (n=64)
- line already moved ≥0.5 against team: still 56.4%; line not moved: 58.8%
  (edge survives partial market adjustment)

Supporting NCAAB candidates (positive all 4 seasons, smaller edge):
- `top1_out → game UNDER`: 54.6% / +4.2% (n=689)
- `lowto_guard_out → FADE team ATS`: 54.7% / +4.4% (n=772)

**NBA: absences are fully priced** (public injury reports) — every flag bet
negative or noise. Only `big_out → game OVER` (+4.3%, n=727, 3/4 seasons)
is worth tracking; mechanism plausible (big out → worse defense/faster pace).

On-court effects (net of no-absence baseline): CBB fresh absences shave
~0.5-0.7 pts off team scoring and slightly slow pace; NBA top1/guard out
≈ -2 pts. The market prices this in the NBA, not in CBB.

**PRODUCTION CAVEAT:** flags derive from the game box (post-hoc). Live use
needs a PREGAME injury/lineup feed (covers.com has CBB — same source as the
CFB backup-QB trigger). Game-time-decision absences the T-60 market couldn't
know are part of the backtest edge; the live-capturable subset is likely
smaller, but the not-moved-line split (58.8%) suggests most of the edge sits
in games where the news WAS knowable and the market ignored it.

## NBA — 10,186 team-games on the odds spine

### On-court effects (delta vs team's prior season-to-date, fresh absences)

| flag | n | Δpace | Δteam TOs | Δteam pts | (no-absence baseline Δ) |
|---|---|---|---|---|---|
| top1_out | 733 | -0.01 | +0.12 | -2.30 | (-0.73 / -0.44 / -0.23) |
| big_out | 732 | -0.04 | -0.29 | -1.09 | (-0.73 / -0.44 / -0.23) |
| guard_out | 754 | -0.29 | +0.13 | -2.12 | (-0.73 / -0.44 / -0.23) |
| lowto_guard_out | 690 | -0.43 | +0.19 | -2.00 | (-0.73 / -0.44 / -0.23) |

### Market tests — bets on games where the flagged team's absence is fresh

| signal | n | win% | ROI | per season |
|---|---|---|---|---|
| top1_out → game UNDER | 727 | 46.2% | -11.8% | 2022-23: 91/196 46% -11% · 2023-24: 69/158 44% -17% · 2024-25: 87/194 45% -14% · 2025-26: 89/179 50% -5% |
| top1_out → game OVER | 727 | 52.4% | +0.1% | 2022-23: 100/196 51% -3% · 2023-24: 84/158 53% +1% · 2024-25: 107/194 55% +5% · 2025-26: 90/179 50% -4% |
| top1_out → team TT UNDER | 527 | 48.0% | -8.3% | 2023-24: 66/154 43% -17% · 2024-25: 95/194 49% -7% · 2025-26: 92/179 51% -2% |
| top1_out → FADE team ATS | 721 | 51.9% | -1.0% | 2022-23: 106/196 54% +3% · 2023-24: 71/157 45% -14% · 2024-25: 107/193 55% +6% · 2025-26: 90/175 51% -2% |
| top1_out → BACK team ATS | 721 | 48.1% | -8.1% | 2022-23: 90/196 46% -12% · 2023-24: 86/157 55% +5% · 2024-25: 86/193 45% -15% · 2025-26: 85/175 49% -7% |
| big_out → game UNDER | 727 | 44.8% | -14.4% | 2022-23: 81/189 43% -18% · 2023-24: 71/148 48% -8% · 2024-25: 85/192 44% -15% · 2025-26: 89/198 45% -14% |
| big_out → game OVER | 727 | 54.6% | +4.3% | 2022-23: 104/189 55% +5% · 2023-24: 77/148 52% -1% · 2024-25: 107/192 56% +6% · 2025-26: 109/198 55% +5% |
| big_out → team TT UNDER | 539 | 46.4% | -12.2% | 2023-24: 72/148 49% -8% · 2024-25: 95/193 49% -7% · 2025-26: 83/198 42% -20% |
| big_out → FADE team ATS | 723 | 50.5% | -3.6% | 2022-23: 86/187 46% -12% · 2023-24: 79/148 53% +2% · 2024-25: 98/191 51% -2% · 2025-26: 102/197 52% -1% |
| big_out → BACK team ATS | 723 | 49.5% | -5.4% | 2022-23: 101/187 54% +3% · 2023-24: 69/148 47% -11% · 2024-25: 93/191 49% -7% · 2025-26: 95/197 48% -8% |
| guard_out → game UNDER | 746 | 48.4% | -7.6% | 2022-23: 100/206 49% -7% · 2023-24: 67/155 43% -17% · 2024-25: 97/201 48% -8% · 2025-26: 97/184 53% +1% |
| guard_out → game OVER | 746 | 50.5% | -3.5% | 2022-23: 102/206 50% -5% · 2023-24: 84/155 54% +3% · 2024-25: 104/201 52% -1% · 2025-26: 87/184 47% -10% |
| guard_out → team TT UNDER | 538 | 48.1% | -8.1% | 2023-24: 70/151 46% -10% · 2024-25: 97/202 48% -9% · 2025-26: 92/185 50% -6% |
| guard_out → FADE team ATS | 744 | 50.8% | -3.0% | 2022-23: 112/209 54% +2% · 2023-24: 77/154 50% -5% · 2024-25: 97/198 49% -6% · 2025-26: 92/183 50% -4% |
| guard_out → BACK team ATS | 744 | 49.2% | -6.0% | 2022-23: 97/209 46% -11% · 2023-24: 77/154 50% -5% · 2024-25: 101/198 51% -3% · 2025-26: 91/183 50% -5% |
| lowto_guard_out → game UNDER | 686 | 48.5% | -7.3% | 2022-23: 99/196 51% -4% · 2023-24: 65/147 44% -16% · 2024-25: 87/177 49% -6% · 2025-26: 82/166 49% -6% |
| lowto_guard_out → game OVER | 686 | 50.6% | -3.4% | 2022-23: 93/196 47% -9% · 2023-24: 80/147 54% +4% · 2024-25: 90/177 51% -3% · 2025-26: 84/166 51% -3% |
| lowto_guard_out → team TT UNDER | 486 | 48.4% | -8.3% | 2023-24: 66/142 46% -11% · 2024-25: 90/178 51% -4% · 2025-26: 79/166 48% -10% |
| lowto_guard_out → FADE team ATS | 677 | 52.0% | -0.7% | 2022-23: 103/194 53% +1% · 2023-24: 73/143 51% -3% · 2024-25: 92/176 52% -0% · 2025-26: 84/164 51% -2% |
| lowto_guard_out → BACK team ATS | 677 | 48.0% | -8.3% | 2022-23: 91/194 47% -10% · 2023-24: 70/143 49% -7% · 2024-25: 84/176 48% -9% · 2025-26: 80/164 49% -7% |

## NCAAB — 44,508 team-games on the odds spine

### On-court effects (delta vs team's prior season-to-date, fresh absences)

| flag | n | Δpace | Δteam TOs | Δteam pts | (no-absence baseline Δ) |
|---|---|---|---|---|---|
| top1_out | 692 | -1.13 | -0.24 | -0.93 | (-1.02 / -0.58 / -0.30) |
| big_out | 769 | -1.01 | -0.71 | -0.11 | (-1.02 / -0.58 / -0.30) |
| guard_out | 790 | -1.18 | -0.20 | -1.04 | (-1.02 / -0.58 / -0.30) |
| lowto_guard_out | 787 | -1.21 | -0.41 | -0.79 | (-1.02 / -0.58 / -0.30) |

### Market tests — bets on games where the flagged team's absence is fresh

| signal | n | win% | ROI | per season |
|---|---|---|---|---|
| top1_out → game UNDER | 689 | 54.6% | +4.2% | 2022-23: 102/183 56% +6% · 2023-24: 97/171 57% +8% · 2024-25: 93/176 53% +1% · 2025-26: 84/159 53% +1% |
| top1_out → game OVER | 689 | 45.4% | -13.3% | 2022-23: 81/183 44% -15% · 2023-24: 74/171 43% -17% · 2024-25: 83/176 47% -10% · 2025-26: 75/159 47% -10% |
| top1_out → team TT UNDER | 494 | 51.8% | -2.5% | 2023-24: 89/162 55% +4% · 2024-25: 87/176 49% -8% · 2025-26: 80/156 51% -3% |
| top1_out → FADE team ATS | 679 | 51.4% | -1.8% | 2022-23: 93/182 51% -2% · 2023-24: 83/167 50% -5% · 2024-25: 94/172 55% +4% · 2025-26: 79/158 50% -4% |
| top1_out → BACK team ATS | 679 | 48.6% | -7.2% | 2022-23: 89/182 49% -7% · 2023-24: 84/167 50% -4% · 2024-25: 78/172 45% -13% · 2025-26: 79/158 50% -5% |
| big_out → game UNDER | 763 | 47.1% | -10.1% | 2022-23: 93/199 47% -11% · 2023-24: 89/178 50% -5% · 2024-25: 86/202 43% -19% · 2025-26: 91/184 49% -6% |
| big_out → game OVER | 763 | 52.9% | +1.1% | 2022-23: 106/199 53% +2% · 2023-24: 89/178 50% -5% · 2024-25: 116/202 57% +10% · 2025-26: 93/184 51% -4% |
| big_out → team TT UNDER | 550 | 50.5% | -5.0% | 2023-24: 87/167 52% -2% · 2024-25: 90/198 45% -15% · 2025-26: 101/185 55% +3% |
| big_out → FADE team ATS | 751 | 57.8% | +10.4% | 2022-23: 111/194 57% +9% · 2023-24: 100/176 57% +8% · 2024-25: 116/198 59% +12% · 2025-26: 107/183 58% +12% |
| big_out → BACK team ATS | 751 | 42.2% | -19.4% | 2022-23: 83/194 43% -18% · 2023-24: 76/176 43% -18% · 2024-25: 82/198 41% -21% · 2025-26: 76/183 42% -21% |
| guard_out → game UNDER | 786 | 53.2% | +1.6% | 2022-23: 110/205 54% +2% · 2023-24: 97/189 51% -2% · 2024-25: 119/224 53% +2% · 2025-26: 92/168 55% +5% |
| guard_out → game OVER | 786 | 46.8% | -10.6% | 2022-23: 95/205 46% -12% · 2023-24: 92/189 49% -7% · 2024-25: 105/224 47% -11% · 2025-26: 76/168 45% -14% |
| guard_out → team TT UNDER | 564 | 51.8% | -2.7% | 2023-24: 91/179 51% -4% · 2024-25: 109/219 50% -7% · 2025-26: 92/166 55% +4% |
| guard_out → FADE team ATS | 780 | 52.9% | +1.2% | 2022-23: 110/201 55% +4% · 2023-24: 98/189 52% -1% · 2024-25: 117/222 53% +1% · 2025-26: 88/168 52% +0% |
| guard_out → BACK team ATS | 780 | 47.1% | -10.1% | 2022-23: 91/201 45% -14% · 2023-24: 91/189 48% -8% · 2024-25: 105/222 47% -10% · 2025-26: 80/168 48% -9% |
| lowto_guard_out → game UNDER | 780 | 50.9% | -2.8% | 2022-23: 116/228 51% -3% · 2023-24: 90/175 51% -2% · 2024-25: 106/213 50% -5% · 2025-26: 85/164 52% -1% |
| lowto_guard_out → game OVER | 780 | 49.1% | -6.3% | 2022-23: 112/228 49% -6% · 2023-24: 85/175 49% -7% · 2024-25: 107/213 50% -4% · 2025-26: 79/164 48% -8% |
| lowto_guard_out → team TT UNDER | 543 | 49.5% | -6.8% | 2023-24: 81/169 48% -10% · 2024-25: 101/210 48% -10% · 2025-26: 87/164 53% -0% |
| lowto_guard_out → FADE team ATS | 772 | 54.7% | +4.4% | 2022-23: 124/221 56% +7% · 2023-24: 96/176 55% +4% · 2024-25: 112/211 53% +2% · 2025-26: 90/164 55% +5% |
| lowto_guard_out → BACK team ATS | 772 | 45.3% | -13.4% | 2022-23: 97/221 44% -16% · 2023-24: 80/176 45% -13% · 2024-25: 99/211 47% -10% · 2025-26: 74/164 45% -14% |

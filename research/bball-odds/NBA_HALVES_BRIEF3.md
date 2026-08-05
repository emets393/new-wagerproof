# NBA Halves Brief #3 — the shared 1H-total-streak fade, pressure-tested

3,962 games. 1H consensus close, decimal. BE 52.4%. Per-season win%.

## Streak-depth ladder, both signs, and the combined fade

| signal | n | win% | ROI | per-season |
|---|---|---|---|---|
| [any gp] both 2+ OVER streak → UNDER | 276 | 52.9% | +1.0% | 2023-24:56 2024-25:49 2025-26:54 |
| [any gp] both 2+ UNDER streak → OVER | 276 | 53.3% | +1.5% | 2023-24:45 2024-25:60 2025-26:54 |
| **[any gp] COMBINED fade shared 2+ 1H streak** | 552 | 53.1% | +1.3% | 2023-24:50 2024-25:55 2025-26:54 |
| [any gp] both 3+ OVER streak → UNDER | 81 | 59.3% | +13.1% | 2023-24:62 2024-25:54 2025-26:61 |
| [any gp] both 3+ UNDER streak → OVER | 71 | 56.3% | +7.4% | 2023-24:48 2024-25:61 2025-26:60 |
| **[any gp] COMBINED fade shared 3+ 1H streak** | 152 | 57.9% | +10.4% | 2023-24:55 2024-25:57 2025-26:60 |
| [20+ gp] both 2+ OVER streak → UNDER | 226 | 54.4% | +3.9% | 2023-24:54 2024-25:49 2025-26:59 |
| [20+ gp] both 2+ UNDER streak → OVER | 232 | 55.2% | +5.2% | 2023-24:48 2024-25:66 2025-26:52 |
| **[20+ gp] COMBINED fade shared 2+ 1H streak** | 458 | 54.8% | +4.6% | 2023-24:51 2024-25:58 2025-26:56 |
| [20+ gp] both 3+ OVER streak → UNDER | 56 | 64.3% | +22.7% | 2023-24:60 2024-25:56 2025-26:74 |
| [20+ gp] both 3+ UNDER streak → OVER | 57 | 59.6% | +13.7% | 2023-24:55 2024-25:65 2025-26:60 |
| **[20+ gp] COMBINED fade shared 3+ 1H streak** | 113 | 61.9% | +18.1% | 2023-24:57 2024-25:60 2025-26:67 |
| [30+ gp] both 2+ OVER streak → UNDER | 193 | 54.9% | +4.9% | 2023-24:56 2024-25:47 2025-26:60 |
| [30+ gp] both 2+ UNDER streak → OVER | 209 | 54.5% | +4.0% | 2023-24:47 2024-25:65 2025-26:53 |
| **[30+ gp] COMBINED fade shared 2+ 1H streak** | 402 | 54.7% | +4.4% | 2023-24:51 2024-25:56 2025-26:57 |
| [30+ gp] both 3+ OVER streak → UNDER | 50 | 62.0% | +18.4% | 2023-24:55 2024-25:56 2025-26:71 |
| [30+ gp] both 3+ UNDER streak → OVER | 48 | 58.3% | +11.2% | 2023-24:50 2024-25:64 2025-26:62 |
| **[30+ gp] COMBINED fade shared 3+ 1H streak** | 98 | 60.2% | +14.9% | 2023-24:52 2024-25:59 2025-26:68 |

## Does it need BOTH teams?

| signal | n | win% | ROI | per-season |
|---|---|---|---|---|
| ≥1 team on 3+ OVER streak → UNDER | 640 | 50.2% | -4.2% | 2023-24:50 2024-25:51 2025-26:50 |
| EXACTLY one team on 3+ OVER streak → UNDER | 584 | 48.8% | -6.8% | 2023-24:50 2024-25:50 2025-26:47 |
| ≥1 team on 3+ UNDER streak → OVER | 668 | 51.9% | -0.9% | 2023-24:53 2024-25:50 2025-26:52 |
| EXACTLY one team on 3+ UNDER streak → OVER | 611 | 51.2% | -2.3% | 2023-24:53 2024-25:48 2025-26:52 |
| OPPOSED streaks (one hot one cold) → OVER | 75 | 48.0% | -8.4% | 2023-24:54 2024-25:52 2025-26:38 |
| OPPOSED streaks → UNDER | 75 | 52.0% | -0.7% | 2023-24:46 2024-25:48 2025-26:62 |

## Mechanism — does the book move the 1H total for streaks? (20+ gp)

| cell | n | mean 1H line | mean actual | actual − line | realized over% |
|---|---|---|---|---|---|
| both 3+ OVER streak | 56 | 114.9 | 113.9 | -1.08 | 35.7% |
| both 2+ OVER streak | 226 | 114.2 | 114.2 | +0.05 | 45.6% |
| no shared streak (baseline) | 2,574 | 114.2 | 114.3 | +0.08 | 49.5% |
| both 2+ UNDER streak | 235 | 112.4 | 113.0 | +0.58 | 54.5% |
| both 3+ UNDER streak | 57 | 111.4 | 113.4 | +2.00 | 59.6% |

- both 3+ OVER streak: mean season 1H over% of the two teams = 0.529
- both 2+ OVER streak: mean season 1H over% of the two teams = 0.518
- no shared streak (baseline): mean season 1H over% of the two teams = 0.500
- both 2+ UNDER streak: mean season 1H over% of the two teams = 0.482
- both 3+ UNDER streak: mean season 1H over% of the two teams = 0.473

## Robustness of the COMBINED 3+ shared-streak fade

| variant | n | win% | ROI | per-season |
|---|---|---|---|---|
| combined (20+ gp) — headline | 113 | 61.9% | +18.1% | 2023-24:57 2024-25:60 2025-26:67 |
| combined, graded flat -110 | 113 | 61.9% | +18.3% | 2023-24:57 2024-25:60 2025-26:67 |
| combined, streak ALIGNED with season record | 51 | 60.8% | +16.0% | 2023-24:67 2024-25:62 2025-26:55 |
| combined, streak OPPOSED to season record | 62 | 62.9% | +19.9% | 2023-24:50 2024-25:58 2025-26:78 |
| combined, drop 2023-24 | 78 | 64.1% | +22.4% | 2024-25:60 2025-26:67 |
| combined, drop 2024-25 | 78 | 62.8% | +19.8% | 2023-24:57 2025-26:67 |
| combined, drop 2025-26 | 70 | 58.6% | +11.5% | 2023-24:57 2024-25:60 |

## Does the shared 1H streak also fade the FULL-GAME total?

| signal | n | win% | ROI | per-season |
|---|---|---|---|---|
| both 3+ 1H OVER streak → FULL-GAME UNDER | 56 | 50.0% | -4.5% | 2023-24:40 2024-25:44 2025-26:61 |
| both 3+ 1H UNDER streak → FULL-GAME OVER | 57 | 52.6% | +0.5% | 2023-24:45 2024-25:59 2025-26:55 |
| COMBINED shared 1H streak → fade FULL-GAME total | 113 | 51.3% | -2.0% | 2023-24:43 2024-25:51 2025-26:58 |

## Control — is the 1H-spread gap just "good team beats bad team"? (20+ gp)

The better-1H-cover team is the favorite in 70% of gap≥20pp games, so quality
has to be partialled out. Control cell = same spread bucket, gap ≤5pp.

| cell | n | win% | ROI | per-season |
|---|---|---|---|---|
| \|spread\| [0,3) gap≥20pp → BACK better | 52 | 48.1% | -8.6% | 33 / 30 / 67 |
| \|spread\| [0,3) gap≤5pp (control) | 193 | 47.7% | -9.0% | 46 / 46 / 51 |
| \|spread\| [3,6) gap≥20pp → BACK better | 81 | 51.9% | -1.3% | 52 / 48 / 55 |
| \|spread\| [3,6) gap≤5pp (control) | 282 | 44.0% | -16.1% | 46 / 45 / 39 |
| \|spread\| [6,9) gap≥20pp → BACK better | 64 | 64.1% | +21.9% | 76 / 61 / 50 |
| \|spread\| [6,9) gap≤5pp (control) | 239 | 51.0% | -2.7% | 51 / 44 / 59 |
| \|spread\| [9,30) gap≥20pp → BACK better | 106 | 56.6% | +7.8% | 56 / 53 / 59 |
| \|spread\| [9,30) gap≤5pp (control) | 311 | 47.3% | -9.8% | 47 / 50 / 44 |
| gap≥20pp AND better team is the DOG → BACK | 90 | 52.2% | -0.4% | 29 / 54 / 62 |
| gap≥20pp AND better team is the FAVORITE → BACK | 213 | 56.8% | +8.0% | 60 / 47 / 57 |

The gap DOES add inside a spread bucket (56.6% vs 47.3% control at ≥9), so it is
not pure team quality — but it only lives on the FAVORITE side and at spreads ≥6.
The 6-9 cell is decaying (76 → 61 → 50). Treat as TRACK-PLUS, not vault.

## Verdict

1. **Shared 1H-total streak fade = the real find.** Both teams riding the same
   3+ 1H over/under streak → bet against it: **61.9% / +18.1% (n=113, 57/60/67,
   20+ gp)**. Dose-response 2+ → 54.8% (n=458) → 3+ → 61.9%. Both signs work
   (over-streak → under 64.3%, under-streak → over 59.6%), which is much harder
   to get by chance than a one-sided cell. Survives flat -110 (+18.3%),
   drop-any-season (+11.5% worst), and aligned/opposed-to-season-record splits.
2. **The conjunction is the signal.** ONE team on a 3+ streak = nothing (50.2%,
   -4.2%). OPPOSED streaks = nothing (52.0%). Only both-same-direction fires.
3. **Mechanism is a real pricing artifact, and it is 1H-specific.** The book
   barely lifts the 1H total for over-streaks (114.9 vs 114.2 baseline) but cuts
   it hard for under-streaks (111.4, −2.8) — and actual 1H points barely move
   (113.9 vs 113.4). Realized over% swings 35.7% → 59.6% across cells the line
   only moved 3.5 points for. The same rule on the FULL-GAME total is dead
   (51.3%, −2.0%), so this is 1H-total mispricing, not scoring regression.
4. **30+ games makes things WORSE, not better.** The 1H-spread cross peaks in the
   20-30 game window (58/42 tier: 56.8% at 20+ → 53.8% at 30+; 55/45 tier: 52.8%
   → 51.2%). The streak fade is flat across gates (61.9% at 20+, 60.2% at 30+).
   Use 20+ as the gate; the "wait for 30 games" intuition costs edge.
5. **Season 1H over% alone is priced-to-overpriced, and asymmetrically.** Both
   teams ≥55% season 1H over% → OVER loses hard (46.1%, −12.2%); the UNDER side
   is +3.0%. Both ≤45% → UNDER +5.7%. So high-scoring 1H history IS overpriced,
   low-scoring history is not — the market only overcorrects upward. But the
   effect is weak next to the streak version; recency, not season record, is what
   the book misprices.

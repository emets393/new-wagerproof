# NBA availability round 2 — 1H vs 2H decomposition

3,832 games. FG/1H graded at T-60 consensus (decimal); the 2H column is **SYNTHETIC** (line = FG − 1H, graded flat -110) — it localises the effect, it is not a price we have. BE 52.4%.

## A — moderate star out → BACK on the 1H spread: splits and decay

| signal | n | win% | ROI | per-season |
|---|---|---|---|---|
| star out [18,22) ppg → BACK depleted [FG] | 254 | 51.2% | -2.2% | 2023-24:55 2024-25:51 2025-26:48 |
| star out [18,22) ppg → BACK depleted [1H] | 256 | 55.5% | +5.7% | 2023-24:58 2024-25:58 2025-26:50 |
| star out [18,22) ppg → BACK depleted [2H] | 255 | 48.6% | -7.2% | 2023-24:55 2024-25:46 2025-26:46 |
| star out [22,25) ppg → BACK depleted [FG] | 193 | 53.4% | +1.9% | 2023-24:59 2024-25:45 2025-26:57 |
| star out [22,25) ppg → BACK depleted [1H] | 192 | 56.8% | +8.2% | 2023-24:64 2024-25:51 2025-26:54 |
| star out [22,25) ppg → BACK depleted [2H] | 192 | 47.9% | -8.5% | 2023-24:47 2024-25:48 2025-26:50 |
| star out [25,99) ppg → BACK depleted [FG] | 230 | 44.3% | -15.3% | 2023-24:45 2024-25:42 2025-26:46 |
| star out [25,99) ppg → BACK depleted [1H] | 232 | 52.2% | -0.6% | 2023-24:61 2024-25:52 2025-26:45 |
| star out [25,99) ppg → BACK depleted [2H] | 230 | 41.3% | -21.2% | 2023-24:41 2024-25:38 2025-26:45 |
| …depleted team is HOME → BACK [1H] | 224 | 53.1% | +1.2% | 2023-24:57 2024-25:54 2025-26:49 |
| …depleted team is AWAY → BACK [1H] | 224 | 58.9% | +12.3% | 2023-24:64 2024-25:57 2025-26:55 |
| …depleted team FAVORED → BACK [1H] | 185 | 57.3% | +9.0% | 2023-24:65 2024-25:54 2025-26:54 |
| …depleted team DOG → BACK [1H] | 263 | 55.1% | +5.2% | 2023-24:58 2024-25:56 2025-26:50 |
| …and exactly ONE regular out → BACK [1H] | 346 | 56.1% | +6.8% | 2023-24:60 2024-25:56 2025-26:51 |
| …and 2+ regulars out → BACK [1H] | 102 | 55.9% | +6.7% | 2023-24:64 2024-25:53 2025-26:53 |

## B — severe depletion → FADE on the full game (dose ladder)

| signal | n | win% | ROI | per-season |
|---|---|---|---|---|
| ≥22ppg star out → FADE depleted [FG] | 435 | 51.3% | -2.1% | 2023-24:48 2024-25:55 2025-26:50 |
| ≥22ppg star out → FADE depleted [1H] | 436 | 45.6% | -12.9% | 2023-24:38 2024-25:48 2025-26:51 |
| ≥22ppg star out → FADE depleted [2H] | 433 | 56.1% | +7.1% | 2023-24:56 2024-25:58 2025-26:54 |
| ≥25ppg star out → FADE depleted [FG] | 242 | 55.4% | +5.7% | 2023-24:53 2024-25:58 2025-26:55 |
| ≥25ppg star out → FADE depleted [1H] | 244 | 48.4% | -7.7% | 2023-24:40 2024-25:48 2025-26:56 |
| ≥25ppg star out → FADE depleted [2H] | 241 | 58.1% | +10.9% | 2023-24:57 2024-25:62 2025-26:56 |
| ≥28ppg star out → FADE depleted [FG] | 106 | 50.0% | -4.5% | 2023-24:55 2024-25:45 2025-26:50 |
| ≥28ppg star out → FADE depleted [1H] | 108 | 47.2% | -9.9% | 2023-24:43 2024-25:45 2025-26:51 |
| ≥28ppg star out → FADE depleted [2H] | 109 | 57.8% | +10.3% | 2023-24:67 2024-25:58 2025-26:52 |
| 2+ fresh regulars out (other full) → FADE [FG] | 203 | 57.1% | +9.1% | 2023-24:50 2024-25:63 2025-26:57 |
| 2+ fresh regulars out (other full) → FADE [1H] | 201 | 51.2% | -2.1% | 2023-24:39 2024-25:54 2025-26:58 |
| 2+ fresh regulars out (other full) → FADE [2H] | 204 | 57.8% | +10.4% | 2023-24:59 2024-25:63 2025-26:52 |
| 3+ fresh regulars out (other full) → FADE [FG] | 42 | 47.6% | -9.1% | 2023-24:57 2024-25:29 2025-26:57 |
| 3+ fresh regulars out (other full) → FADE [1H] | 40 | 60.0% | +14.9% | 2023-24:50 2024-25:50 2025-26:70 |
| 3+ fresh regulars out (other full) → FADE [2H] | 42 | 47.6% | -9.1% | 2023-24:71 2024-25:50 2025-26:38 |
| 30+ ppg removed (other side clean) → FADE [FG] | 174 | 53.4% | +2.0% | 2023-24:46 2024-25:58 2025-26:56 |
| 30+ ppg removed (other side clean) → FADE [1H] | 173 | 50.9% | -2.8% | 2023-24:39 2024-25:57 2025-26:57 |
| 30+ ppg removed (other side clean) → FADE [2H] | 175 | 56.6% | +8.0% | 2023-24:60 2024-25:61 2025-26:49 |
| 40+ ppg removed (other side clean) → FADE [FG] | 83 | 55.4% | +5.8% | 2023-24:50 2024-25:58 2025-26:57 |
| 40+ ppg removed (other side clean) → FADE [1H] | 80 | 57.5% | +9.9% | 2023-24:38 2024-25:64 2025-26:65 |
| 40+ ppg removed (other side clean) → FADE [2H] | 83 | 55.4% | +5.8% | 2023-24:59 2024-25:58 2025-26:51 |
| **SEVERE (≥25ppg star OR 2+ regulars), other side not → FADE** [FG] | 423 | 55.6% | +6.1% | 2023-24:51 2024-25:61 2025-26:55 |
| **SEVERE (≥25ppg star OR 2+ regulars), other side not → FADE** [1H] | 423 | 48.7% | -7.0% | 2023-24:44 2024-25:48 2025-26:54 |
| **SEVERE (≥25ppg star OR 2+ regulars), other side not → FADE** [2H] | 422 | 57.6% | +9.9% | 2023-24:54 2024-25:64 2025-26:55 |
| …severe side FAVORED → FADE [FG] | 186 | 54.8% | +4.7% | 2023-24:48 2024-25:66 2025-26:49 |
| …severe side DOG → FADE [FG] | 237 | 56.1% | +7.1% | 2023-24:53 2024-25:56 2025-26:59 |

## C — both teams depleted → which half produces the points?

| signal | n | win% | ROI | per-season |
|---|---|---|---|---|
| both depleted → OVER [FG total] | 262 | 55.0% | +4.9% | 2023-24:56 2024-25:57 2025-26:52 |
| both depleted → OVER [1H total] | 263 | 49.0% | -6.4% | 2023-24:49 2024-25:47 2025-26:52 |
| both depleted → OVER [2H SYNTHETIC] | 261 | 52.1% | -0.5% | 2023-24:49 2024-25:54 2025-26:53 |
| both missing 10+ ppg → OVER [FG total] | 214 | 52.8% | +0.8% | 2023-24:53 2024-25:55 2025-26:51 |
| both missing 10+ ppg → OVER [1H total] | 215 | 47.0% | -10.3% | 2023-24:48 2024-25:40 2025-26:52 |
| both missing 10+ ppg → OVER [2H SYNTHETIC] | 213 | 51.2% | -2.3% | 2023-24:47 2024-25:53 2025-26:53 |
| ≥20ppg star RETURNING → UNDER [FG total] | 504 | 53.6% | +2.3% | 2023-24:48 2024-25:56 2025-26:57 |
| ≥20ppg star RETURNING → UNDER [1H total] | 506 | 50.4% | -3.8% | 2023-24:48 2024-25:55 2025-26:48 |
| ≥20ppg star RETURNING → UNDER [2H SYNTHETIC] | 499 | 54.7% | +4.4% | 2023-24:49 2024-25:57 2025-26:59 |

## D — Mechanism, controlled: 1H line as a function of the FG line

- 1H_spread = -0.049 + 0.5726·FG_spread +0.009·(star_out_home − star_out_away) -0.005·(severe_home − severe_away)
- actual 1H margin (home, sign-flipped to line convention) = +0.153 + 0.5971·FG_spread -1.518·star +0.483·severe
- actual FG margin (same convention) = +0.176 + 1.0410·FG_spread -1.018·star +1.697·severe

Read: the star/severe coefficients on the LINE say how much extra the book shades a depleted team beyond what the FG spread already carries; the same coefficients on ACTUAL margin say whether the game agreed.

# Football Betting Markets — The Rulebook (NFL + CFB)

> Verified against live generator code 2026-08-24 (`dryrun_wk12_games.py`, `gen_cfb_picks.py`,
> `gen_cfb_dryrun_flags.py`, `cfb_forecast.py`, `consensus_totals.py`, `nfl_sharp_action.py`,
> `live_odds*.py`, `render.yaml`). Every threshold below is quoted from code, not memory.
> Companion docs: `SIGNALS_PRODUCTION_AUDIT_2026.md` (per-signal records),
> `cfb-model/LOCKED_MODELS.md`, `nfl-extreme-outcomes/DRYRUN_WK12_SPEC.md`.

---

## 1. Where every line comes from

**One source: The Odds API.** No line, any market, any sport, comes from anywhere else.

| Feed | Markets captured | Cadence |
|---|---|---|
| NFL `live_odds.py` | `spreads, totals, h2h, spreads_h1, totals_h1, h2h_h1, team_totals` (all 7 in one feed) | every 15 min for today's games until kickoff; 3×/day for future days |
| CFB `live_odds_cfb.py` | `h2h, spreads, totals` (full game) | same 15-min/3×-day pattern |
| CFB `live_odds_cfb_1h.py` | `team_totals, spreads_h1, totals_h1, h2h_h1` | same 15-min/3×-day pattern |

- **"Close" = T-60.** Owner policy (2026-06-27): the closing line is the capture ~1 hour
  before kickoff so users always have ≥1h to bet the number we grade against.
- **"Open"** = first capture of the market (per-market — 1H/TT lines post later than FG).
- Consensus at any snapshot = **median across books**; per-market series use each book's
  latest non-null value (a book that only posts FG never nulls out another book's 1H line).
- **Upcoming-slate fallback (both sports):** historical "close" columns only exist for
  played games, so slate generators fill FG *and* 1H/TT lines for upcoming games from the
  latest capture medians. (CFB got this 2026-08-22; NFL 2026-08-24 — the "lines but no
  projection" incident.)
- Moneyline prices (FG + 1H) are archived every capture and exposed with opens in the
  movement views.

## 2. The two-layer architecture (the single most important rule)

**Layer 1 — Models** produce a number for **every game, every market**. That number always
renders. A card with no bet is labeled *projection only* — it is never blank. This is the
website product (a 53-58% baseline model with +CLV *is* the product).

**Layer 2 — Signals/spots** produce **bets**. A card only becomes a play (`has_play=true`)
when a validated rule fires on it. Conviction and stake come from the strongest signal
attached to that card's side. Signals on the opposite side render as "contradicts this
pick."

So the answer to "what makes X bettable?" is always: **which signal fired**, never "the
model number crossed some invisible line" — except where the model's own edge *is* a
registered signal with a frozen threshold (listed below).

**Tiers & stakes** —
NFL: `mammoth 3u · high 1.5u · med 1u · low 0.5u · lean 0.25u` (labels: MAMMOTH Play /
High Conviction / Solid Play / Lean / Small Lean / No Bet).
CFB: `mammoth 5u · T1 3u · T2 2u · T3 1u · track 0.5u` (core_total_edge deliberately runs
T1=1.5u/T2=1u its first live season).
`track` tier = paper-traded, shown as context, **never a bet reason**.

**Grading lines are per-signal, frozen** (`GRADE_LINE`): NFL harness spreads + consensus
totals grade vs **open**; props / 1H model / K-signals / late-defense grade vs **close**
(T-60); sharp-action grades at the **detection** line. CFB model spots grade vs open or
close per the spot library; steam-ladder totals vs close. Whichever line a signal *uses* is
the line it's *graded* against — no CLV-inflated records.

---

## 3. NFL — market by market (8 cards per game)

### 3.1 Full-game spread — CAN be a bet
- **Side**: the regression margin model vs the **opening** spread (`reg_edge`). The
  classification cover model rides along as the `sides_model` signal.
- **Conviction ladder** (code, `dryrun_wk12_games.py`):
  - models disagree (margin side ≠ classifier side) → **none** (projection only) —
    walk-forward validated: AGREE 53.5%/+2.1%, DISAGREE 46%/−12%
  - agree, |edge| > 0 → **lean** (0.25u)
  - agree, |edge| ≥ 1.5 → **med** (1u)
  - agree, |edge| ≥ 3 *or* a validated active spot backs the same side → **high** (1.5u)
  - harness **mammoth** gate (locked: confluence=1 + spot) → **MAMMOTH** (3u; 2025: 14/16)
- Graded vs open. ~20 registered spread spots (legacy fade/primetime, dog-cover
  regression, key-number tells, etc.) attach as signals — see the audit doc for records.

### 3.2 Full-game total — CAN be a bet
- **Model**: the locked consensus-totals ensemble (b15+b55, strict-open artifact).
- **Tiers** (frozen in `consensus_totals.py`):
  - **HC — the bet**: both sub-models agree AND 3 ≤ min|edge| ≤ 7 → high conviction
    (~57-58% / +8-10% ROI, n=172 over 2 seasons, ~85/yr)
  - LEAN: agree, min|edge| 2-3 → display lean, **no bet**
  - WEAK: min|edge| < 2 → display only
  - **EXTREME: min|edge| > 7 → NEVER bet** (historically 50%/−5%; model overconfident)
  - Weeks 1-3: `LEAN_EARLY` (b55 only, |edge| ≥ 2) → display only, **no bet** (b15 warming up)
- Graded vs open.

### 3.3 Team totals (home + away) — display-only by default
- **Projection**: derived from the FG models — `(pred_total ± pred_margin)/2`. No
  standalone NFL TT model.
- Becomes a play **only** when a signal attaches: K-signals (K9/K10/K11 ~55%/+4-6%, low
  tier 0.5u) or the late-season defense family (§3.6). Otherwise: projection + posted line,
  no bet.

### 3.4 Moneyline — never a bet
- Display-only "Predicted Winner": win prob = Φ(margin), best price shown. No validated
  NFL ML edge exists; nothing fires here.

### 3.5 First-half spread / total / moneyline — display + tracking
- **Projection**: the vaulted 1H model (`h1m_preds`, anchored) once 2026 pbp publishes;
  until then derived from FG models by market-implied shares (**1H total = 0.495 × FG
  total, 1H margin = 0.562 × FG margin**; 2023-25 medians, n≈850). Real model wins by
  `fillna` the moment it populates.
- **1H spread pick side** = the side that *covers* the posted 1H line given the model
  margin (never "predicted winner"). Label always shows the model's own number,
  pick-perspective sign.
- Cards are **tracking/display-only** unless an M/K signal fires: `M3_primetime_fav_tilt`
  and `M4_slow_start_dog_fade` (~58%, med 1u) are the only active 1H bet signals;
  `M1_window_over_k1` (~57%, med) on the 1H total. K3/K7/K8 are tracking (0.5u paper).
- 1H ML: display-only predicted 1H leader (prob = Φ(1H margin / 10.5)).

### 3.6 NFL overlay signals with **week gates**
| Signal | Market | Window | Rule | Record | Tier |
|---|---|---|---|---|---|
| `mid_fade_good_defense` | spread | **wk 4-11** | fade the team whose defense EPA-ranks ≥40 pct-pts better | 56.2% / +7.2%, n=349, 7/8 seasons ≥51% | active med, close |
| `late_matchup_under` | total | **wk 12+** | top-25% D vs bottom-25% O in game → UNDER | 58.9%, n=95, +12.5%, 6/8 seasons | active med, close |
| `late_bad_o_vs_good_d_tt_under` | team total | **wk 12+** | bottom-⅓ offense facing top-25% D → TT UNDER | 69.6%, n=46, +32.8% (69/69/71) | active med, close |
| `late_good_o_vs_bad_d_tt_over` | team total | **wk 12+** | top-⅓ offense facing bottom-25% D → TT OVER | 64.9%, n=57, +23.9% | active med, close |
| `sharp_action_1to3d` | spread | detected **24-72h** pre-kick | LEAD (BetOnline/LowVig ≥0.5 off consensus) + STEAM (≥3 books moved ≥0.5 same way) agreeing | 58.2% ATS n=47; close follows 79% | T3 1u, **detection line** |
| `sharp_action_6h` | spread | detected **≤6h** pre-kick | same composite, late window | 60.0% / +14.5% n=45; close follows 94% | T2 1u, **detection line** |

- Late-defense family needs `nfl_pregame_advanced_team_week` with ≥28 ranked teams and
  **week ≥ 4** (EPA convention: 3 played weeks first); it skips cleanly if the 2026 feed
  is late.
- Sharp action is **NFL-only** (CFB failed both windows, 47%/50% — CFB early steam
  *overshoots*). Runs after every 15-min capture; one flag per (game, signal), never
  re-fired. Never shipped as "follow sharp" on totals (49.2%, −6.1%).

### 3.7 NFL player props (separate surface)
13 P-signals, all 3-season revalidated 2026-08-17, graded at the T-60 close with real
posted prices. Bets: P12 featured-WR over (65.6%/+22.8%, high), P16 attempts confluence
under (61.5%/+12.8%, high), P18 pass-TDs over (63-69%, high), P13/P14/P15/P17 med,
P1/P2 med, rest low. Full table in the audit doc.

---

## 4. CFB — market by market (7 cards per game)

### 4.0 The EARLY regime — weeks 1-3
The opponent-adjusted model is **cold** in weeks 1-3. In EARLY weeks:
- Displayed FG numbers come from the **preseason-priors blend**, edges recomputed off it.
- **Contextual signals drive conviction** (returning production, portal influx, G5 dog
  wk1, roster-hype fade, opener under, coach-pace under...). Cold-model signals
  (`model_highedge_dog`, `premium_lay_fav`, `model_total_*`, `model_road_value`) are
  **suppressed** weeks 1-3 and wake at week 4.
- 1H cards are derived-display-only (1H total = 0.527 × pred total, 1H margin = 0.599 ×
  pred margin); the real 1H model takes over at week 4.
- `early_total_edge` and the tt_away_under early variant (below) are the only
  model-driven early bets.

### 4.1 Spread — CAN be a bet
- **Side**: model (or early blend) edge vs the close; ties break HOME.
- **Conviction comes 100% from the flags table** (`conv_for`): the strongest active
  signal on the pick's side sets tier + stake; mammoth if any flag is mammoth (5u).
  ~20 spread spots: `stack` (model × soft-book, ~72%, T1), `padded_road_fade` (~62-64%,
  T1), `g5_fade_after_loss` (~65%, T1), `premium_lay_fav` (~63-69%, T2), key numbers,
  conference structurals, `ret_prod_edge` (T2, 9/9 seasons)... full list in the audit.
- **Degenerate cap**: |edge| > 14 → display-only, unless an agreeing signal fires (a
  disagreeing signal renders as counter, never flips the pick side).
- No signal → projection only.

### 4.2 Total — CAN be a bet
- **`core_total_edge`** (**week 5+**; needs ≥4 played weeks of as-of ratings): frozen
  O/D lstsq (betas 2021-25, n=2708) vs the close. |edge| ≥ 4 →
  - base: **tracking 0.5u** (54.1%, 5/5 seasons)
  - line has moved **≥0.5 toward us** open→close: **T2 active** (58.1%, n=353, +10.9%)
  - moved **≥1.5 toward us**: **T1 active** (60.9-65.9%, 5/5 seasons 62-72%)
  - moved **≥2.5**: *never chase* — decays to ~48%
  - **T-24 re-tier** (`retier_steam_timing`, every capture inside 24h): late (h6→close)
    steam is the sharpest confirm (60.0%, 5/5 seasons); early-only steam that stalls is a
    head-fake (40.4%) and demotes.
- **`early_total_edge`** (**weeks 1-3**): preseason-CORE blend raw total vs close.
  |edge| ≥ 4 → tracking; **≥ 6 → T3 active** (57.9%, n=209; base 55.1%, 5/5 seasons).
  Spreads carry NO early model edge (48-51%) — display-only there stands.
- Plus contextual total signals (wind/conference/streak/style...) per the audit; model
  total signals (`model_total_under` ~58% T2 etc.) from week 4.

### 4.3 Team totals — CAN be a bet (validated gates)
- **Projection**: `(pred_total ± pred_margin)/2` vs the posted TT.
- **`tt_conv_key` frozen gates**: UNDER edge ≤ −3 → **T2** (~57%); OVER ≥ +4 **P5 only** →
  T2 (~58%); OVER ≥ +6 P5 → **T1** (~62%). **G5 overs are dead** — never an over play.
- **`tt_away_under`**: game-total under-edge ≤ −4 → AWAY team total UNDER = **61.3%
  (n=271, 61/60/62 by season, +16.9%)**, beats its parent FG under on the same games.
  **T2 from week 5** (ratings engine), **T3 weeks 1-3** (early-blend engine). HOME mirror
  is dead (books shade home TTs). Requires a posted TT line — auto-fires when books post.
- No posted line → card is display-only with the projection.

### 4.4 Moneyline — never a model bet
Display-only predicted winner + best price. One signal can attach: `home_dog_ml`
(small home dogs, +5.9% ROI 4/5 seasons, T3).

### 4.5 First-half spread / total / ML — CAN be bets (week 4+)
The vaulted 1H model (2025 live: 125 bets, 61.3%, +17.5%) with frozen rules
(`cfb_forecast.py`):
- **1H spread**: |model edge vs the 1H consensus line| ≥ **3** → bet that side, **T3 1u**
  (~54%). Card side is always the side that covers; label shows the model's number.
- **1H total**: uses **cross-book best numbers** — model ≥ 2 under the *highest* posted 1H
  total → UNDER at that book; ≥ 2 over the *lowest* → OVER (graded at best line). T3 1u.
- **1H ML (dog conversion)**: model 1H margin ≥ 2 toward a **plus-money** side (≤ +1200)
  → 0.5u track (+24% ROI, small n). Otherwise the card shows the predicted 1H leader.
- Weeks 1-3: all three cards render derived projections, display-only, no bets.

---

## 5. Time-gate master table

| Gate | What it controls |
|---|---|
| **CFB wk 1-3 (EARLY)** | blend drives displayed numbers; cold-model signals suppressed; contextual signals + `early_total_edge` (≥6 → T3) + `tt_away_under` (T3) are the only edges; 1H derived display-only |
| **CFB wk 4** | opponent-adjusted model + 1H model + model_* signals go live |
| **CFB wk 5** | `core_total_edge` + tt_away_under T2 (needs 4 played weeks of ratings) |
| **NFL wk 1-3** | totals model shows LEAN_EARLY display-only (no HC bets); 1H projections derived from FG shares until nflverse pbp publishes |
| **NFL wk 4** | totals HC bets begin; late-defense EPA gate opens (`mid_fade_good_defense` wk4-11) |
| **NFL wk 12+** | December-wall family: `late_matchup_under`, both TT matchup signals; `mid_fade` stops after wk11 |
| **Any game, T-24** | CFB steam re-tier ladder active every capture |
| **Any game, 72→24h / ≤6h** | NFL sharp-action windows (separate signals, separate records) |
| **T-60** | the close we grade vs and quote to users (≥1h to bet the number) |

## 6. What is deliberately NOT a bet (negative knowledge)

- NFL EXTREME totals (edge > 7): 50%/−5% — display "extreme lean," never bet.
- NFL ML, NFL TTs without a signal, all 1H cards without an M-signal.
- CFB G5 team-total OVERs; CFB home-TT under mirror of tt_away_under.
- "Follow sharp action" as a standalone bet on totals (−6.1%) or CFB spreads (45.9%).
- Naive line-movement following, both sports, every market (49-51% everywhere;
  fully-moved-by-h24 lines actively decay).
- CFB early-week spread model edges (48-51%).
- Standalone injury signals (priced by the close); public-betting data (we don't have it).
- Chasing steam ≥ 2.5 toward us (48%).

## 7. Production chain (how a bet reaches the app)

1. **Capture** (Render crons, 15-min) → `nfl_historical_odds` / `ncaaf_odds_history` (+ event odds).
2. **Weekly/daily generators** → slate `*_slate_games` (every model number + every line,
   with the live-capture fallback), → `*_slate_flags` (every fired signal with
   `bet_team`/`bet_direction`/`bet_line`, tier, stake, grade_line), → `*_slate_picks`
   (8 NFL / 7 CFB cards per game; sign guard refuses a card that contradicts its header).
3. **Post-capture hooks**: NFL sharp detector + CFB T-24 re-tier run after every capture.
4. **Grading**: daily cron grades finals → picks/props → `signal_performance` rebuilds
   each signal's public season-to-date record (kept separate from the all-time validated
   record — both are shown).

# Agent Payload Contract — NFL + CFB (the JSON the AI agents receive)

This is the **data contract** for what each personalized AI agent sees per game. It is **not** the
system prompt (that's `agent_system_prompts.v1_nfl` / `v1_cfb`); it's the shape of the JSON payload the
generation pipeline must build and hand to the model. The prompt teaches the vocabulary once; this payload
carries the per-game values.

**Core principle:** the agent payload is a **pregame-safe projection of the precomputed display contract**
(`nfl_dryrun_games` + `nfl_dryrun_picks`, documented in `CURSOR_NFL_PROMPT.md`), with each fired signal
enriched by its **definition** (`*_signal_defs`) and its **live season record** (`signal_performance`), plus
**NFL props that have a signal attached**. We do not invent new model math here — we subset an existing,
already-validated contract. Read `CURSOR_NFL_PROMPT.md` first; this doc only describes the *projection*.

---

## 0. Source tables (all on research project `jpxnjuwglavsjbgbasnl` today)

| Table | Role in payload |
|---|---|
| `nfl_dryrun_games` / `cfb_dryrun_games` | Per-game headline: lines for all 7 markets, model predictions, conviction, weather. |
| `nfl_dryrun_picks` / `cfb_dryrun_picks` | Per-market rows (the 7 cards) with `signals` jsonb (`action`/`stance`/`tier`), edge, conviction, recommendation. |
| `nfl_signal_defs` / `cfb_signal_defs` | Signal definitions: `display_name`, `one_liner`, `definition`, `why_it_works`, `bet_direction`, `typical_hit` (STATIC backtest). |
| `signal_performance` | LIVE season-to-date record per `signal_key` (`n`, `wins`, `losses`, `pushes`, `hit_rate`, `units`, `roi`, `last_week`). |
| `nfl_dryrun_props` | NFL only: player props with `flags` (P-codes). Join realized value via `nfl_player_props`. |
| `nfl_team_trends` / (cfb equiv) | Season-to-date ATS/OU/TT/1H rates + last-5 + game_log. |
| `nfl_matchup_history` | NFL only: last-5 head-to-head. |

> **Project-location caveat (must resolve before go-live):** these tables live on the research project
> `jpxnjuwglavsjbgbasnl`. The legacy agent builder reads from the "CFB Supabase" (per
> `scripts/run-agent-pick.mjs`). Whatever project the builder uses, these tables + `signal_performance` must
> be readable from it (replicate/sync, or point the builder at the research project). Tracked in task #46.

---

## 1. Slate pre-filter (THE overload control)

Do **not** ship every game. A CFB Saturday can be 40–60 games; lean payloads × 60 blows the context window,
and agents have confidence thresholds + max-picks so dead games add tokens for zero value.

**Rule: include a game in the payload only if it has at least one of:**
- a fired signal (`flags_active >= 1` OR `flags_tracking >= 1`), OR
- a model edge past threshold on any market (`conviction_tier != 'none'`).

Everything else is dropped. This applies to both sports; it matters most for CFB.

---

## 2. Per-game object (NFL + CFB, identical shape)

```jsonc
{
  "game_id": "...",
  "matchup": "Away Team @ Home Team",
  "away_team": "...", "home_team": "...",
  "kickoff": "2025-11-23T18:00:00Z",
  "weather": { "summary": "41°F, wind 18 mph", "icon": "wind", "indoors": false },  // NFL/CFB
  "public_betting": { "spread_split": "...", "ml_split": "...", "total_split": "..." }, // keep legacy: fade_public param depends on it
  "line_movement": [ /* legacy snapshots, keep for line-move personality logic */ ],

  // ---- VEGAS LINES for all 7 markets (consensus close; signed home-perspective for spreads).
  // Key is `vegas_lines` (shared V3 group name across all sports). `total` is a bare
  // NUMBER — the V3 submitPicks totals-rewrite reads vegas_lines.total as a number;
  // total prices live in sibling total_over_price / total_under_price. ----
  "vegas_lines": {
    "spread":      { "home": -5.5, "away": 5.5, "price": -110 },
    "moneyline":   { "home": -240, "away": 200 },
    "total":       43.5,
    "total_over_price": -110, "total_under_price": -110,
    "team_total":  { "home": 24.5, "away": 19.0, "home_over_price": -115, ... },
    "h1_spread":   { "home": -2.5, "price": -110 },
    "h1_total":    { "line": 22.5, "over_price": -110, "under_price": -110 },
    "h1_moneyline":{ "home": -150, "away": 130 }
  },

  // ---- MODEL PREDICTIONS (locked models; per market). Key is `model_predictions`
  // (shared V3 group name). predicted_team / ou_direction are flat leans the V3
  // slate builder reads directly. ----
  "model_predictions": {
    "predicted_team": "Houston Texans",                  // win_prob-favored side (slate lean)
    "ou_direction": "OVER",                              // fg_total_pick (slate lean)
    "predicted_score": { "home": 25.8, "away": 21.3 },   // fg_pred_home_pts / away_pts
    "spread":   { "model_line": -4.5, "edge": 1.0, "pick_side": "HOME", "cover_prob": 0.56 },
    "total":    { "predicted_total": 47.1, "edge": 3.6, "pick_side": "OVER", "tier": "LEAN" },
    "team_total": { "home_pred": 25.8, "away_pred": 21.3 },
    "h1":       { "pred_total": 22.0, "pred_margin": 1.1, "cover_tilt": 0.4 }  // 1H = display/paper-trade tier
  },

  // ---- CONVICTION (precomputed; do not recompute) ----
  "conviction": { "tier": "high", "top_market": "spread", "mammoth": false, "stake_units": 2.0 },

  // ---- SIGNALS firing on this game (the headline insight) ----
  "signals": [ /* see §3 */ ],

  // ---- TEAM TRENDS (curated slice, both sides) ----
  "trends": {
    "home": { "ats_pct": 0.58, "ats_record": "7-5", "over_pct": 0.50, "tt_over_pct": 0.55,
              "h1_ats_pct": 0.60, "h1_over_pct": 0.45, "last5_ats": ["W","L","W","W","P"] },
    "away": { ... }
  },

  // ---- HEAD-TO-HEAD (NFL only; last 5). Key is `h2h_recent` (shared V3 group name). ----
  "h2h_recent": [ { "date": "...", "result": "BUF 27-24", "ats": "HOME", "ou": "OVER" } ]
}
```

### Curated metric slice — what I deliberately INCLUDE vs EXCLUDE
**Include** (an analyst would cite these): the 7-market lines, model predictions + edges per market,
conviction, weather, public betting + line movement (personality params depend on them), and the team-trends
rates + last-5. **Exclude**: the deep model feature vector (power ratings internals, NGS tables, per-play
features). Reason: the **signals already distill those** — shipping raw features bloats the payload and is
redundant with the signal each feature fed into. The signal is the compression layer; trust it.

---

## 3. Signal object (the most important part)

Each entry in `signals[]` is the per-game signal projection from `nfl_dryrun_picks.signals`, **enriched**
with the definition + live record. This is what lets an agent say "this signal fired, here's why, and it's
hitting 64% / +18% ROI this season."

```jsonc
{
  "key": "tight_soft_ml_fade_home",
  "market": "spread",                      // which of the 7 markets it bets
  "display_name": "Tight Soft-ML Home Fade",
  "action": "Houston Texans (home)",       // READY per-game bet directive (names the team) — USE THIS
  "stance": "support",                     // support = agrees with model pick; counter = backs other side
  "tier": "active",                        // active = bettable; tracking = paper-trade only
  "one_liner": "...", "why_it_works": "...",   // from signal_defs (static reference)

  // STATIC backtest (from signal_defs.typical_hit) — the headline historical number
  "typical_hit": "62% / +18% ROI",

  // LIVE season-to-date (from signal_performance; null if no graded picks yet this season)
  "record": { "n": 14, "wins": 9, "losses": 5, "pushes": 0,
              "hit_rate": 0.643, "units": 2.1, "roi": 0.150, "last_week": 11 }
}
```

**How the agent must treat signals (spell this out in the prompt):**
- `action` is the ready, team-resolved directive — always use it, never the generic `bet_direction`.
- `stance="counter"` means the signal **opposes** the model pick — never present it as support.
- `tier="tracking"` = paper-trade only (1H markets, team totals, low-conviction K-signals). Mention as
  context, weight lightly, don't headline a bet on it.
- **Static vs live:** lead with `typical_hit` (the validated backtest). Treat `record` as confirmation, and
  **de-weight small samples** (`n < 10`) — a 2-1 live start does not override a 269-sample backtest.
- `record: null` (no graded picks yet) is normal early season — fall back to `typical_hit`.

---

## 4. Bet-type / market vocabulary (the 7 markets + props)

Agents must understand and be able to output all 7 game markets + player props. Output `bet_type` enum:
`spread | moneyline | total | team_total | h1_spread | h1_total | h1_ml | player_prop`.

| Market | selection format | odds source |
|---|---|---|
| spread | "Team ±X.X" (signed) | `-110` |
| moneyline | "Team ML" | `vegas_lines.moneyline.home/away` |
| total | "Over/Under X.X" | `-110` |
| team_total | "Team TT Over/Under X.X" | `vegas_lines.team_total.*_price` |
| h1_spread | "Team 1H ±X.X" | `-110` |
| h1_total | "1H Over/Under X.X" | `-110` |
| h1_ml | "Team 1H ML" | `vegas_lines.h1_moneyline.home/away` |
| player_prop | "Player Over/Under X.X <market>" | prop over/under price |

> **Honesty carryover from the display contract:** 1H markets, team totals, and moneyline are
> **display/paper-trade tier** in the current dryrun — the prompt should let agents *reference* them but lean
> their real bets on spread/total unless a high-conviction signal attaches. Mirror the `display_only` /
> `has_play` distinction from `CURSOR_NFL_PROMPT.md`.

> **⚠️ RUNTIME LIMITATION (current state, 2026-06-20):** the V3 generation runtime only accepts
> **`spread | moneyline | total`** as submittable `bet_type`s (`ALL_BET_TYPES` in `readTools.ts`;
> `submitPicks.ts` hard-types these three). `team_total`, `h1_*`, and `player_prop` ship in the payload as
> **read-only context** (reachable via `get_market_odds` / `get_signals` / `get_props`) but cannot yet be
> submitted as picks. Expanding the bettable vocabulary to the full 7 markets + props is a separate,
> deliberate change (touches `ALL_BET_TYPES`, `submitPicks.ts` typing + upsert conflict key, and the
> grading/settlement path) — do NOT assume agents can bet these until that lands.

---

## 5. Player props (NFL only) — props WITH a signal only

Do **not** ship every prop. Include a prop **only if it carries a curated P-flag** (from
`nfl_dryrun_props.flags`). Curated set (approved):

| Flag | Market | Trigger | Direction |
|---|---|---|---|
| P1 | pass_yds | line >5% above L5 form | OVER |
| P2 | pass_yds | line 5–20% below form | UNDER |
| P3 | pass_tds | TD line ≥40% above form | OVER |
| P4 | pass_yds/tds | no-history QB (Week 1) | UNDER |
| P5 | anytime_td | YES prob drifted down ≥5% | YES |
| P7 | rush_yds | very tough run D (wk≥5) | UNDER |
| P9 | pass_tds | 2 straight weeks under | OVER |
| P10 | receptions | line raised 2 straight weeks | UNDER |
| P12 | reception_yds | featured WR, line ≤ L3 avg | OVER (vaulted) |
| P13 | rush_yds | featured RB, line ≤ L3 avg | OVER (vaulted) |

- **P6** (ATD steam-up) is an **avoid warning**, not a bet — surface as `"avoid": true` context on the prop, never as a pick.
- **P8 dropped** (line-shop/CLV edge an agent betting one line can't execute).

Each prop object mirrors the signal shape: player, market, line, price, the flag's def + `typical_hit` +
live `record` from `signal_performance`, and `direction`.

> **Prerequisite (task #43):** only P12/P13 are currently registered in `nfl_signal_defs` + graded in
> `signal_performance`. P1,P2,P3,P4,P5,P7,P9,P10 must be registered (def + direction + typical_hit) and graded
> before they can carry a record. Until then they can ship with `typical_hit` but `record: null`.

---

## 6. Excluded from the payload (and why)
- `final_*`, `h1_home/h1_away`, `result` — **validation actuals; never pregame.**
- Raw model feature vectors / NGS tables — redundant with signals (§2).
- Props without a signal — volume with no edge.
- Internal `source` fields on flags — implementation detail.

---

## 7. CFB parity
Same per-game shape and same §1 pre-filter, reading the `cfb_*` tables. Differences: **no player props**, **no
H2H card**, CFB signal catalog (spread 14 / total 13 / team_total 1 / h1 ×3). The CFB/VFB thread writes
`v1_cfb` against the identical scaffolding — this payload contract is shared so both prompts target one shape.

# 15 — V3 Agent Personality Question Set (redesign)

**Status:** Design spec — V3 prep, ships with V3 (NOT live until then). This is the
SOURCE OF TRUTH that the agent-creation screens (web / mobile / iOS) implement.
Supersedes the V2 set in [02_PERSONALITY_PARAMS.md](02_PERSONALITY_PARAMS.md) when V3
ships. See [13_CROSS_SPORT_AND_PARLAYS.md](13_CROSS_SPORT_AND_PARLAYS.md).

## Design principles
- V3 is **agentic** (reads data tools + reasons), so the set is **simplified**: high-level
  range dials + one free-text box, not the V2 ~27 micro-toggles. The agent's judgment fills gaps.
- **Mostly range (1–5) questions**, a few toggles, exactly **one** open-ended text box.
- **Cross-sport allowed** (runs on V3). Sport-dependent questions are **grouped by sport**.
- **Signal-gated props** — agents only bet props that have a validated signal attached.

## The question set

### A. Identity & setup (not personality)
Name · emoji · color · **Sports** (multi-select, any combination → V3 engine) · **Archetype** (optional preset that pre-fills the dials).

### B. Core style — range 1–5 (always shown)
| Param | Question | Drives |
|---|---|---|
| `risk_tolerance` | Risk tolerance | stake sizing / variance band |
| `confidence_threshold` | Selectivity (how high the edge bar) | confidence floor |
| `underdog_lean` | Favorite ↔ underdog | side lean |
| `over_under_lean` | Over ↔ under | totals lean |
| `max_picks_per_day` | Max plays per slate | volume |

### C. Markets — per-sport allowlist (multi-select, grouped by sport)
Stored as `allowed_markets: Record<sport, MarketKey[]>`. The UI shows, **per selected sport**,
that sport's available markets as checkboxes — "in NFL bet these; in NBA bet these." Default
all-on. **Replaces** the V2 `preferred_bet_type`. Enforced in the submit validators (a pick
outside the allowlist is rejected). **Parlay legs draw only from allowed markets.**

| Sport | Available markets |
|---|---|
| **NFL** | FG ML · FG Spread · FG Total · 1H ML · 1H Spread · 1H Total · Team Total · **Player Props** (signal-gated) |
| **CFB** | FG ML · FG Spread · FG Total · 1H ML · 1H Spread · 1H Total · Team Total |
| **NBA / NCAAB** | FG ML · FG Spread · FG Total · 1H ML · 1H Spread · 1H Total · Team Total *(1H + Team Total land by NBA '26-27)* |
| **MLB** | FG ML · FG Run Line · FG Total · F5 ML · F5 Run Line · F5 Total *(no team totals yet)* |

Market keys: `fg_ml` `fg_spread` `fg_total` `h1_ml` `h1_spread` `h1_total` `f5_ml` `f5_spread`
`f5_total` `team_total` `prop`. MLB "spread" renders as **Run Line**. Player props = `prop`,
**NFL only** for now (that's where the signals live) and **signal-gated** (only props with an
attached validated signal are eligible; `get_props` already surfaces the signal).

### D. What it trusts — range 1–5 (each maps to a V3 tool)
| Param | Question | Tool | Shown for |
|---|---|---|---|
| `trust_model` | Trust the WagerProof model | get_model_predictions | all |
| `trust_signals` | Lean on validated signals | get_signals | all *(new)* |
| `public_lean` | Public betting: fade ↔ follow | get_public_betting | all *(replaces fade_public + threshold)* |
| `trust_polymarket` | Trust prediction markets | get_polymarket | all |
| `respect_line_movement` | Respect line movement / sharp money | get_line_movement | all *(new)* |
| `weather_sensitivity` | Weather impact | get_weather | football + MLB |
| `trust_team_ratings` | Trust team ratings | get_team_ratings | basketball |

### E. Timing — **NFL / CFB ONLY** *(new)*
| Param | Question | Options |
|---|---|---|
| `line_timing` | When does it bet? | **Early** (trust openers; grab value before the market moves; accept injuries/weather aren't final) · **Balanced** · **Late** (wait for line movement + injury reports + weather) |

Drives both the agent's opening-line-value stance **and** when it should generate (early → Tuesday
on openers; late → game-day). Football-only because daily sports have no multi-day line window.

### F. Staking style *(new)*
| Param | Question | Options |
|---|---|---|
| `staking_style` | How it sizes stakes | **Flat** (same units every pick) ↔ **Scaled** (bigger on high conviction) |

### G. Parlays *(new — replaces `parlay_appetite`)*
| Param | Question |
|---|---|
| `parlays_enabled` | Make parlays? (yes/no) |
| `max_parlay_legs` | If yes: max legs (**2–4**) |

Legs draw only from the agent's allowed markets (incl. signal-gated props).

### H. Odds limits — **straights only**
| Param | Question | Note |
|---|---|---|
| `max_favorite_odds` | Don't lay a favorite worse than… | straight picks only — **NOT** applied to parlay legs |
| `min_underdog_odds` | Don't take a dog shorter than… | straight picks only |

Rationale: parlay legs routinely include chalk, and it's the *combined* price that matters, so
per-leg odds caps don't apply.

### I. The one open-ended box
| Param | Question |
|---|---|
| `betting_philosophy` | Betting philosophy / special instructions (free text, woven into the prompt verbatim) |

Replaces the V2 four-field custom_insights (philosophy / edges / target / avoid) with one box.

## Data-model changes (vs the V2 set)
- **New params:** `allowed_markets` (per-sport), `line_timing` (FB only), `staking_style`, `parlays_enabled`, `max_parlay_legs`, `trust_signals`, `respect_line_movement`, `public_lean`.
- **Changed:** props become a market (`prop`, signal-gated); custom_insights → single `betting_philosophy`.
- **Replaced:** `preferred_bet_type` → `allowed_markets`; `parlay_appetite` → `parlays_enabled` + `max_parlay_legs`; `fade_public`+`public_threshold` → `public_lean`.
- **Proposed cuts (simplify — finalize during wiring so steering doesn't break):** `ride_hot_streaks`, `fade_cold_streaks`, `regress_luck`, `pace_affects_totals`, `upset_alert`, `polymarket_divergence_flag`, `weather_impacts_totals`, `fade_back_to_backs`, `chase_value`, `weight_recent_form`, `trust_ats_trends` — folded into the trust dials + free-text + the agent's judgment.

## Wiring checklist (per surface — when this ships, staged as V3 prep)
- **Data model:** `src/types/agent.ts` (interface + Zod + defaults) · `wagerproof-mobile/types/agent.ts` · iOS `AgentPersonalityParams.swift`.
- **Web screens:** `src/components/agents/creation/Screen3_Personality.tsx` (core + staking + timing) · a new **Markets** step/section (per-sport allowlist) · `Screen4_DataAndConditions.tsx` (trust dials, sport-gated).
- **Mobile / iOS:** mirror the screens in `wagerproof-mobile/components/agents/creation/` and `…/Features/Agents/Creation/Step*View.swift`.
- **Sport-gating:** `getConditionalParams()` in `agent.ts` (+ mobile mirror) — per-sport market sets, weather (FB+MLB), team_ratings (basketball), `line_timing` (FB only).
- **Presets:** `supabase/migrations/*seed_preset_archetypes.sql` — values for the new params per archetype.
- **V3 edge fn (steering + submit):** enforce `allowed_markets`, `line_timing`, `staking_style`, parlays, and the signal-gated `prop` path.

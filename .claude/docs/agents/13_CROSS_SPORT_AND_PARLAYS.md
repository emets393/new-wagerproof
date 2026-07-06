# 13 — Cross-Sport Agents & Parlays (V3)

**Status:** Decisions locked 2026-06-21; largely built. Backend Part B is live (parlay tables `20260622000001-5`, `submit_parlay` tool, drop-and-reprice grading, performance union) and the iOS client ships parlay support end-to-end as of 2026-07-01 (see the file-by-file list below — web parlay rendering is the remaining client gap). **Target engine: V3 only** (`process-agent-generation-job-v3`). V2 is unchanged by this work.

## What & why

Two interlocking features for the V3 agentic engine:

1. **Cross-sport agents** — remove the single-sport-family restriction so one agent can cover NFL + NBA + MLB, etc. This is only safe on V3: V2 enforces a "football wall" (`computeEffectiveSports`) and routes to per-family DB prompts, so a cross-family agent on V2 silently loses its NFL/CFB games. V3 has neither constraint (in-code prompt + on-demand tools), so cross-family agents are **gated to V3**.
2. **Parlays** — agents can submit multi-leg parlays (single- or multi-sport, driven by a personality dial). Multi-sport parlays depend on cross-sport agents existing, so the two ship together.

See [10_GENERATION_V2_QUEUE.md](10_GENERATION_V2_QUEUE.md) for the queue and [agent-sport-family-rule](../../) for the original (now-reversed-for-V3) family rule.

## Decisions locked (2026-06-21)

| Decision | Choice |
|---|---|
| Cross-family agents | Allowed, **forced to V3 engine**. Single-family stays on V2. |
| Parlay storage | **New tables** (`avatar_parlays` + `avatar_parlay_legs`) — leave `avatar_picks` untouched. |
| Push-leg handling | **Drop & re-price** — a pushed leg falls out, parlay re-prices on survivors. |
| Sport scope | **All five**, incl. NFL/CFB → requires extending the grader to football. |

---

## Part A — Cross-family agents gated to V3

**Principle:** correctness reduces to writing the right `engine_version` at enqueue. Dispatch *and* claim are already walled (`...WHERE engine_version = 'v2'`/`'v3'`), so a correctly-tagged run can never reach the wrong worker.

**Changes:**

1. **SQL family classifier** (new — only the TS `shared/sportFamily.ts` exists; Postgres can't import it). Add an `IMMUTABLE` helper, kept in lockstep with `SPORT_FAMILIES` in `src/types/agent.ts`:
   ```sql
   -- public.agent_family_count(text[]) → COUNT(DISTINCT family) over unnest(preferred_sports)
   -- football={nfl,cfb}, basketball={nba,ncaab}, baseball={mlb}; > 1 ⇒ cross-family ⇒ V3
   ```
2. **Branch `engine_version` at enqueue:**
   - Manual: [agent-authorized-action-v1/index.ts:159](../../supabase/functions/agent-authorized-action-v1/index.ts) — `useV3 = body.engine_version === 'v3' || agent_family_count(preferred_sports) > 1`. (Needs to load `preferred_sports`, or push the decision into the RPC, which already locks the avatar row `FOR UPDATE`.)
   - Auto: `enqueue_due_auto_generation_runs_v2` bulk insert — `CASE` to set `engine_version='v3'` for cross-family rows.
3. **Relax the frontend rule** in `src/types/agent.ts`: drop the `.refine(isSingleSportFamily)` on `CreateAgentSchema.preferred_sports`; make `toggleSportSelection` purely additive (delete the `sameFamily` reset). **Keep** `SPORT_FAMILIES`/`isSingleSportFamily` as a *soft* signal — it now predicts "runs on V3" for a UI hint, not a hard gate. Update the Screen1 banner copy.
4. **Prompt:** one line in `v3SystemPrompt.ts` personality block (mirrors the `mlbOnly` conditional): `- You cover: NFL, NBA, MLB. Apply each sport's lenses to its own games; don't cross signals between sports.` `deriveSteeringProfile` already ORs per-sport lens votes for multi-sport agents — no change needed there for v1.

**Caveat:** cross-family agents only generate when the V3 circuit breaker (`v3_circuit_state`: spend cap, run cap, kill switch) is enabled. While V3 is in testing, they're live exactly when V3 is.

---

## Part B — Parlays

### Storage (new tables)

```
avatar_parlays
  id uuid PK · avatar_id uuid FK→avatar_profiles (CASCADE)
  sport text            -- single sport, or 'multi' for cross-sport
  legs_count int
  combined_odds text     -- American; product of leg decimal odds, recomputed at grade time if a leg pushes
  units numeric(3,1)     -- one stake for the whole ticket
  confidence int 1-5 · reasoning_text text
  ai_decision_trace jsonb · ai_audit_payload jsonb · archived_personality jsonb
  result text CHECK (won|lost|push|pending) DEFAULT 'pending'
  graded_at timestamptz · created_at timestamptz · is_auto_generated bool

avatar_parlay_legs
  id uuid PK · parlay_id uuid FK→avatar_parlays (CASCADE)
  game_id text · sport text · matchup text · game_date date
  bet_type text CHECK (spread|moneyline|total|prop|team_total) · period text CHECK (full|f5|h1)
  prop_player text · prop_market text · prop_line numeric · prop_direction text  -- prop legs only (NFL)
  pick_selection text · odds text          -- individual leg American odds
  archived_game_data jsonb
  leg_result text CHECK (won|lost|push|pending) DEFAULT 'pending' · graded_at timestamptz
```

Rationale: reusing `avatar_picks` would force relaxing its `UNIQUE (avatar_id, game_id, bet_type)` key and the per-row payout RPC — both load-bearing for the live straights path. RLS mirrors `avatar_picks` (owner + public-avatar read).

### `submit_parlay` tool

New terminal tool alongside `submit_picks` (in `process-agent-generation-job-v3/tools/`). Schema mirrors `buildSubmitPicksSchema` but each item carries `legs[]` (each leg = `game_id`, `bet_type`, `period`, `selection`, `odds`) plus parlay-level `units`, `confidence`, `reasoning`. It **reuses the per-leg machinery already in `submitPicks.ts`**:

- **Grounding gate per leg** — each `(game_id, bet_type)` must have been fetched by a read tool first (`ctx.deepFetched`).
- **Correlation guards:** (1) ≤1 non-prop leg per game (full-game/1H/team-total; props exempt); (2) **volume-market solo guard** — a `player_pass_attempts` / `player_rush_attempts` / `player_pass_completions` leg must be the ONLY leg from its game (they're the game-script latent factor, correlated with everything in the game), enforced via `gameLegCounts`/`volumeGames` → `volume_market_solo_only`. See [16_PARLAY_AGENTS.md](16_PARLAY_AGENTS.md).
- Per-leg validators: totals→Vegas-line rewrite, MLB ML→runline swap, team-in-selection.
- Compute `combined_odds` from the legs; clamp `units` once via `clampUnits`.
- Write one `avatar_parlays` row + N `avatar_parlay_legs`. Only offered to the model when `parlay_appetite ≥ 2`.

### `parlay_appetite` steering dial

A 1–5 personality dial modeled exactly like `risk_tolerance` (always-on, not sport-gated):

- **Schema/default:** add `parlay_appetite: Scale1To5Schema` to `PersonalityParamsSchema` + `DEFAULT_PERSONALITY_PARAMS` (default `1` = conservative) + the `PersonalityParams` TS interface, all in `src/types/agent.ts`.
- **Steering:** `deriveSteeringProfile` reads it (with a Deno-side default via the `num(p.parlay_appetite, 1)` pattern) and produces a `parlayPolicy` prose string + `maxParlayLegs`, cloning the `unitPolicy` pattern (deriveSteeringProfile.ts:176). Add both to the `SteeringProfile` interface.
- **Prompt:** inject `- Parlay policy: ${steering.parlayPolicy}` after the unit-sizing line in `v3SystemPrompt.ts`. Appetite 1 ⇒ "submit only straight single-game picks; never combine legs" and the `submit_parlay` tool is withheld.
- **Archetypes (optional):** add `"parlay_appetite": N` to the JSONB in `20260205000004_seed_preset_archetypes.sql` if presets should vary (e.g. `plus_money_hunter` high, `chalk_grinder` 1).

### Grading & payout (drop & re-price)

- **Per leg:** reuse `gradePickFromView` to set each `avatar_parlay_legs.leg_result`.
- **Roll-up** (once all legs graded): all `won` → parlay `won`; any `lost` → `lost`; a `push` leg **drops out** and the parlay re-prices on survivors (recompute `combined_odds` from the won legs); all `push` → `push`.
- **Payout:** lives in a parlay-aware aggregate feeding `avatar_performance_cache` (the grader writes results, not units — same split as straights). Net units = `units × (combined decimal odds − 1)` on a win, `−units` on a loss, `0` on a full push. Parlays must NOT be summed by the existing per-row straight-pick aggregate (would double-count leg stakes) — extend `recalculate_avatar_performance` to union both sources, and add a `parlay` key to `stats_by_bet_type`.

---

## NFL/CFB grading (in scope per decision #3) — confirmed mechanism

The grader [grade-avatar-picks/index.ts:749](../../supabase/functions/grade-avatar-picks/index.ts) hard-filters `.in('sport', ['nba','ncaab','mlb'])` — **straight NFL/CFB picks don't grade today**. Required for football straight picks *and* football parlay legs.

**Results source (confirmed against live DB, 2026-06-21):** finals live on the dryrun game row the agent picked from — `nfl_dryrun_games.final_home / final_away` (+ `h1_home / h1_away` for first half), and `cfb_dryrun_games.final_home / final_away` (CFBD-sourced). Pregame-null, populated post-game, keyed by `game_id`. The agent's pick already stores `game_id`, so grading is a row lookup → read `final_*` → compute the result. **Do NOT use the `all_game_results` view** (that's the NBA/NCAAB source); grade NFL/CFB off the dryrun tables — they ARE the 2026 production contract.

**Grade math** (identical to `dryrun_wk12_games.py:grade_play` and the existing `gradePickFromView`): spread = picked-side margin + signed line (`>0` won, `<0` lost, `=0` push on whole numbers); total = `final_home + final_away` vs the picked line; moneyline = winner (higher final). The grader computes from raw finals, so it grades spread/total/ML itself — it does **not** depend on the dryrun pick layer's precomputed `result` (which only covers FG spread+total on NFL, and is unpopulated on CFB). Watch the enum: dryrun picks use `win/loss/push`; `avatar_picks` use `won/lost/push/pending` — emit the avatar enum.

**1H + team-total markets (stakeable, migration `20260622000005`):** NFL/CFB agents can stake first-half (`period='h1'`, with spread/moneyline/total) and per-team totals (`bet_type='team_total'`, full-game only, team named in `pick_selection`). `gradePickFromView` routes `h1` to the `football_game_results` `h1_*` fields (ML→`h1_ml_result`; spread/total graded score-based off `h1_home_score`/`h1_away_score`), and grades `team_total` against the named team's full-game score (`home_score`/`away_score`) vs the picked line (push on a whole-number tie). Submit-side line lookups read `vegas_lines.first_half.total_close` (1H total) and `vegas_lines.team_totals.{home,away}_close` (team total) off the dryrun formatter. Both flow through the same straight + parlay-leg grading paths — no separate grader.

**⚠️ The real dependency is upstream, not in the grader.** The grade logic + table contract exist, but the live pipeline that *fills* `final_*` is not yet wired for production:
- `dryrun_wk12_games.py` (which computes finals + grades) is a **hand-run research script reading historical parquet** — not on any Render cron.
- The production `cfb_automation` cron currently writes NFL results to a **different schema** (`nfl_{slug}_games` via a TeamRankings scrape), not `nfl_dryrun_games.final_*`. This is the "NFL needs `nfl_data_py` before Sept" gap.
- MLB is the only sport with a live results→grade cron today (`mlb_fill_results.py` + the `grade_mlb_player_prop_picks` RPC) — the template NFL/CFB will follow.
- Separately, `signal_performance` (the per-signal live W/L/ROI the agent payload *reads*) has **no writer anywhere** — adjacent unbuilt grading job.

So: build the grader extension as above (reads `final_*` by `game_id`), but the blocker for it actually grading in 2026 is **productionizing the dryrun build to populate `final_*` live**. Until then the grader correctly leaves NFL/CFB picks `pending`.

> **Timing:** only MLB is in-season in June. Cross-sport + parlays can be built and unit-tested now (MLB live), but full multi-sport exercise waits for the fall overlap. NFL/CFB finals-fill + grading must be live before Week 1 (Sept 2026).

---

## Build phases

1. **Cross-family gating (Part A)** — independent, small, no schema risk; testable on MLB + any today.
2. **NFL/CFB grading extension** — independent of parlays; unblocks straight football agents and football parlay legs.
3. **Parlay infra (Part B)** — storage → `submit_parlay` → `parlay_appetite` → grading roll-up. Start single-sport (MLB, live), then enable cross-sport.

## File-by-file change list

| Layer | File | Change |
|---|---|---|
| DB | `supabase/migrations/<new>_agent_family_classifier.sql` | `agent_family_count()` helper |
| DB | enqueue RPCs (`...v2_queue.sql`, `agent_authorized_action`) | branch `engine_version` on cross-family |
| DB | `supabase/migrations/<new>_avatar_parlays.sql` | two tables + RLS + indexes |
| DB | `recalculate_avatar_performance` | parlay-aware payout union |
| Edge | `agent-authorized-action-v1/index.ts` | force V3 for cross-family |
| Edge | `process-agent-generation-job-v3/tools/submitParlay.ts` (new) | parlay submit tool |
| Edge | `.../tools/readTools.ts` | register `submit_parlay` (gated by appetite) |
| Edge | `.../pickSchemaV3.ts` | `buildSubmitParlaySchema` |
| Edge | `.../deriveSteeringProfile.ts` | `parlayAppetite`/`parlayPolicy`/`maxParlayLegs` |
| Edge | `.../v3SystemPrompt.ts` | multi-sport line + parlay-policy line |
| Edge | `grade-avatar-picks/index.ts` | NFL/CFB results + parlay leg/roll-up grading |
| Web | `src/types/agent.ts` | relax family refine; add `parlay_appetite` |
| Web | `src/components/agents/creation/Screen1_SportArchetype.tsx` | additive sport toggle + copy |
| Web | parlay rendering | multi-leg ticket UI (separate UI task, still pending) |
| DB | `supabase/migrations/20260701000000_agent_parlays_read_rpcs.sql` | ✅ `get_agent_detail_snapshot_v3` returns `todays_parlays`, `get_agent_picks_page_v3` returns `parlays` (first page only, legs embedded) — same `v_can_view_picks` gate as picks |
| iOS | `WagerproofKit/.../WagerproofModels/AgentParlay.swift`, `AgentBetItem.swift` | ✅ `AgentParlay`/`AgentParlayLeg` models (tolerant decode, legs embedded) + pick/parlay union with shared `netUnitsContribution` payout math |
| iOS | `WagerproofKit/.../AgentPicksService.swift`, `AgentDetailStore.swift` | ✅ direct-RLS parlay reads (`fetchParlays`/`fetchTodaysParlays`/`fetchGradedParlayHistory`/`fetchUpcomingParlaysFeed`) + store state (`todaysBetItems`, `fullBetHistory`) with the same owner/public dual-path as picks |
| iOS | `Features/Agents/Components/AgentParlayTicket.swift` + folder/rail/chart/timeline | ✅ variable-height parlay tickets (stack/expanded/mini) interleaved with picks in the Today's rail, history rolodex, and performance chart (one point per settled ticket); `parlay_appetite` slider in creation Step 3 + Settings |

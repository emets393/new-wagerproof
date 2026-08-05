# Agent Consensus — "N agents on <side>" + the green Bet flag

One row on each `/games` feed card showing what the public AI agents actually bet,
and a green **BET** flag on the rare games where they strongly agree.

## What renders

Three tiers, decided server-side:

| Tier | Condition | Treatment |
|---|---|---|
| 2 | `flagged = true` | emerald strip: avatar stack · "39 agents on OVER 7.5" · "100% agree" · **BET** |
| 1 | has agents, not flagged | muted inline avatar stack + bare count ("45 agents") |
| 0 | no agents | nothing |

Tier 1 states a count and makes no claim. Only Tier 2 is coloured.

## Why the flag keys off AGREEMENT, not participation

The obvious rule — "flag any game an agent bet" — is degenerate. Measured over 10
MLB slates (2026-07-12 → 07-26, 1,555 public+active agents):

| Rule | Avg flags/day | Flag rate |
|---|---|---|
| ≥1 agent | 12.4 | **96%** |
| ≥10 agents | 5.8 | 45% |
| ≥15 agents | 4.8 | 37% |
| **≥max(8, 8% of day) on one side & ≥55% agree** | **3.0** | **21%** |

Agents bet nearly every game on the slate, so a participation count tracks *how
many agents ran that day*, not how notable the game is. Even `≥15 agents` still
flags 37% of a slate.

Worse, participation actively misleads. On 2026-07-26 Cleveland @ Tampa Bay had
**45 agents but only 31% on the same side** (27 ML / 15 total / 6 spread) — while
Arizona @ Washington had 16 agents with **14 on Under 10 (88%)**. On 5 of 10 days
the most-bet game was *not* the strongest-consensus game.

## The rule

```
flagged = side_agents >= max(8, ceil(0.08 * day_picking_agents))
          AND side_agents / market_agents >= 0.55
```

- `market_agents` is the distinct-agent population for the winning selection's
  market (`bet_type × period`), not all agents who bet any market on the game.
- `day_picking_agents` is the **sum of per-game distinct agent counts**
  (agent-games), not distinct agents across the slate. That is the denominator
  the 8% was calibrated against — swapping it silently re-tunes the flag rate.
- The relative term makes the bar scale as the agent population grows, so it
  won't need re-tuning after growth.
- **55%, not 65%.** At 65% the rule goes *empty* on some slates (2026-07-26
  included). At 55% it produced 1–5 flags/day and was never empty across the
  backtest.

Thresholds are RPC parameters, so the rate can be retuned from the client
without a migration.

## Backend

`supabase/migrations/20260726140000_game_agent_consensus.sql`

```sql
get_game_agent_consensus(
  p_sport      text,
  p_game_dates date[],
  p_min_share  numeric DEFAULT 0.55,
  p_rel_share  numeric DEFAULT 0.08,
  p_min_agents integer DEFAULT 8
) RETURNS TABLE (
  game_id text, game_date date, agents int, side text, side_agents int,
  market_agents int, market_label text, agreement numeric, threshold int,
  flagged bool, avatars jsonb
)
```

`avatars` is up to 4 `{avatarId, name, emoji, color}` objects drawn from the
**winning side only**, so the faces match the claim. `color` is a hex string or
`"gradient:#aaa,#bbb"`.

### Why SECURITY DEFINER

`avatar_picks` is RLS-gated and **the anon key sees zero rows** — a direct
PostgREST select returns nothing for signed-out *and* signed-in users. (An
unfiltered anon select doesn't even error, it times out.) The RPC computes the
aggregate server-side over the public-agent population; only counts and the four
stack avatars cross the wire, never raw picks. Granted to `anon` +
`authenticated`, mirroring `get_agent_pick_overlap_batch`.

### Why there is no SQL join

Picks live in **MAIN** (`gnjrklxotmbvnxbnnqgq`); the games feed comes from
**CFB** (`jpxnjuwglavsjbgbasnl`). Separate Supabase projects, no FK, no join.
The RPC returns counts keyed by `game_id` and each client merges by map lookup.

**The merge must be a left join.** Picks exist before predictions populate, so a
game with no consensus row is normal, not an error.

### Join key

Verified 2026-07-26: MLB pick `game_id` matches the feed's id at **100%**
(14/14). Not luck — the V3 slate builder and the web feed read the *same* table
(`mlb_games_today`) and both derive `String(game_pk)`. V3 also hard-gates every
pick against the slate id set (`agents-v3/src/loop/tools/submitPicks.ts:83`) and
writes it verbatim, so stored id ≡ slate id by construction.

NFL format is verified (all 301 picks in the 2026-07-12 batch are canonical
`2025_12_IND_KC` nflverse ids matching `nfl_predictions_epa.training_key`) but
**unvalidated against a live feed** — the V3 NFL slate reads
`nfl_predictions_epa` while the web feed reads `v_input_values_with_epa`,
different tables with different row sets. Re-validate at NFL go-live.

## Clients

| Platform | Entry point |
|---|---|
| Web | `src/services/agentConsensusService.ts` → `src/features/games/hooks/useAgentConsensus.ts` → `AgentConsensusStrip.tsx` |
| iOS | `WagerproofServices/AgentConsensusService.swift` → `WagerproofStores/AgentConsensusStore.swift` → `Features/GameCards/Components/AgentConsensusStrip.swift` |
| Android | `core/services/AgentConsensusService.kt` → `core/stores/AgentConsensusStore.kt` → `app/features/gamecards/AgentConsensusStrip.kt` |

### Surfaces per platform

| Surface | Web | iOS | Android |
|---|---|---|---|
| Games feed card strip | ✅ | ✅ | ✅ |
| Game-detail widget | ✅ `features/games/detail/sections/AgentConsensusSection.tsx` | ✅ `Features/GameWidgets/AgentConsensusSection.swift` | ❌ |
| Outliers matchup tile | ✅ `features/outliers/components/MatchupTile.tsx` | ❌ | ❌ |

The detail widget is deliberately **sport-agnostic and first** in the detail
content on both web and iOS — it answers "what does the crowd think of this
game", which frames every per-sport section under it. On iOS it goes in all five
`*GameBottomSheet.swift` content blocks; the shared
`WidgetCollapsingSection` has no headline slot, so the headline sentence is the
first line of the body (17pt semibold) rather than shell chrome, and the emerald
"Bet" pill is the shell's existing `.verdict` capsule instead of web's solid
pill with a white dot.

Every client fetches **once per slate**, not per card — the threshold needs the
whole slate's volume, so it cannot be derived inside a per-sport adapter.

- **Web** fetches from `GamesFeedPanel` and passes consensus to `GameListCard`
  as a prop rather than carrying it on `GameFeedItem`, which keeps the five
  sport adapters untouched.
- **iOS** fetches from `GamesView` via a `.task(id:)` keyed on
  (selected sport, distinct dates on the board), and threads the row through
  each `*GameCard` adapter into `GameRowCard.Model.consensus`. The store itself
  lives at `MainTabView` (shell-hoisted, like `PropsStore`) so the feed and the
  detail widget share ONE slate fetch; `GamesView` reads it from the environment
  with a local fallback for the screenshot harness. The detail widget takes no
  prop — it reads the same store and calls `ensureLoaded(sport:date:)` in its
  own `.task`, which is a no-op when the feed already covered that date and the
  only fetch when detail is reached from Search/WagerBot. The strip renders
  below `extraInfoRow` in **both** card layouts (standard + breakdown).
  `Features/Games/GameConsensusKey.swift` holds the per-sport id mapping — NFL
  and CFB join on `trainingKey`, *not* the model's `id`, because the legacy
  fetch prefers the input view's own primary key. Search reuses the same cards
  but passes no consensus, so its strips stay hidden.
- **Android** mirrors iOS: `GamesScreen` computes the distinct dates with
  `remember(sport, store.games)` and drives a `LaunchedEffect` into
  `AgentConsensusStore`, then each `*GameCard` adapter takes an optional
  `consensus` parameter that lands on `GameRowCardModel.consensus`. The strip
  renders after `BottomRow` in **both** layouts. `features/games/GameConsensusKey.kt`
  is the port of `GameConsensusKey.swift` (same NFL/CFB `trainingKey` rule).
  The store lives beside `GamesStore` in the graph rather than inside it —
  `GamesStore` talks to the CFB project, this talks to MAIN. Search passes no
  consensus (the parameter defaults to null), so its strips stay hidden.

TTL is 90s (vs the feed's 5min): counts move through the day as agents
generate — roughly 1 new pick/minute on a busy MLB slate — while the slate does not.
iOS and Android pull-to-refresh force past that TTL; a failed RPC is not cached,
so the next tick retries instead of showing nothing for 90s.

Failure is non-fatal everywhere: no strip, feed renders normally.

### Don't merge BET into the model badge row

On native, `convictionBadges` / `ConvictionBadges` already carries MAMMOTH PLAY /
High Conviction / N Signals. MAMMOTH is a **model** signal; BET is a **crowd**
signal. Putting them in one wrap group makes the card imply the model and the
agents agree when they may not. The consensus strip gets its own row. (On
Android there is also a documented height-blowup risk around
`GameRowCard.kt:443` if that bottom row is flattened.)

For the same reason both native apps use Tailwind emerald-500 (`#10B981`) for
the strip and not `appPrimary` (green-500) — that green already means MODEL
signal on the card (O/U lean, positive edge). On Android the three shades are
tokens (`appConsensusEmerald` / `…Text` / `…Deep` in `AppColors`), never inline
hex.

## Known limitations

- **`pick_selection` is not normalized.** It sometimes embeds odds — "Kansas
  City Royals +160" vs "Cincinnati Reds ML" are different strings for the same
  kind of bet, which fragments agreement and makes the flag *under*-fire. Left
  as-is deliberately: the thresholds above were calibrated on unnormalized
  strings, so renormalizing without re-running the backtest would ship untested
  numbers. Fixing this is a follow-up that requires re-calibration.
- **First-5 (F5) sides stay separate** from their full-game equivalent. "Twins
  F5 ML" is a genuinely different bet from "Twins ML"; folding them would let a
  card claim agreement on a line nobody agreed on. Cost: it splits agreement on
  what a user might read as one opinion.
- **Not filtered on `result = 'pending'`** — games grade through the day and
  dropping graded picks would make the flag vanish from a card still on screen.
  `game_date` is what bounds the query.
- **iOS has no Outliers-tile consensus surface.** Web shows the row on
  `MatchupTile`; iOS's Outliers board does not. `AgentConsensusStore.ensureLoaded(sport:dates:)`
  (the multi-date variant) exists for exactly that grid and currently has no
  caller. Android has neither the Outliers tile nor the detail widget.
- **MLB-only in practice today.** NFL/CFB feeds are empty and NBA/NCAAB are
  stale (offseason as of 2026-07-26), so only MLB exercises this path. On iOS
  the NFL/CFB feeds additionally serve the **2025-dated dry-run slates**, so
  their consensus call asks for 2025 dates and correctly returns nothing —
  expect no strip there until the live 2026 feeds are back.
- **Web and iOS derive the CFB key differently — resolve before CFB go-live.**
  Web uses `cfb_dryrun_games.game_id` (`cfbGames.ts:563`); iOS prefers
  `trainingKey`, falling back to `uniqueId`/`gameId` (`GameConsensusKey.cfb`),
  mirroring V3's `formatCFBGame` write side. Note `cfb_api_predictions` has
  none of `training_key` / `unique_id` / `game_id`, so which field actually
  carries the id depends on which CFB path is live. This is currently
  **untestable and harmless**: there are ZERO CFB rows in `avatar_picks` and the
  CFB feed returns no rows. Pick one scheme and make both clients agree the
  first time a real CFB slate exists. NFL/NBA/NCAAB/MLB keys are consistent
  across web and iOS.

## Retuning

Pass different `p_min_share` / `p_rel_share` / `p_min_agents` from the client.
To re-derive the calibration, aggregate `avatar_picks` joined to public+active
`avatar_profiles` per `(game_date, game_id, pick_selection)` and sweep the
thresholds against slate sizes from `mlb_training_snapshots`.

# Agent Consensus — what the public agents bet, and whether it means anything

One row on each `/games` feed card showing what the public AI agents actually bet,
plus a detail widget that reaches a verdict on it.

## What renders

One shape on the feed card, two treatments, decided server-side:

| Condition | Treatment |
|---|---|
| `flagged = true` | emerald strip: avatar stack · "31 of 35 on OVER 7.5" · **CONSENSUS** |
| has agents, not flagged | the same line, muted, no chip |
| no agents | nothing |

Both name the side and carry the denominator; colour alone separates "worth
pointing at" from "here's what they did".

The unflagged tier used to render a bare participation count ("45 agents") next
to winning-SIDE faces — a number that says how many agents ran that day, not what
they think, beside a stack making a claim it never stated. That was a deliberate
"state a count, make no claim" design; it was replaced because the claim it
avoided making was the only useful thing on the row.

## The copy spec

The failure this replaced: the detail card recited a statistic and left the
judging to the reader — *"The most-backed side is TCU -6.5: 18 of 35 agents, 51%
agreement"* — while a footer read **"flag needs 13"**. `flagged` needs that
agent-count gate **AND** ≥55% agreement, and only the first was ever printed. So
a card could show 18 ≥ 13, draw its fill visibly past the tick at 13/35 = 37%,
and still not flag, with nothing on screen explaining why. It contradicted
itself.

`flag`, `threshold`, and `agreement` are internal vocabulary, which
`src/features/games/detail/WIDGET_DESIGN.md` §4 bans outright. The card now
states a verdict and quotes no gate.

### Verdict

| State | Condition | Chip | Tone |
|---|---|---|---|
| Consensus | `flagged` | `CONSENSUS` | emerald-500 `#10B981` |
| Lean | `!flagged && agreement >= 0.55` | `LEAN` | amber-500 `#F59E0B` |
| Split | `!flagged && agreement < 0.55` | `SPLIT` | grey |
| Too few | `marketAgents < 3` (wins over the rest) | `TOO FEW` | grey |

The chip is **always present** — its colour, not its existence, is what makes a
consensus game pop. A chip on only the ~21% that flag leaves the other 79%
looking unlabelled rather than deliberately quiet.

`flagged` is always the server's decision and is never recomputed. The 0.55
constant is duplicated client-side **only** to tell Lean from Split; if
`p_min_share` moves in SQL, move all three copies with it.

**"BET" is retired.** It read as an instruction from the app, and it sat one row
away from the model-signal badges (MAMMOTH PLAY / High Conviction), which are a
different claim entirely.

### Sentences

`S` = side, `N` = sideAgents, `T` = marketAgents, `M` = marketLabel.

| State | Headline |
|---|---|
| Consensus | `Agents are on {S} — {N} of the {T} betting the {M}.` |
| Lean | `Agents lean {S}, but only {T} bet the {M}.` |
| Split | `Agents are split on the {M} — {S} leads with {N} of {T}.` |
| Too few | `Only {T} agents bet the {M} on this game.` (singular at 1) |

With no `M` every sentence drops its market clause — it must **never** fall back
to the word "side", which implies a two-way market that may not exist (alt lines
and odds-suffixed selections share one market).

| Element | Copy |
|---|---|
| subtitle | `Independent picks from the public AI agents on this game.` |
| eyebrow | `MOST-BACKED {M}` / fallback `MOST BACKED` |
| big number | `51%` over `OF {M} BETS` / fallback `OF AGENT BETS` — a bare "agree" never said agree with *whom*, or over which population |
| bar | three segments: leader · runner-up · other. No threshold tick. |
| bar legend | `18 TCU -6.5 · 15 Baylor +6.5 · 2 other`; `31 Over 7.5 · unanimous` when the leader takes the market |
| bar footer right | `#3 of 14 today` — the slate rank, which is what makes 51% mean anything |
| avatar stack | unchanged: up to 4 winning-side faces + `+N` |

The percentage is suppressed entirely on `Too few`: "50%" off a 2-agent market
is theatre.

**Two signals, not one.** Direction (which side, how lopsided) is the signal.
Field size is **not** a bullish indicator — "≥1 agent" fires on 96% of a slate —
it is the *sample size that makes the percentage trustworthy*. So it lives in the
bar legend and the rank line, never in a gate readout.

Implementations, all reading one spec:

| Platform | Where the copy lives |
|---|---|
| Web | `src/features/games/consensusCopy.ts` (+ `consensusCopy.test.ts`) |
| iOS | `GameAgentConsensus.swift`, `// MARK: - Copy` (+ `GameAgentConsensusTests.swift`) |
| Android | `GameAgentConsensus.kt` (+ `AgentConsensusSectionTest.kt`) |

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
  market (`bet_type × period`), not every agent who bet any market on the game.
  Dividing by `agents` pooled six-plus MLB bet shapes into one denominator, so a
  plurality read as a minority (5 of 17 = 29% when the F5 run line itself was
  near-unanimous) and the metric got *worse* as more agents bet a game. Changed in
  `supabase/migrations/20260729140000_agent_consensus_market_scoped.sql`.
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

`supabase/migrations/20260726140000_game_agent_consensus.sql`, market-scoped by
`20260729140000_agent_consensus_market_scoped.sql`, runner-up + rank by
`20260815120000_agent_consensus_runner_up_and_rank.sql`

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
  flagged bool, runner_up_side text, runner_up_agents int,
  slate_rank int, slate_games int, avatars jsonb
)
```

`market_label` names the population `agreement` is over ("F5 run line",
"moneyline", "total"), so a card can say *which* bet the agents agreed on.

`runner_up_side` / `runner_up_agents` are the second-most-backed selection **in
the winner's own market** — ranked inside `(bet_type, period)` so the three bar
segments sum to `market_agents`. It is *not* "the other side": `pick_selection`
is unnormalized, so a market can hold more than two distinct strings and the
remainder is genuinely "everything else in this market".

`slate_rank` / `slate_games` place the game on its own date, ordered
`(flagged DESC, agreement DESC, side_agents DESC, game_id)` — flagged games
first, so "#1 today" always names a game the product is pointing at, and
`game_id` last so the rank can't shuffle between identical rows on refetch.

**Only markets with `market_agents >= 3` are ranked**; the rest get NULL for both
columns and the clients drop the line. Agreement alone is a bad sort key across
sample sizes — a 1-agent market scores 100% for free. Caught on the live
2026-08-15 MLB slate, where "Boston Red Sox -1.5, 1 of 1" ranked **#10 of 15**,
above an 11-agent coin flip, and a card would have printed "TOO FEW" and
"#6 of 15 today" together — the same self-contradiction as the old
"flag needs 13". The cutoff is deliberately the same one `verdict` uses for
`tooFew`, so the chip and the rank can never disagree.

Residual limitation, accepted: among ranked games a thin market can still outrank
a fat one (8 of 8 = 100% sorts above 15 of 24 = 63% when neither is flagged). The
`LEAN` chip is what tells the user the field was thin.

Changing the return shape needs **`DROP FUNCTION` + `CREATE`**, not `CREATE OR
REPLACE`, and dropping a function drops its grants — re-issue `GRANT EXECUTE …
TO anon, authenticated` or the strip silently dies for signed-out users.

### Prod drifts from the migration history — check before you trust a column

Verified 2026-08-15 by calling the live RPC with the anon key: prod was still
running the **20260726 original**, returning neither `market_agents` nor
`market_label`. Every client fell back to the whole-game denominator and the
widget rendered "MOST-BACKED SIDE" instead of naming the market. The
market-scoping fix had been in the repo since July and was never applied.

`supabase_migrations.schema_migrations` does not record 20260726140000 or
20260729140000 even though the first was demonstrably live, so **the history
table cannot be trusted for this function**. These migrations are applied with
`supabase db query --linked -f <file>`, not `db push`. Always check the live
shape first:

```sql
SELECT * FROM get_game_agent_consensus('mlb', ARRAY[CURRENT_DATE]) LIMIT 1;
```

**Applied 2026-08-15**: `20260815120000_agent_consensus_runner_up_and_rank.sql`,
which is self-contained and carried the market-scoping math forward, so it
landed 20260729's fix at the same time. Verified after apply: EXECUTE granted to
`anon` + `authenticated`, and a live anon call returns all 15 columns with the
bar segments summing to `market_agents`.

The effect of the scoping fix on a real slate (MLB, 2026-08-15): `Under 9` went
from 15/36 = 42% unflagged to 15/24 = 63% **flagged**, and the day went from 0
flags to 2 of 15 — the metric had been measuring market fragmentation, exactly
as `20260729140000`'s header predicted.

Rollback is re-running `20260726140000_game_agent_consensus.sql`, which is
verbatim what was live before.

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
| Game-detail widget | ✅ `features/games/detail/sections/AgentConsensusSection.tsx` | ✅ `Features/GameWidgets/AgentConsensusSection.swift` | ✅ `app/features/gamewidgets/AgentConsensusSection.kt` |
| Outliers matchup tile | ✅ `features/outliers/components/MatchupTile.tsx` | ❌ | ❌ |

The Outliers tile previously rendered a bare `83% agree` naming **no side and no
denominator** — a percentage about an unstated selection. It now shows the same
`18 of 35 on TCU -6.5` line as the feed strip.

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
  consensus (the parameter defaults to null), so its strips stay hidden. Like
  iOS it coalesces overlapping fetches on a per-sport `Deferred` and exposes
  `ensureLoaded(sport, date(s))` for feed-less surfaces (no caller yet — the
  detail widget is not ported). That `Deferred` slot is released by the task's
  own `invokeOnCompletion`, never by the joining caller: the feed's
  `LaunchedEffect(sport, dates)` is cancelled on every sport tap, and releasing
  from a `finally` around `join()` freed the slot mid-fetch and fired a
  duplicate RPC. A joiner also re-checks that the open call covered ITS dates
  (`containsAll`) before skipping its own fetch, so a widening MLB slate still
  requests tomorrow.

**All three platforms** map `market_agents` / `market_label` (falling back to
`agents` / `""` on pre-migration rows) and all three decode the runner-up and
rank columns as OPTIONAL. That optionality is load-bearing: a client shipped
ahead of the migration must render the card minus its second bar segment and
rank line, not fail the whole slate fetch. The counting fields stay strict on
purpose — see `AgentConsensusService`'s KDoc for why a defaulted count is worse
than a throw.

TTL is 90s (vs the feed's 5min): counts move through the day as agents
generate — roughly 1 new pick/minute on a busy MLB slate — while the slate does not.
iOS and Android pull-to-refresh force past that TTL; a failed RPC is not cached,
so the next tick retries instead of showing nothing for 90s.

Failure is non-fatal everywhere: no strip, feed renders normally.

### Don't merge CONSENSUS into the model badge row

On native, `convictionBadges` / `ConvictionBadges` already carries MAMMOTH PLAY /
High Conviction / N Signals. MAMMOTH is a **model** signal; CONSENSUS is a
**crowd** signal. Putting them in one wrap group makes the card imply the model
and the agents agree when they may not. The consensus strip gets its own row.
(On Android there is also a documented height-blowup risk around
`GameRowCard.kt:443` if that bottom row is flattened.)

That collision is also why the badge is no longer worded "BET" — an
instruction-shaped word one row from the model's own verdicts.

For the same reason both native apps use Tailwind emerald-500 (`#10B981`) for
the strip and not `appPrimary` (green-500) — that green already means MODEL
signal on the card (O/U lean, positive edge). On Android the shades are tokens
(`appConsensusEmerald` / `…Text` / `…Deep`, plus `appConsensusAmber` for the LEAN
chip, in `AppColors`), never inline hex.

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

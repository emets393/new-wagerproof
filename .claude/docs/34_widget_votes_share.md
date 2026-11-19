# Widget Votes & Share — upvote / downvote / share on game-detail widgets

| Layer | Status |
|---|---|
| Backend (`20261119120000_widget_votes.sql`) | **Built and tested** (50 PGlite tests, `supabase/tests/widgetVotes.test.ts`). **NOT yet applied to prod** — apply the migration before shipping a client that calls it. |
| iOS native | **Built, NOT YET COMPILED OR RUN.** Written in a Linux container with no Swift toolchain. Needs an Xcode build, `swift test` on `WagerproofKit`, and an on-device pass (§8) before release. |
| Web | Not built. Contract in §4 applies. |
| Android native | Not built. Contract in §4 applies. |

Every widget card on a game-detail sheet ("Moneyline Prediction", "Public
Betting", "Team Total"…) gets a Reddit-style action row: an up/down vote pill
with a score on the left and a share button on the right. The header changes to
an avatar-style icon badge + title.

Two goals, and they pull in different directions, so both are written down:

1. **For users** — see what other users think is good information, and share an
   interesting snippet in two taps.
2. **For us** — a per-widget quality signal: which widgets people like, which
   they don't, per sport.

## 1. Requirements

### Functional

| # | Requirement |
|---|---|
| F1 | A signed-in user can upvote or downvote one widget on one game. One vote per (user, sport, game, widget). |
| F2 | Tapping the active arrow again clears the vote. Tapping the other arrow switches it. |
| F3 | Each card shows the **net score** (upvotes − downvotes) and the user's own vote state. A widget **nobody** has voted on shows the word "Vote"; a 5-up / 5-down widget shows `0`. |
| F4 | Votes are optimistic: the UI moves on tap and rolls back if the server refuses. |
| F5 | A share button renders a compact image of JUST that card — icon + title, matchup line, headline sentence, WagerProof footer — and opens the system share sheet. Shown only on cards that have a headline. The widget **body** (charts, bars) is not in the image; see §5 for why. |
| F6 | Admins can read a per-widget summary (ups, downs, voters, games) over a trailing window. |
| F7 | Votes and shares fire analytics events (§6). |

### Non-functional / security

| # | Requirement |
|---|---|
| S1 | Nobody can read another user's individual votes — only aggregates leave the database. |
| S2 | A user cannot vote as someone else, vote twice, or write a count directly. All writes go through one RPC that takes the voter from `auth.uid()`, never from a parameter. |
| S3 | Signed-out callers can neither read nor write. Neither can Supabase *anonymous sign-in* sessions, which hold the `authenticated` role but cost nothing to mint. |
| S4 | Writes are rate limited per user (§3.4). |
| S5 | Inputs are validated server-side: sport allow-list, `game_id` and `widget_key` shape and length. |
| S6 | Counts cannot drift from the votes table: they are maintained in the same transaction as the vote, by a trigger, on every write path including account deletion. |
| S7 | A vote failure never breaks a game-detail page. Reads fail silent (no action-row score), writes roll back. |

### Explicitly out of scope (v1)

- Comments, a share *count*, and "who voted".
- Ranking/reordering widgets by score. The signal is collected first; acting on
  it is a separate decision.
- Deep links from a shared image back to the game — `DeepLinkRoute` has no
  game-detail route today. The image carries the brand + `wagerproof.bet` only.
- The widget body inside the share image (§5).
- Web and Android UI. The contract here is cross-platform so they can follow;
  see §7.

## 2. Identity — what a vote is attached to

A vote target is `(sport, game_id, widget_key)`.

- **`sport`** — `nfl | cfb | nba | ncaab | mlb`.
- **`game_id`** — the SAME canonical key agent consensus uses
  (`GameConsensusKey` on iOS, see `18_agent_consensus.md` "Join key"). Reusing
  it means web, iOS and Android land on the same row without inventing a second
  id scheme. Games live in the CFB Supabase project and votes in MAIN, so the
  server **cannot** verify a `game_id` exists — it validates shape only (S5):
  1–96 printable ASCII characters with no leading or trailing space.
- **`widget_key`** — a stable snake_case id chosen per widget, e.g.
  `moneyline_prediction`. **Never derived from the title**: titles are
  dynamic (MLB flips "Moneyline Projection" / "1st 5 Moneyline"; CFB team-total
  titles contain the team abbreviation) and differ per platform (web says
  "Spread", iOS "Spread Prediction"). A copy edit must not reset a widget's
  score. Shape: `^[a-z][a-z0-9_]{1,47}$`.

A card with no `widget_key` simply renders no action row — that is the opt-out
for empty states and non-informational cards.

### Canonical widget keys

Keys are shared across sports wherever the widget answers the same question, so
the admin summary can compare "moneyline_prediction" NFL vs NBA.

| Key | Widgets |
|---|---|
| `agent_consensus` | Agent Consensus (all sports) |
| `public_betting` | Public Betting (tickets-and-money card) |
| `public_betting_splits` | NFL's second public-betting card (per-market split bars) |
| `score_prediction` | Score Prediction / Projected Score |
| `spread_prediction`, `total_prediction`, `moneyline_prediction` | full-game market cards. MLB's moneyline/total cards flip between full-game and first-5 views in place — they are ONE card each and keep these keys in both views |
| `team_total_prediction` | NFL/NCAAB team total; CFB uses `team_total_home` / `team_total_away` (two separate cards) |
| `h1_spread_prediction`, `h1_total_prediction`, `h1_moneyline_prediction` | first-half market cards (NFL, CFB) |
| `first_half` | NBA / NCAAB combined "First half" card |
| `f5_splits` | MLB First-5 Innings insight card |
| `matchup_history`, `player_props` | |
| `injury_report`, `recent_trends`, `betting_trends`, `team_stats` | |
| `model_accuracy`, `model_projections`, `thrill_score` | NCAAB |
| `regression_report`, `game_signals` | MLB |
| `mammoth_play`, `display_notes` | CFB |

There is deliberately **no server-side allow-list of keys**. An allow-list would
need a migration for every new widget on any client, and prod already drifts
from migration history (see CLAUDE.md §9) — a forgotten seed row would silently
break voting on a shipped widget. The cost of not having one is that a
signed-in user can write junk keys. That is bounded three ways: the rate limit,
a cap of **64 distinct keys per game** (so junk cannot bloat the payload every
reader of a real game downloads), and the fact that clients only render keys
they know. Junk is filterable in the admin summary.

**Skeletons and empty states carry no key** ("No model picks are posted yet",
loading placeholders) — there is nothing there to rate.

## 3. Backend (MAIN Supabase)

### 3.1 Tables

```
widget_votes            PK (user_id, sport, game_id, widget_key)
  user_id     uuid  → auth.users ON DELETE CASCADE
  sport       text  CHECK in the five sports
  game_id     text  CHECK shape
  widget_key  text  CHECK shape
  vote        smallint CHECK in (-1, 0, 1)
  created_at, updated_at

widget_vote_counts      PK (sport, game_id, widget_key)
  upvotes, downvotes  integer CHECK >= 0
  updated_at

widget_vote_rate_limits PK (user_id)
  minute_start timestamptz, minute_count int
  day date, day_count int
```

- **A cleared vote is stored as `vote = 0`, not deleted.** It keeps "voted then
  retracted" as a signal distinct from "never voted", and makes `cast` a single
  idempotent upsert.
- **Why a counts table instead of `count(*)` on read:** a detail sheet reads
  every widget for a game on open. Counting from an index is fine at today's
  volume but grows with every vote ever cast on a popular game; the counts row
  is O(widgets). S6 covers the drift risk that normally argues against this.

### 3.2 Access model

RLS is enabled on all three tables with **no policies**, and all table
privileges are revoked from `anon` and `authenticated`. The tables are reachable
only through SECURITY DEFINER functions. This is the `competition_pickem`
pattern (RPC-only writes), not the `community_pick_votes` one — that older
design lets clients write vote rows directly, has an UPDATE policy with no
`WITH CHECK`, and a non-definer counter trigger that cannot update other users'
rows.

### 3.3 Functions

| Function | Caller | Does |
|---|---|---|
| `cast_widget_vote(p_sport, p_game_id, p_widget_key, p_vote)` | `authenticated` | Validates, rate limits, upserts the caller's vote (`p_vote` ∈ −1/0/1), returns that widget's `(widget_key, upvotes, downvotes, my_vote)`. A repeat of the current value is a no-op that writes nothing. |
| `get_widget_votes(p_sport, p_game_id)` | `authenticated` | One row per widget on the game that has ever been voted on: `(widget_key, upvotes, downvotes, my_vote)`. |
| `get_widget_vote_summary(p_days default 30)` | admin (`has_role`) | Per `(sport, widget_key)`: upvotes, downvotes, retracted, voters, games, over votes last touched in the window. |
| `_apply_widget_vote_delta()` | trigger only | AFTER INSERT/UPDATE/DELETE on `widget_votes`; applies the ±1 delta to `widget_vote_counts`. EXECUTE revoked from everyone. |

All are `SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp`, with
`REVOKE ALL … FROM PUBLIC, anon` before the grant. Error codes follow the repo
convention: `42501` not signed in / not admin, `22023` bad input, `54000`
(`program_limit_exceeded`) rate limited.

**Concurrency.** `cast_widget_vote` takes a per-user `pg_advisory_xact_lock`
before it reads the current vote, so two devices on one account cannot both
decide they are "a real change". The limiter is a single atomic upsert with
`RETURNING` (increment and read in one statement). Counts are only ever changed
as `count + delta` inside the trigger, under the counts row lock — never
read-modify-write. PGlite is single-connection, so the tests do **not** exercise
real concurrency; these three properties are by construction.

**PL/pgSQL trap, hit once already.** The functions return
`TABLE (widget_key …)`, which makes `widget_key` a variable inside the body. A
bare `ON CONFLICT (…, widget_key)` is then ambiguous (42702) — the tests caught
exactly this. Use `ON CONFLICT ON CONSTRAINT …` and table-qualify every column,
as the migration does.

### 3.4 Rate limit

Per user: **30 vote changes per fixed UTC minute, 600 per UTC day.** (Fixed
buckets, so up to 60 can straddle a minute boundary — fine for an abuse brake.) A full
slate is ~15 games × ~12 widgets = 180 legitimate targets, so 600 leaves room
for changing your mind; 30/min is faster than a human taps. No-op casts do not
consume budget; rejected casts do not either (the transaction rolls back). The
limiter is its own one-row-per-user table rather than a count over
`widget_votes`, because toggling ONE row repeatedly never grows a row count.

### 3.5 What this does not defend against

Stated so nobody assumes otherwise:

- **Sybil voting** — one person with many accounts. Votes are a soft signal;
  nothing is ranked or paid on them. Revisit if that changes.
- **Votes on widgets the caller can't see** (Pro-gated cards, or a game that
  already finished). The server has no cross-project view of games or of which
  widget is gated on which platform.

## 4. Client contract

Counts arrive as integers, `my_vote` as −1/0/1 (0 and "no row" mean the same
thing to a client). Client rules, identical on every platform:

- Load once per game-detail open (`get_widget_votes`), cache ~60s.
- Optimistic apply → `cast_widget_vote` → adopt the returned row (the server's
  counts win, so two devices converge).
- **One request in flight per widget, latest intent queued behind it.** If `up`
  and a later `clear` were both on the wire, nothing guarantees `up` commits
  first; it could land second and the server would end on the vote the user
  retracted. Intermediate taps are dropped.
- A response must not overwrite a newer optimistic state: while a tap is queued,
  show the server's counts with that tap applied on top.
- On error, roll back to the **last server-confirmed** state — not the pre-tap
  state, which after quick taps may itself be an unconfirmed guess. On `54000`
  also give a "slow down" cue (iOS: error haptic) and drop the queued tap.
- A background refresh must not trample a vote that is queued or in flight.
- Drop the whole cache on sign-out / account switch: `my_vote` is per-user.
- Not signed in → the action row still shows the share button; vote arrows are
  hidden.

iOS implements this in `WidgetVotesStore` (`WagerproofKit/Sources/WagerproofStores/`),
with the rules pinned by `WidgetVotesStoreTests`.

## 5. UI (iOS first)

```
┌──────────────────────────────────────────────┐
│ (●$) Moneyline Prediction          [verdict] │  header: 26pt tinted icon badge + title
│                                              │
│ Full game: Bears need to win 85.4% of the    │  headline (unchanged)
│ time to break even at -585…                  │
│                                              │
│ …widget body…                                │
│                                              │
│ ( ⇧  128  ⇩ )                       ( ↗ Share )│  action row
└──────────────────────────────────────────────┘
```

- **Header** — the SF Symbol moves into a 26pt circular badge tinted with the
  card's `iconTint` (which the shell accepted but never used); the title drops
  the all-caps tracking for semibold title case, like a subreddit name next to
  its avatar. Existing accessories (verdict badge, chevron, tap hint) keep the
  trailing slot.
  Cards that pass a custom `icon` view (CFB team-total avatars) keep it as is.
- **Action row** (`WidgetActionRow`) — bottom of the card body, inside the
  collapsing window. Vote pill: up arrow, score, down arrow in one capsule;
  active up = `appPrimary`, active down = `appLoss`; score uses
  `.contentTransition(.numericText())`. Share: capsule on the trailing edge.
  44pt-wide targets, VoiceOver labels "Upvote" / "Downvote" / "Share <title>".
  Three constraints from the shell's collapse behaviour:
  - **Constant height.** The shell caches a card's natural height only while it
    is unpinned. The row is therefore present exactly when the card has a
    `widgetKey` and sits inside a `.widgetVotes(...)` sheet — both fixed for the
    card's lifetime — and is a fixed 36pt whatever it shows.
  - **No hit-testing while collapsing.** `.clipped()` hides the row as it slides
    under the pinned header but does not clip touches.
  - **Own insets**, outside `bodyPadding`, because cards pass 0, 14 or 16.
- **Wiring** — each detail sheet calls `.widgetVotes(sport:gameId:matchup:)`
  once (`WidgetVoteContext.swift`); it sets an environment value the shell
  reads and loads the game's tallies. Cards opt in with `widgetKey:`.
  `WidgetVotesStore` is created in `MainTabView` and read as an optional
  environment object so previews and the screenshot harness still mount.
- **Share image** (`WidgetShareCard`) — a dark 360pt card: icon badge + title,
  matchup line ("NO @ CHI"), headline, and a footer with the WagerProof mark and
  `wagerproof.bet`. No vote counts, no user data. Rendered with `ImageRenderer`
  at 3× and presented through UIKit (a SwiftUI sheet inside the detail
  `.fullScreenCover` tears the cover down — same reason as `AgentPickFocusView`).

  **Why the widget body is not in the image.** `ImageRenderer` draws a fresh
  copy of a view *outside* the hierarchy. An arbitrary widget body re-rendered
  that way loses its environment stores (non-optional `@Environment` reads
  trap), its `@State`, its `.task`-loaded data, any remotely loaded logo, and
  anything in a ScrollView or Liquid Glass. The existing pick-ticket share works
  only because a ticket is a pure function of one model. So the share card is
  built solely from plain values the shell already holds. Adding a chart to it
  means giving that widget an explicit, pure share body — per widget, audited —
  not re-rendering `content`.

## 6. Analytics (Mixpanel, snake_case, shared across platforms)

| Event | Properties |
|---|---|
| `widget_vote_cast` | `sport`, `game_id`, `widget_key`, `vote` (−1/0/1), `previous_vote` |
| `widget_share_tapped` | `sport`, `game_id`, `widget_key` |
| `widget_share_completed` | same |

Mixpanel answers "who is engaging"; `get_widget_vote_summary` is the source of
truth for the scores themselves. Note that `widget_vote_cast` puts a per-user
vote into Mixpanel — S1 ("only aggregates leave the database") is a statement
about the database and other users, not about our own analytics.

## 7. Rollout order

1. Migration + PGlite tests (`supabase/tests/widgetVotes.test.ts`, runs in
   `npm test`). **Done.**
2. Apply the migration to MAIN. Before relying on the admin summary, confirm
   prod's `has_role(uuid, app_role)` accepts the literal `'admin'` — it is
   defined in no migration and the tests stub it.
3. iOS: Kit model/service/store + tests, shell changes, keys on every sheet.
   **Written; see §8.**
4. Later, not in this change: web (`src/components/ios/WidgetCard.tsx` gets the
   same `widgetKey` + action row) and Android (`WidgetCollapsingSection`), both
   against this contract.

## 8. iOS verification still owed

Nothing in the iOS change has been compiled. Before it ships:

1. `xcodegen generate` (five new Swift files), then build the app target.
2. `swift test --package-path wagerproof-ios-native/WagerproofKit` —
   `WidgetVoteTallyTests`, `WidgetVotesStoreTests`.
3. On device, on a game-detail sheet for each sport:
   - vote up / switch / clear, kill the app, reopen — the vote persists;
   - scroll a voted card up until it pins and collapses — the card must not
     gap or clip, and the hidden row must not take taps through the header;
   - Share from the sheet (it lives in a full-screen cover) — the cover stays
     up and the image shows the logo, title, matchup and headline;
   - with the migration NOT applied, the sheet still renders (S7).
4. Look at the restyled header on every sheet. Most call sites never set
   `iconTint`, so their badge is the default green; the title is now title case
   in primary text. This also changes the header on non-game surfaces that use
   `WidgetCollapsingSection` (props detail, Outliers).

## 9. Review record

The spec was reviewed before implementation. Changes it forced: the share image
no longer re-renders the widget body (§5); per-user advisory lock and explicit
concurrency rules (§3.3); one-in-flight write ordering and rollback target
(§4); the per-game key cap (§2); constant-height, non-hit-testable-while-
collapsing action row (§5); anonymous-session rejection (S3); clamped counter
decrements so a drifted count can never block an account deletion.

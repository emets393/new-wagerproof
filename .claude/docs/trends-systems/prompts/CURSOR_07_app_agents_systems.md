# Cursor prompt — APP: agent Follow/Copy UI + Systems save flow + sport-scoped Leaderboard

> Copy everything below the line into Cursor. This is the Expo/React Native app ONLY
> (`wagerproof-mobile/` — app code, not the web `src/`). All backends are DONE and LIVE —
> do not create or modify anything in `supabase/` or `src/features/analysis/`.
> Test in the iOS simulator via `npx expo start`. Do NOT commit, push, or deploy.

---

## Context — two live backends you're wiring up

**Both were deployed and E2E-tested today. The app only calls them; it never computes records
or writes tables the RPCs own.** Two Supabase clients are in play, as already configured in
the app: the MAIN client (auth, agents, saved systems) and `collegeFootballSupabase`
(warehouse — the `*_analysis` RPCs, as used in `services/mlbHistoricalAnalysisService.ts`).

Docs if needed: `.claude/docs/agents/03_DATABASE_SCHEMA.md` (follow/clone),
`.claude/docs/trends-systems/07_SYSTEMS_LEADERBOARD.md` (systems).

**Audience note from the owner: users are NOT technical. Use the exact copy given below —
never words like "verdict", "symmetric", "snapshot", or "RPC" in the UI.**

---

# PART 1 — Agents: Follow + Copy Build

Product model (get this exactly right):
- **Own agents** = full control (generate, edit).
- **Followed agents** = SPECTATOR ONLY: they appear in the user's agent list; the user sees
  picks whenever the OWNER runs the agent. A follower can NEVER trigger generation — never
  render a generate/run button on an agent the viewer doesn't own.
- **Copy build** = new agent the user OWNS (same settings, fresh 0-0 record) — they run that.

Files: `app/(drawer)/(tabs)/agents/index.tsx` (My Agents), `agents/public/[id].tsx`
(public detail — the Follow button already lives here), `components/agents/AgentCard.tsx`.

1. **My Agents screen**: merge followed agents in below owned ones under a "Following"
   header. Query own rows from `user_avatar_follows` (`user_id, avatar_id, is_favorite,
   notify_on_pick`) → join `avatar_profiles` (public agents are readable) +
   `avatar_performance_cache` for records. Followed cards show the agent's real record and
   a small "Following" badge. Favorited follows sort first; add a star toggle and a
   notifications bell — these UPDATE `is_favorite` / `notify_on_pick` on the user's own
   follow row (the DB permits ONLY those two columns; don't touch others).
   Tapping a followed agent opens `agents/public/[id]` (NOT the owner detail route).
2. **Public agent detail**: next to Follow, add **Copy build**:
   ```ts
   const { data: newAgentId, error } = await supabase.rpc('clone_public_agent', {
     p_source_avatar_id: agentId,   // p_name optional — omit to reuse the source name
   });
   ```
   Show a confirmation sheet first: "This creates YOUR OWN copy of this agent — same brain
   and settings, but a fresh 0-0 record. It won't share the original's picks or history."
   On success navigate to `agents/[id]` for the new agent (it behaves like any owned agent —
   generation works because the user owns it). Error mapping (`error.message`):
   `agent_limit_reached` → the existing RevenueCat paywall used at agent creation;
   `source_not_found_or_not_public` → toast "This agent is no longer available";
   anything else → "Couldn't copy this agent, try again."
   Never insert into `avatar_profiles` directly — the RPC is the only write. Name
   collisions are handled server-side ("Name (Copy)").
3. Button language: **Follow** = "Watch this agent — see its picks when its owner runs it."
   **Copy build** = "Make your own version — same settings, fresh 0-0 record, you run it."

---

# PART 2 — Historical Analysis: "Save this System"

Applies to each sport's historical-analysis screen in the app. Today that is
`app/(drawer)/(tabs)/mlb-historical-analysis.tsx` (+ `services/mlbHistoricalAnalysisService.ts`);
if NFL/CFB analysis screens exist in your working tree, apply the identical flow to them
(spec for those screens: `.claude/docs/15_mobile_historical_analysis.md`).

Add a **Save System** button to the analysis screen (near the filters/results). Signed-in
only. Tapping opens a dialog that asks ONE question before naming:

**Side markets** (MLB: `ml`, `rl`, `f5_ml`, `f5_rl` · NFL/CFB: `fg_spread`, `fg_ml`,
`h1_spread`, `h1_ml`):
> **Which side does this system bet?**
> - ⚡ **Bet ON these teams** — "Every time a team matches my filters, bet on them." → save `verdict: 'team'`
> - 🔄 **Bet AGAINST these teams** — "Every time a team matches my filters, bet on the other side." → `verdict: 'fade'`

**Totals markets** (`total`, `f5_total` / `fg_total`, `h1_total`, `team_total`):
> **Which side does this system bet?**  [⬆️ The Over → `'over'`]  [⬇️ The Under → `'under'`]

**Special case — side market where the filters only describe the game** (no team-defining
filter active: nothing set for side, favorite/underdog, team pick, streaks, last-game,
records, pitchers, or any opponent filter — only things like weather/month/day/time/park).
Do NOT error. FIRST ask:
> **Your filters describe the game — now pick which side to track.**
> Every game has two teams. Which side does this system bet?
> [ Home teams ] [ Away teams ] [ Favorites ] [ Underdogs ]

Picking one sets that filter on the screen (side or favorite/underdog chip updates, results
refetch), THEN the ON/AGAINST question appears. The user never sees a rejection.
The authoritative key lists for "team-defining" are exported on the web side as
`MLB_SIDE_BREAKING_DIMS` / `NFL_SIDE_BREAKING_DIMS` / `CFB_SIDE_BREAKING_DIMS` in
`src/features/analysis/filterSchema*.ts` — copy the relevant list into the app service
verbatim (READ those files; do not modify them) and check whether any of those keys differ
from defaults.

**Confirmation line, always shown (fill in their choice):**
> "We'll track this system's record as if you bet **[the Under / on these teams / against
> these teams]** once in every game that matches your filters."

**Share toggle (default OFF):**
> ☐ **Share to the Systems Leaderboard** — "Other users will see your username, this
> system's name, and its record. Systems need 10+ games of history to appear."

**Insert (MAIN client)** into `{sport}_analysis_saved_filters`
(`mlb_analysis_saved_filters` etc.) — this exact contract makes the nightly grader's
numbers equal the page's numbers, so capture it precisely:
```ts
{ user_id, name,                    // user's chosen name
  bet_type,                         // the screen's current bet type
  filters,                          // the screen's UI filter state (for restoring later)
  verdict,                          // from the dialog
  rpc_bet_type,                     // the EXACT p_bet_type currently sent to {sport}_analysis
  rpc_filters,                      // the EXACT p_filters object currently sent to it
  is_public }                       // from the toggle
```
Renaming and sharing/unsharing later are allowed (UPDATE `name`/`is_public` only — the DB
rejects other columns). Editing filters = save a new system (by design; don't build edit).

**My Systems (minimal)**: a list (sheet or section on the analysis screen) of the user's
saved systems for that sport: name, plain-English bet line ("Bets the Under" / "Bets ON
matching teams" / "Fades matching teams"), **since-saved record** from the row's
`since_saved` jsonb ("2-1 since you saved" / "0-0 so far"), share toggle, rename, delete,
and tap-to-load (restore `filters` + `bet_type` into the screen). If `since_saved` is null
(not graded yet): "grading nightly — check back tomorrow."

---

# PART 3 — Systems Leaderboard (sport-scoped)

**Entry point — a small banner, not a tab.** On each sport's historical-analysis screen,
add a slim, readable, tappable banner (match the style of the existing
`components/mlb/MLBHistoricalAnalysisBanner.tsx` card language):

> 🏆 **Systems Leaderboard** — "The most profitable systems users have shared" ›

**Sport scoping is a hard requirement:** the banner opens the leaderboard for THAT sport
ONLY. From the MLB analysis screen the user must see ONLY MLB systems — never NFL or CFB.
Pass the sport explicitly and do not add an "all sports" view:
```ts
const { data } = await supabase.rpc('analysis_systems_leaderboard', {
  p_sport: 'mlb',            // 'nfl' | 'cfb' from those screens
  p_limit: 50,
});   // MAIN client; anon-callable, ranked by all-time ROI, min 10 graded games
```
Row shape:
```
{ sport, system_id, name, verdict, bet_type, rpc_bet_type, filters, username, created_at,
  all_time: {n, wins, losses, pushes, hit_pct, roi, units},
  current_season: {…}, season_label, since_saved: {…},
  last10: {n, wins, results: [1,0,…newest first]}, streak: {kind:'win'|'loss', len},
  graded_at }
```

**Leaderboard screen** (modal or pushed screen; title "MLB Systems Leaderboard" etc.).
Each card, compact and readable:
- Rank · system **name** · **username**
- Plain-English bet line from verdict ("Bets the Under" / "Bets ON matching teams" /
  "Fades matching teams") + market label
- **Record** `W-L` (+pushes if >0) · **ROI** (green/red — this is the ranking stat) · units
- Sample badge: **Early** (10–29 games) / **Established** (30–99) / **Proven** (100+)
- This season (`current_season` + `season_label`) · **Since shared** (`since_saved`,
  subtitle "record since this system was saved"; "0-0 so far" when n=0)
- Last-10 dots from `last10.results` (newest right) + "8 of last 10"
- Streak chip when `len >= 3`: "🔥 5 straight" / "❄️ 4 straight misses"

**Tap a card** → back to that sport's analysis screen with the row's `filters` +
`bet_type` applied (same code path as My Systems tap-to-load), plus a banner:
"Viewing **{name}** by {username} — bets {plain-English side}. Save your own copy to track
it." Its save button opens the Part-2 dialog pre-filled with the same side choice.

Empty state: "No shared {SPORT} systems yet — be the first: build a filter and share it."
Never compute any number client-side; if fields are null, show "grading nightly."

---

## Guardrails (all parts)

- READ but never modify: `src/features/analysis/*`, `supabase/*`, anything on the web side.
- Spectator rule: no generate/run affordance on any agent the viewer doesn't own.
- All leaderboard/system numbers come from RPC payloads or the saved row — never derived
  in the app.
- Reuse existing app components (cards, sheets, toasts, paywall) — no new design system.

## Run & hand-off (testing only)

`npx expo start` → iOS simulator, signed in:
1. Follow a public agent → it appears under "Following" with its record and NO run button;
   star + bell toggles persist. Copy build → new 0-0 agent opens and CAN generate.
2. MLB analysis: set filters (e.g. home + underdog + lost last game, ML) → Save System →
   side question appears → save with "Bet ON these teams", share OFF → it shows in My
   Systems with "0-0 so far".
3. Set ONLY a weather/time filter on a side market → Save → the Home/Away/Fav/Dog chooser
   appears first and picking one updates the chips.
4. Tap the leaderboard banner → MLB-only leaderboard renders (likely the empty state —
   fine; to see a card, toggle one of your own systems public, refresh, then toggle it
   back OFF before finishing).
5. **Do NOT commit / push / deploy.** Report flows tested + any copy you changed.

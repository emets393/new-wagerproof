# Cursor Prompt: WagerProof Weekly Pick'em Competition page (web)

Build the **Competition** page — a weekly NFL/CFB pick'em for Pro subscribers.
The entire backend is LIVE on the MAIN Supabase instance (auth instance, the one
`src/integrations/supabase/client.ts` points at — NOT the CFB client). Weeks 1-3
of the 2026 season are already populated with real games and consensus lines, so
you can build against real data today.

## The product in one paragraph

Every week, Pro users pick exactly **6 games against the spread or total** (any
mix of NFL + CFB), mark exactly **one as their Play of the Week (POTW)**, and
submit before the **Friday 12:00 PM ET deadline**. Everyone bets the same
**consensus line** (average of ~11 books, updated hourly). The line each user is
graded against is **stamped server-side at the moment they submit** — beating
line movement is part of the game. After submitting there's a **5-minute grace
window** to edit; then picks are locked. Nobody can see anyone else's picks
until the deadline; after it, the week's picks, a "most picked" board, and the
leaderboard are revealed. Scoring: regular win = **1 pt**, POTW win = **3 pts**,
loss/push = 0. Season tiebreaker = **Cover Points**: cumulative margin vs your
stamped line (pick −7, team wins by 21 → +14; lose by 21 → −28; totals same idea;
pushes 0; NOT tripled for POTW).

## Route + placement

- New route `/competition`, listed in the sidebar/nav **under the Analysis
  group** (next to Historical Trends / Today's Trends).
- Pro-gated with the existing `ProGate` / `useAccessControl` pattern. The RPCs
  also enforce eligibility server-side (`profiles.subscription_active` or admin
  role) — treat RPC errors as the backstop, the gate as UX.

## Data contract (MAIN instance, all through RLS / RPCs)

Readable tables (React Query):

- **`comp_weeks`** — `id, season, week_no, label, deadline, window_end, status`
  (`upcoming | open | locked | graded`). "Current week" = the open week with the
  soonest future `deadline`; if none, show the most recent locked/graded week.
- **`comp_games`** — `id, week_id, sport('nfl'|'cfb'), event_id, home_team,
  away_team, kickoff, spread_home, total, books_n, lines_updated_at,
  home_score, away_score, is_final`. `spread_home` is the HOME team's consensus
  line (−6.5 ⇒ home favored by 6.5); away side = the negation; `total` is the
  O/U number. Either can be null early (render "line pending", not pickable).
- **`comp_entries`** — your own row always; everyone's rows after the week's
  deadline (RLS handles this switch automatically — same query).
  `status('draft'|'submitted'), submitted_at, editable_until`.
- **`comp_picks`** — same visibility rule. `entry_id, game_id,
  market('spread'|'total'), side('home'|'away'|'over'|'under'), line (null until
  submitted — the stamped number), is_potw, result('win'|'loss'|'push'|null),
  points, cover_points`.

RPCs (all `supabase.rpc(...)`; error messages are user-readable — surface them
verbatim in a toast):

- **`comp_save_picks(p_week_id, p_picks)`** — `p_picks` = array of
  `{game_id, market, side, is_potw}`. Replaces the WHOLE draft (send the full
  current tray every time). Call it on every add/remove/POTW change — this is
  what makes the draft survive navigation. Allowed with 0-6 picks. If called
  after submission but inside the grace window, the entry reverts to draft
  (stamps cleared) — you must submit again.
- **`comp_submit_picks(p_week_id)`** — requires exactly 6 picks + exactly 1
  POTW. Stamps all lines server-side, returns `{editable_until}`. Fails if any
  picked game has no posted line.
- **`comp_leaderboard(p_season, p_week_id?)`** — ranked rows
  `{rank, user_id, display_name, weeks_played, wins, losses, pushes, points,
  cover_points}`. Omit `p_week_id` for season standings, pass it for one week.
- **`comp_week_stats(p_week_id)`** — post-deadline only (errors before):
  `{game_id, sport, home_team, away_team, kickoff, market, side, n_picks,
  n_potw}` sorted by popularity. Powers the "Most Picked" board.

## Page layout (desktop: split view like /games; mobile: stacked + bottom tray)

**Header strip:** week label ("Week 3 · Sep 12"), a live countdown to the
deadline ("Picks lock in 2d 14h 03m"), and status. After submission, replace
with the stamped state (see below).

**Left/main — the slate.** The picking must be 100% click-driven (the ONLY
typing on the page is the game search box):

- Controls: search input (team name filter), sport pills `All / NFL / CFB`,
  sort by kickoff. Group games by day ("Friday Night", "Saturday", "Sunday",
  "Monday").
- Each game = one card: `Away @ Home`, kickoff (user's local time), sport badge,
  and **four pick buttons in a 2×2 grid**:
  `AWAY +6.5` `HOME −6.5` / `OVER 48.5` `UNDER 48.5`.
  Selected button = filled/highlighted. Clicking a button adds that pick (and
  deselects the opposite side of the same market if it was selected). Clicking
  again removes it. Both markets on the same game is allowed (2 picks).
  Line pending → disabled buttons with "line pending".
  Footnote on the list: "Consensus of {books_n} books · updated
  {lines_updated_at rel-time} · **your lines lock when you submit**".

**Right rail / bottom sheet — the pick tray (sticky, always visible):**

- 6 slots, filled top-down: matchup, chosen side + current line, sport badge, a
  ⭐ star toggle (marking one pick as POTW; starring one unstars any other), and
  an ✕ remove. Empty slots render as dashed placeholders — "Pick 4 of 6".
- Progress ring/count `4/6` + "star your Play of the Week" nudge when 6/6 but
  no star.
- **Submit button** enabled ONLY at 6 picks + 1 star. On success: confetti-level
  moment, then the tray flips to the submitted state:
  - each pick now shows its **stamped line** (from re-fetched `comp_picks.line`)
  - a 5-minute countdown chip: "Edits allowed for 4:32" (from
    `editable_until`) with an "Edit picks" button that calls `comp_save_picks`
    (which reverts to draft) — make it clear resubmitting re-stamps at current
    lines.
  - after the window: lock icon, "Picks locked · reveal Friday 12:00 PM ET".
- Draft restore: on mount, load my entry + picks for the current week and
  hydrate the tray. Server is the source of truth — no localStorage needed.

**Tabs under the header:** `My Picks` (the above) · `Most Picked` ·
`Leaderboard` · `Rules`.

- **Most Picked** — before the deadline: a locked state ("Picks are hidden
  until Friday 12:00 PM ET" + countdown). After: `comp_week_stats` rendered as
  ranked bars (side + line-free label, % of entrants, POTW count badge on the
  most-starred pick). Highlight the single most-picked game+side at top as a
  hero stat ("68% of players are on Bills −6.5").
- **Leaderboard** — toggle `This Week / Season`. Columns: rank, player, record
  (W-L-P), **Points**, **Cover Pts** (the tiebreaker — tooltip: "How much your
  picks beat their lines by, cumulative. Settles ties at season's end."). Show
  the signed value (+147.5 / −33.0). Highlight the signed-in user's row.
  While a week is mid-grading, rows update as games go final (games with
  `is_final` grade within the hour).
- **Rules** — short static card: 6 picks, spreads/totals, any NFL/CFB mix, 1
  POTW worth 3 pts, Friday 12pm ET deadline, lines stamped at submit, 5-min
  edit window, Cover Points tiebreaker explained with the −7/win-by-21 → +14
  example, Thursday-night + weekday games excluded.

**Graded view (past weeks):** week selector; my picks with result chips
(✓ win / ✗ loss / — push), each showing `stamped line`, final score, and that
pick's cover points (+14 etc.), plus the week's point total.

## Season span

The competition runs from Week 0 (Practice Round, CFB opening weekend) through
**the comp week containing NFL Week 18** — for 2026 that's the week with the
Friday Jan 8, 2027 deadline. The sync never creates weeks after that (no NFL
playoffs, no CFB bowls beyond that point), so once the final week is graded the
week list simply ends. Give the page a **season-complete state**: when the
latest week is graded and no open week exists, show the final season leaderboard
as the hero ("Season over — final standings") instead of a picking UI.

## Rules the UI must respect (server enforces all of them — mirror in UX)

1. Deadline passed → whole picking UI read-only ("This week is locked"). Users
   with no submission that week simply sit out (0 points, no penalty).
2. Never render other users' picks/entries pre-deadline (RLS already returns
   nothing — don't cache a post-deadline response into a pre-deadline view).
3. The client NEVER sends a line — sides + games only. Lines shown in the tray
   pre-submit are informational ("current consensus").
4. Countdown clocks: compute against server timestamps (`deadline`,
   `editable_until`); don't gate anything on the client clock alone — the RPCs
   are the authority and their errors are already human-readable.
5. All times displayed in the user's local timezone with ET noted for the
   deadline ("Fri 12:00 PM ET · 9:00 AM your time" style).

## Polish bar

iOS-style components consistent with the rest of the app (`GlassCard`,
`FilterPill`, shimmer skeletons while loading, dark mode). The pick buttons are
the hero interaction — big tap targets, satisfying selected states, subtle
spring on select. This page should feel like a game, not a form.

## QA script

1. As a Pro user: build a 6-pick draft mixing NFL + CFB spreads and totals,
   navigate to /games and back → tray fully restored from the server.
2. Try submitting with 5 picks → disabled; with 6 + no star → nudge; with 6 + 1
   star → success, stamped lines appear, 5-minute countdown runs.
3. Edit within the window → back to draft; resubmit → lines re-stamped.
4. Free user → Pro gate.
5. Most Picked before deadline → locked state (the RPC errors if called).
6. Leaderboard renders empty-state gracefully (season hasn't started).

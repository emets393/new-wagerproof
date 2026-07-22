# Historical Trends (web workbench)

The unified, chat-forward Historical Trends page at `/historical-trends?sport=nfl|cfb|mlb&bet=<betType>`.
One sport-agnostic workbench renders every sport through a `TrendsSportAdapter`
(`components/adapters/{nfl,cfb,mlb}.tsx`) — bet spine, RPC names, snapshot⇄filters transcription,
NL chat binding, rail sections, chips, copy. Replaced the three per-sport analytics pages.

## Page anatomy (top → bottom)

The page is a full-height column (`/historical-trends` is a `SPLIT_VIEW_ROUTES` entry in `App.tsx`,
so it manages its own layout instead of the main page scroller): a single internal scroll region
holds the results, and the chat dock is pinned below it and never scrolls. There's no page-level
header — the title lives in the breadcrumb (`MinimalHeader`).

- **Results** (`SportWorkbench`, keyed by sport, scrolls internally): Systems Leaderboard banner →
  optional “Viewing {system} by {user}…” banner → right-aligned control row (**Save System** /
  **My Systems** for signed-in users + a **Filters** pill with active-count badge) sits above the
  first card → `CoverageBadge` → hero (`TrendsHero`, or `SymmetricSplitHero` on the two-sided-market
  tautology) → `SituationsGrid` (animated split bars from `SplitBars`) — a **multi-market** card: its
  own market multi-select (top-right, lifted from the chat bar) shows the same filtered games'
  situations for up to 6 markets at once in a 2×3 grid, each market fetching analysis independently
  (the active market's query key matches the page's, so it's shared, not refetched; focus-to-filter
  stays wired only on the active market's panel) → `BreakdownTable`, the container-less deep-dive: modern folder tabs (raised active tab
  "cuts" a baseline border) over the adapter's dimension tables (Team, Coach, Referee, Conference,
  Ballpark…) + **Upcoming** (`UpcomingMatches`). The team/dimension **search** shares the folder-tab
  row (owned by `BreakdownTable`, appears once a tab has >8 rows); a **square 3-way sort picker**
  (Games / {outcome} % / ROI) sits top-right above the metric columns it orders. All rows render at
  once — no cap, no inner scroll — so the long list scrolls with the page under the chat dock.
  `HeroGauge` is a pure-SVG gradient ring with a baseline tick and count-up.

## Systems (Save / My Systems / Leaderboard)

Shareable filter+side “systems” live in `{sport}_analysis_saved_filters` on the **main** Supabase
project (warehouse stays analysis-only). UI under `systems/`:

- **Save System** — multi-step dialog (totals Over/Under; symmetric side markets force
  Home/Away/Fav/Dog then ON/AGAINST). Inserts `verdict`, `rpc_bet_type`, `rpc_filters`, `is_public`.
  User-facing copy never says verdict/RPC; share helper says “10+ games of history”.
- **My Systems** — sheet for the current sport (toggle All sports). Rename / share / delete /
  tap-to-load (switches sport when needed).
- **Systems Leaderboard** — banner → dialog with **Sport filter (All / MLB / NFL / CFB)** required
  on web (native is sport-scoped per screen). Sort: Best ROI / record / units / hottest streak.
  Cards show filter-timeframe record, this season, last-10, streak, filter chips; 🔥/❄️ thresholds
  match native. `All` fetches `analysis_systems_leaderboard` once per sport and merges by ROI.
  Tap card → apply filters + bet type (sport switch first) + viewing banner.

See `.claude/docs/trends-systems/07_SYSTEMS_LEADERBOARD.md`. Legacy `SavedFiltersMenu` remains on
disk but is no longer mounted on the page.
- **Bottom dock** (`TrendsChatBar`): Claude-composer-style chat bar pinned with `absolute bottom-0`
  inside the workbench's full-height column (so it stays put while the results scroll behind it),
  over a seamless background-colored scrim + progressive blur. The control row holds the filter
  summon (+ badge), the sport SegmentedControl, the bet-market dropdown, and the send orb.
  Suggestion pills (adapter presets + NL examples, shuffleable, gradient orbs) float above and
  step aside while typing. Bottom-left corner hosts `RecentSearchesDock` — always in place,
  translucent when idle, restored on hover; lists the last chat queries (`useTrendsRecents`,
  localStorage per sport, mirrors iOS).

## Filters

All filters live in one summonable panel (`FilterDrawer.tsx`), opened from the header pill or the
composer. On xl+ it's `InlineFilterPanel` — it takes its own column beside the results (content
shifts over, no overlay) so filter tweaks and the live data sit side by side; below xl the same
`PanelBody` renders as a right-hand modal sheet (`FilterDrawer`). The panel renders the adapter's
`RailSections` inside `FilterSectionsCtx` (`filterSections.ts`): each `FilterGroup`
(`FilterControls.tsx`) looks up its own title in `adapter.groupFields`, diffs those snapshot keys
against `adapter.reset(betType)`, and uses the count to badge itself, glow, and auto-expand.
Sections with active filters float to the top via CSS `order` — frozen at open time
(`floatTitles`) so a section never teleports mid-interaction. Active chips (`ActiveChips`) pin
under the panel header for one-tap clearing. The panel header's **Minimize all** button bumps a
`collapseSignal` in `FilterSectionsCtx`; each `FilterGroup` watches it and collapses on change (not
on mount), so one click closes every open section. The panel's own scrollbar is hidden (matching
the app-wide treatment) while still scrolling.

**Keep `adapter.groupFields` in sync when adding/removing controls in a rail group** — titles are
the lookup keys; the shared football groups live in `FOOTBALL_SHARED_GROUP_FIELDS`
(`FootballRailShared.tsx`).

Micro-controls: `FancySlider` (gradient range, glow thumbs, drag value bubble — scoped here, the
rest of the app keeps the stock slider), sliding tri-state `TriRow`, `MultiToggle`, band chips.

## Data flow

Snapshot per sport lives in the outer `TrendsWorkbench` (survives sport switches); the inner
`SportWorkbench` debounces `toRpcFilters` 350ms into two React Query calls against the CFB
Supabase (`adapter.analysisRpc` / `adapter.upcomingRpc`). Chat goes through the
`nl-filter-patch` edge function and applies ops via `adapter.applyChat`. Results stay mounted
across refetches (opacity dim, never unmount); the very first load shows `TrendsSkeleton` — a
full-page shimmer scaffold mirroring the hero → situations → breakdown stack, not a lone box.

Filter-side internals (schemas, NL patching, parity with iOS) are documented in
`.claude/docs/trends-systems/`.

# Parity Tracker

Status of the Android port vs the iOS source of truth. One row per iOS area; a row is ✅ only when
the Android implementation, navigation, loading/error/empty states, and iOS-aligned presentation
have been audited. Backend-dependent launch gates are listed separately below.

Legend: ⬜ not started · 🔨 in progress · ✅ source-complete/validated · 🧪 physical-device evidence pending · 🎫 waiver(s) attached

| Area | iOS files | Inventory doc | Status |
|---|---|---|---|
| Gradle scaffold / modules | — | PLAN.md | ✅ compiles |
| :core:models | 46 | 01_models.md | ✅ compiles |
| :core:services | 38 (41 files) | 02_services.md | ✅ compiles |
| :core:stores | 54 | 03_stores.md | ✅ compiles (59 files) |
| :core:design tokens/typography/animations | 26+2 | 04_design.md | ✅ compiles |
| Design: shimmer/skeleton/staggered-appear | | 04_design.md | ✅ compiles |
| Design: PixelGlyphField / PixelDotBackground / WaveBackground / PixelWaveBackground | | 04_design.md | ✅ compiles |
| Design: liquidGlassBackground (haze) + AppIcon enum (145 symbols) | | 04_design.md | ✅ compiles |
| Design: PixelOffice assets + Canvas sim | | 04_design.md + 05 part4 | ✅ compiles |
| :core:shared widget-payload store | 2 | 02/08 | ✅ compiles |
| App shell: RootRouter phases / MainTabView / tab bar / deep links | 5 | 08 | ✅ onboarding enabled; entitlement resolver fails closed before exposing shell |
| Auth (8) | 8 | 08 | ✅ compiles (🎫 #201 Apple sign-in dropped — owner-confirmed 2026-07-31; adds reset-password screen) |
| Onboarding (24 steps — 21 carousel pages + 3 cinematics) | 22 | 06 | ✅ research-time/stakes cost/reclaim arc, leaderboard, generation/reveal/time summary; 🎫 ATT omitted |
| Paywall (6) + RevenueCat | 6 | 08 | ✅ custom checkout + generic gates, default-hard remote gate, exact offer terms, restore/sign-out/error/accessibility paths, customer center, attribution, app-to-web checkout link-out (URL shapes unit-tested in `PaywallPlanResolverTest`) |
| Games feed + GameCards (universal GameRowCard, CollapsingWidgetScroll) | 21 | 07 | ✅ audited expanded and compact layouts |
| Sport detail pages: NFL / CFB / NBA / NCAAB / MLB bottom sheets | 31 | 07 | ✅ audited heroes, cards, charts, sheets, locked states, and compact layouts |
| Scoreboard (live polling) | 6 | 07 | ✅ compiles |
| Agents: hub / detail / public / settings / stats | 8 | 05 part1 | ✅ 2026-08-05 parity wave: opaque hero mask + transparent bar, leaderboard/stats pull-to-refresh, sticky Top Picks header, MY AGENTS header + sort menu, full-swipe delete, hub haptics, settings fast-paint, todaysBetItems on public page, 160-pt chart downsampling (🎫 #231, #336) |
| Agents: creation wizard (6 steps + intro + celebration + inputs) | 17 | 05 part2 | ✅ PixelWave launch builder + existing wizard (🎫 #079); copy-build hides the bottom bar |
| Agents: tickets / folder / focus printer / feed | 15 | 05 part3 | ✅ share exports a rendered ticket PNG, measured printer feed (#214 resolved), rolodex pile physics + two-stage sheet (#212 narrowed), scroll-gated parallax (🎫 #203, #215) |
| Agents: office sim, cards, charts, HR/regen/autopilot sheets | 28 | 05 part4 | ✅ generation card visual suite (desk avatar, glyph matrix, thinking verbs, pulse waves), swipe-to-generate pill (#305 resolved), AutoPilot notifications card, office pauses off-tab (🎫 #205 chrome-only, #071, #301) |
| Chat: WagerBot (SSE, ContentBlocks, threads) | 17 | 06 | ✅ compiles; assistant messages are selectable and copyable |
| Chat: voice mode (OpenAI Realtime PTT) | | 06 | ✅ retained as developer-only code; no production entry point (owner decision) |
| Props (16) | 16 | 06 | ✅ compiles (🎫 #240–#242); NFL detail rebuilt 2026-08-15 as the web player-analysis page (six sections: Projection / Recent Games / Matchup / H2H / Situations / Best Lines; picker filters like web MarketToggle; MLB hero chrome 134/126 + hit-% badge; signal strip/sheets removed) |
| Outliers (29) | 29 | 06 | ✅ compiles (🎫 #024 carried, #230–#236) |
| Analytics / Historical Trends (13) | 13 | 08 | ✅ full filters, MLB route/copy, hero/narrative/share, Saved Systems + leaderboard, NL filter chat |
| LearnMore (11) | 11 | 08 | ✅ compiles |
| Settings (9) + Secret Settings | 9 | 08 | ✅ includes server-backed account deletion and comprehensive agent stats |
| Search (4) | 4 | 08 | ✅ compiles |
| FeatureRequests (4) | 4 | 08 | ✅ compiles |
| Roast (6) | 6 | 08 | ✅ compiles (🎫 #061 mic seam carried) |
| Navigation components (5) | 5 | 08 | ✅ compiles |
| Widgets ×2 (Glance) | 8 | 08 | ✅ Agent Monitor + per-instance configurable Top Outliers markets; installed-domain sync + Pro-safe Parlay cache/render gate (🎫 #210 gradient, #211 symbols) |
| Visual regression matrix | 40 scenarios | [VISUAL_REGRESSION.md](VISUAL_REGRESSION.md) | 🧪 harness exists; Wave 2 captures not run because no Android device is connected |
| Play-Store build readiness (release bundle, R8 rules, icon, signing docs) | — | — | ✅ locally verifiable; production credentials and store configuration remain launch gates |

## Cross-platform features (not from the iOS inventory)

Features built for all clients at once rather than ported from an existing iOS screen. They are
not counted in `docs/inventory/`, which is a snapshot of the iOS tree at port time.

| Feature | Android files | Doc | Status |
|---|---|---|---|
| Agent Consensus on game cards | `core/models/GameAgentConsensus.kt`, `core/services/AgentConsensusService.kt`, `core/stores/AgentConsensusStore.kt`, `app/features/gamecards/AgentConsensusStrip.kt`, `app/features/games/GameConsensusKey.kt` | [18_agent_consensus.md](../../.claude/docs/18_agent_consensus.md) | ✅ three tiers, both card layouts, all 5 sports |
| Parlay God | `core/models/ParlayGod.kt`, `core/services/ParlayGod*.kt`, `core/stores/ParlayGodStore.kt`, `app/features/parlaygod/*` | — | ✅ engine + shared store + Outliers, Props Cheats, Search, MLB/NFL matchup surfaces, paywall/detail states, widget market |
| Play In-App Review | `core/stores/ReviewPromptCoordinator.kt`, `app/features/settings/PlayStoreReview.kt`, `app/nav/RootHost.kt` | 08 | ✅ six value triggers + threshold/cooldown/version/manual guards; real prompt requires Play-distributed testing |
| Preferred sportsbooks | `core/models/SportsbookQuote.kt`, `core/services/SportsbookOddsService.kt`, `core/stores/SportsbookPreferenceStore.kt`, `app/features/gamecards/BestBookChip.kt`, Settings "My Sportsbooks" | 07 / WIDGET_DESIGN §13 | ✅ NFL/CFB/MLB game detail + NFL props; empty preference = best number anywhere; never hide a better line |

Notes on the consensus port:

- One RPC per **slate**, driven from `GamesScreen`, never per card — the flag threshold scales
  with the whole day's pick volume. Every distinct feed date goes in one call (MLB spans today
  and tomorrow).
- `AgentConsensusStore` sits beside `GamesStore` in `AppGraph` rather than inside it:
  `GamesStore` reads the CFB project, consensus reads MAIN, and the merge is a client-side left
  join on `game_id`.
- The strip is its own row after `BottomRow` in both `StandardLayout` and `BreakdownLayout`. It is
  deliberately **not** in the `ConvictionBadges` FlowRow — MAMMOTH is a model signal and BET is a
  crowd signal, and that bottom row is the one that previously blew cards up to ~300dp tall.
- `AgentOverlapFooter.kt`'s avatar stack was promoted to a public `AgentAvatarStack` +
  `AgentAvatarChip` so the footer and the strip share one renderer at different sizes/rings.
- Search reuses the same `*GameCard` composables but passes no consensus (the parameter defaults
  to null), so strips stay hidden there — matching iOS.
- MLB is the only sport exercising this today; the others are offseason.
- `GameAgentConsensus` decodes `market_agents` / `market_label` (market-scoped agreement, from the
  iOS/web commit b506e291) ahead of the game-detail widget port, so the model is ready when that
  surface lands. Both fall back the way web does (`market_agents ?? agents`) for pre-migration rows.
- `AgentConsensusStore.ensureLoaded(sport, date)` now hydrates the shared detail widget; the feed path
  continues using the slate-date list overload.

## Detail-page audit notes

- The game-detail carousel and all five sport detail hosts share the same safe-area, collapse, and
  glass-scene behavior. Compact headers retain date, status, both teams, moneylines, spread, and
  total instead of reducing to logos only.
- NFL detail includes public betting and head-to-head data; head-to-head is sourced from
  `nfl_matchup_history`. Line movement is a separate source — see the next note.
- NFL and CFB line-movement charts read the game-keyed `nfl_line_movement` / `cfb_line_movement`
  consensus views by slate `game_id`. The slate's `fg_*_open` is the labelled opener — slate close
  is used only as an explicitly relabelled fallback — and a series with fewer than 2 distinct values
  is not charted at all. Android is **ahead of iOS** on this widget: iOS still ships the waiver-#033
  stub.
- CFB pick cards render `counter_signal_keys` as amber "argues against" chips (2026-08-25,
  mirrors iOS `relevantSignals`; NFL already carried stance via the embedded `signals` jsonb).
  Counter keys always land in the contradicting bucket with the opposite side attached.
- MLB regression cards distinguish aligned, contradictory, and unavailable signals. NCAAB cards
  use mapped ESPN team artwork and known school colors, with deterministic initials/colors for
  schools missing upstream brand metadata.
- When a backend table returns no rows, the associated section is intentionally omitted or shows
  the iOS-equivalent unavailable state. This is data absence, not a UI placeholder.
- The three iOS "threshold vs model, gap highlighted" edge charts (`SpreadCoverBar`,
  `ModelEdgeRail`, `MoneylineEdgeBar`, all per-sport-scaled via `EdgeScale`) are ported to
  `core/design/components/`. NFL and CFB wire all three group families (spread, total, moneyline —
  CFB's moneyline row stays display-only, no chart); NBA/NCAAB wire spread + total, gated on the
  model-fair-value fields so the classifier-probability fallback (which echoes the market number
  back as "the model") never draws a chart; MLB wires moneyline + total. Every call site degrades to
  the old two-box comparison when a raw market or model number is missing.

## Historical Trends notes

The Android workbench now carries the full requested iOS surface and the earlier correctness fixes:

- Complete sport-aware filter taxonomy, active chips, fold/search behavior, MLB pitcher selection,
  snapshot round-tripping, and MLB copy/venue routes.
- Contextual hero and narrative, share-card rendering through a package-derived FileProvider URI,
  Saved Systems creation/decoding, grader-compatible payloads, and systems leaderboard/hub.
- Natural-language filter dock patches the typed filter snapshot instead of maintaining a divergent
  second query state. Unit contracts cover filter chips, MLB search, snapshots, share context,
  narrative/hero text, system payloads, and save flow.

## Production launch gates

The native feature implementation is complete, but a production release still requires validation
with the real distribution identity and external dashboards:

- Firebase Android registration and `google-services.json`; verify FCM token persistence. The
  backend dispatch path now exists in code, so what remains is to set `FCM_SERVICE_ACCOUNT_JSON` and
  deploy `send-agent-pick-ready-notification`, then verify end-to-end delivery.
- Google OAuth registration for `com.wagerproof.mobile` with the final Play signing SHA-1/SHA-256.
- Play App Signing/release keystore, monotonically increasing version code, listing, privacy/data
  safety declarations, and internal-track install testing.
- RevenueCat Android products, entitlement `WagerProof Pro`, offerings/placements, Play package,
  and web-purchase redemption callback verified against the release application ID.
- Meta Android package/activity, client token/app ID, and final signing key hashes.
- Play In-App Review must be exercised from an internal/test track; sideloaded debug builds cannot
  provide authoritative prompt/rating evidence and the API deliberately reports no completion result.

These are external release checks; the side-by-side `.debug` build cannot resolve Play products
registered only for the production application ID.

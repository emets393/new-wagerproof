# Parity Tracker

Status of the Android port vs the iOS source of truth. One row per iOS area; a row is ✅ only when
the Android implementation, navigation, loading/error/empty states, and iOS-aligned presentation
have been audited. Backend-dependent launch gates are listed separately below.

Legend: ⬜ not started · 🔨 in progress · ✅ done · 🎫 waiver(s) attached

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
| App shell: RootRouter phases / MainTabView / tab bar / deep links | 5 | 08 | ✅ compiles |
| Auth (8) | 8 | 08 | ✅ compiles (🎫 #201 Apple sign-in dropped — owner-confirmed 2026-07-31; adds reset-password screen) |
| Onboarding (22: 18 steps — 16 carousel pages + 2 cinematics) | 22 | 06 | ✅ compiles (🎫 #202 ATT step removed — no Android equivalent; personalizedValue removed — matches iOS) |
| Paywall (6) + RevenueCat | 6 | 08 | ✅ native paywall, customer center, entitlement refresh, restore, and web redemption |
| Games feed + GameCards (universal GameRowCard, CollapsingWidgetScroll) | 21 | 07 | ✅ audited expanded and compact layouts |
| Sport detail pages: NFL / CFB / NBA / NCAAB / MLB bottom sheets | 31 | 07 | ✅ audited heroes, cards, charts, sheets, locked states, and compact layouts |
| Scoreboard (live polling) | 6 | 07 | ✅ compiles |
| Agents: hub / detail / public / settings / stats | 8 | 05 part1 | ✅ compiles |
| Agents: creation wizard (6 steps + intro + celebration + inputs) | 17 | 05 part2 | ✅ compiles (🎫 #079/#080/#081) |
| Agents: tickets / folder / focus printer / feed | 15 | 05 part3 | ✅ compiles (🎫 #203 SensorManager, #212/#213/#214) |
| Agents: office sim, cards, charts, HR/regen/autopilot sheets | 28 | 05 part4 | ✅ compiles (🎫 #205 Canvas charts, #071) |
| Chat: WagerBot (SSE, ContentBlocks, threads) | 17 | 06 | ✅ compiles; assistant messages are selectable and copyable |
| Chat: voice mode (OpenAI Realtime PTT) | | 06 | ✅ compiles (orb UI, no waveform — parity); the voice screen owns the mic-permission prompt and holds the screen on for the call |
| Props (16) | 16 | 06 | ✅ compiles (🎫 #240–#242) |
| Outliers (29) | 29 | 06 | ✅ compiles (🎫 #021/#024 carried, #230–#236) |
| Analytics (13) | 13 | 08 | 🔨 correctness fixed, taxonomy expansion pending — see Historical Trends notes |
| LearnMore (11) | 11 | 08 | ✅ compiles |
| Settings (9) + Secret Settings | 9 | 08 | ✅ includes server-backed account deletion and comprehensive agent stats |
| Search (4) | 4 | 08 | ✅ compiles |
| FeatureRequests (4) | 4 | 08 | ✅ compiles |
| Roast (6) | 6 | 08 | ✅ compiles (🎫 #061 mic seam carried) |
| Navigation components (5) | 5 | 08 | ✅ compiles |
| Widgets ×2 (Glance) | 8 | 08 | ✅ compiles (🎫 #210 gradient, #211 symbols) |
| Visual regression matrix | 40 scenarios | [VISUAL_REGRESSION.md](VISUAL_REGRESSION.md) | ✅ deterministic root/detail/loading/empty/locked/compact captures on device |
| Play-Store build readiness (release bundle, R8 rules, icon, signing docs) | — | — | ✅ locally verifiable; production credentials and store configuration remain launch gates |

## Cross-platform features (not from the iOS inventory)

Features built for all clients at once rather than ported from an existing iOS screen. They are
not counted in `docs/inventory/`, which is a snapshot of the iOS tree at port time.

| Feature | Android files | Doc | Status |
|---|---|---|---|
| Agent Consensus on game cards | `core/models/GameAgentConsensus.kt`, `core/services/AgentConsensusService.kt`, `core/stores/AgentConsensusStore.kt`, `app/features/gamecards/AgentConsensusStrip.kt`, `app/features/games/GameConsensusKey.kt` | [18_agent_consensus.md](../../.claude/docs/18_agent_consensus.md) | ✅ three tiers, both card layouts, all 5 sports |

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
- `AgentConsensusStore.ensureLoaded(sport, date)` — the single-date overload — exists but has **no
  caller** until the game-detail widget is ported. The feed path uses the list overload.

## Detail-page audit notes

- The game-detail carousel and all five sport detail hosts share the same safe-area, collapse, and
  glass-scene behavior. Compact headers retain date, status, both teams, moneylines, spread, and
  total instead of reducing to logos only.
- NFL detail includes public betting and head-to-head data; head-to-head is sourced from
  `nfl_matchup_history`. Line movement is a separate source — see the next note.
- NFL and CFB line-movement charts read the game-keyed `nfl_line_movement` / `cfb_line_movement`
  consensus views by dry-run `game_id`. The slate's `fg_*_open` is the labelled opener — slate close
  is used only as an explicitly relabelled fallback — and a series with fewer than 2 distinct values
  is not charted at all. Android is **ahead of iOS** on this widget: iOS still ships the waiver-#033
  stub.
- MLB regression cards distinguish aligned, contradictory, and unavailable signals. NCAAB cards
  use mapped ESPN team artwork and known school colors, with deterministic initials/colors for
  schools missing upstream brand metadata.
- When a backend table returns no rows, the associated section is intentionally omitted or shows
  the iOS-equivalent unavailable state. This is data absence, not a UI placeholder.

## Historical Trends notes

The Historical Trends workbench had a correctness pass, not a full build-out. The row stays 🔨 —
a wider taxonomy expansion is scheduled later.

- Fixed: 1H and team-total snapshot fields, a sport-scoped bet-type dropdown, `cfb_teams` as the
  logo source, MLB snapshot dimensions, refetch errors surfaced instead of swallowed, ROI on
  moneyline markets, the legacy-fallback correction, and a parallel RPC fetch.
- Added: an MLB **By Venue** breakdown tab alongside By Team, and market-scoped sheet sections.

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

These are external release checks; the side-by-side `.debug` build cannot resolve Play products
registered only for the production application ID.

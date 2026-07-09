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
| :core:stores | 54 | 03_stores.md | ✅ compiles (56 files) |
| :core:design tokens/typography/animations | 26+2 | 04_design.md | ✅ compiles |
| Design: shimmer/skeleton/staggered-appear | | 04_design.md | ✅ compiles |
| Design: PixelGlyphField / PixelDotBackground / WaveBackground / PixelWaveBackground | | 04_design.md | ✅ compiles |
| Design: liquidGlassBackground (haze) + AppIcon enum (145 symbols) | | 04_design.md | ✅ compiles |
| Design: PixelOffice assets + Canvas sim | | 04_design.md + 05 part4 | ✅ compiles |
| :core:shared widget-payload store | 2 | 02/08 | ✅ compiles |
| App shell: RootRouter phases / MainTabView / tab bar / deep links | 5 | 08 | ✅ compiles |
| Auth (8) | 8 | 08 | ✅ compiles (🎫 #201 Apple sign-in dropped; adds reset-password screen) |
| Onboarding (22: 18 steps + 2 cinematics) | 22 | 06 | ✅ compiles (🎫 #202 ATT no-op) |
| Paywall (6) + RevenueCat | 6 | 08 | ✅ native paywall, customer center, entitlement refresh, restore, and web redemption |
| Games feed + GameCards (universal GameRowCard, CollapsingWidgetScroll) | 21 | 07 | ✅ audited expanded and compact layouts |
| Sport detail pages: NFL / CFB / NBA / NCAAB / MLB bottom sheets | 31 | 07 | ✅ audited heroes, cards, charts, sheets, locked states, and compact layouts |
| Scoreboard (live polling) | 6 | 07 | ✅ compiles |
| Agents: hub / detail / public / settings / stats | 8 | 05 part1 | ✅ compiles |
| Agents: creation wizard (6 steps + intro + celebration + inputs) | 17 | 05 part2 | ✅ compiles (🎫 #079/#080/#081) |
| Agents: tickets / folder / focus printer / feed | 15 | 05 part3 | ✅ compiles (🎫 #203 SensorManager, #212/#213/#214) |
| Agents: office sim, cards, charts, HR/regen/autopilot sheets | 28 | 05 part4 | ✅ compiles (🎫 #205 Canvas charts, #071) |
| Chat: WagerBot (SSE, ContentBlocks, threads) | 17 | 06 | ✅ compiles |
| Chat: voice mode (OpenAI Realtime PTT) | | 06 | ✅ compiles (orb UI, no waveform — parity) |
| Props (16) | 16 | 06 | ✅ compiles (🎫 #240–#242) |
| Outliers (29) | 29 | 06 | ✅ compiles (🎫 #021/#024 carried, #230–#236) |
| Analytics (13) | 13 | 08 | ✅ compiles |
| LearnMore (11) | 11 | 08 | ✅ compiles |
| Settings (9) + Secret Settings | 9 | 08 | ✅ includes server-backed account deletion and comprehensive agent stats |
| Search (4) | 4 | 08 | ✅ compiles |
| FeatureRequests (4) | 4 | 08 | ✅ compiles |
| Roast (6) | 6 | 08 | ✅ compiles (🎫 #061 mic seam carried) |
| Navigation components (5) | 5 | 08 | ✅ compiles |
| Widgets ×2 (Glance) | 8 | 08 | ✅ compiles (🎫 #210 gradient, #211 symbols) |
| Visual regression matrix | 40 scenarios | [VISUAL_REGRESSION.md](VISUAL_REGRESSION.md) | ✅ deterministic root/detail/loading/empty/locked/compact captures on device |
| Play-Store build readiness (release bundle, R8 rules, icon, signing docs) | — | — | ✅ locally verifiable; production credentials and store configuration remain launch gates |

## Detail-page audit notes

- The game-detail carousel and all five sport detail hosts share the same safe-area, collapse, and
  glass-scene behavior. Compact headers retain date, status, both teams, moneylines, spread, and
  total instead of reducing to logos only.
- NFL detail includes public betting, line movement, and head-to-head data sourced from
  `nfl_matchup_history`; CFB line-movement charts render live history rather than placeholders.
- MLB regression cards distinguish aligned, contradictory, and unavailable signals. NCAAB cards
  use mapped ESPN team artwork and known school colors, with deterministic initials/colors for
  schools missing upstream brand metadata.
- When a backend table returns no rows, the associated section is intentionally omitted or shows
  the iOS-equivalent unavailable state. This is data absence, not a UI placeholder.

## Production launch gates

The native feature implementation is complete, but a production release still requires validation
with the real distribution identity and external dashboards:

- Firebase Android registration and `google-services.json`; verify FCM token persistence and the
  notification backend/service-account path under production RLS.
- Google OAuth registration for `com.wagerproof.mobile` with the final Play signing SHA-1/SHA-256.
- Play App Signing/release keystore, monotonically increasing version code, listing, privacy/data
  safety declarations, and internal-track install testing.
- RevenueCat Android products, entitlement `WagerProof Pro`, offerings/placements, Play package,
  and web-purchase redemption callback verified against the release application ID.
- Meta Android package/activity, client token/app ID, and final signing key hashes.

These are external release checks; the side-by-side `.debug` build cannot resolve Play products
registered only for the production application ID.

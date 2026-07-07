# Parity Tracker

Status of the Android port vs the iOS source of truth. One row per iOS area; a row is ✅ only when
every screen/component/state in its inventory doc exists and works against the real backend.

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
| Paywall (6) + RevenueCat | 6 | 08 | ✅ compiles (needs goog_ RC key) |
| Games feed + GameCards (universal GameRowCard, CollapsingWidgetScroll) | 21 | 07 | ✅ compiles |
| Sport detail pages: NFL / CFB / NBA / NCAAB / MLB bottom sheets | 31 | 07 | ✅ compiles (🎫 #032/#033 chart stubs carried) |
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
| Settings (9) + Secret Settings | 9 | 08 | ✅ compiles (🎫 #054 delete=sign-out carried) |
| Search (4) | 4 | 08 | ✅ compiles |
| FeatureRequests (4) | 4 | 08 | ✅ compiles |
| Roast (6) | 6 | 08 | ✅ compiles (🎫 #061 mic seam carried) |
| Navigation components (5) | 5 | 08 | ✅ compiles |
| Widgets ×2 (Glance) | 8 | 08 | ✅ compiles (🎫 #210 gradient, #211 symbols) |
| Play-Store readiness (release build, proguard, icon, signing docs) | — | — | ✅ assembleRelease green (unsigned 18.9 MB; needs keystore + `goog_` RC key + Android Google client ID) |

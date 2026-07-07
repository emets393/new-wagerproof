# WagerProof Android Native — Build Plan

Production-ready Jetpack Compose rebuild of `wagerproof-ios-native/` with 100% feature parity.
The parity contract lives in `docs/inventory/` (11 docs, exhaustively derived from the ~460 Swift files).

## Modules (mirror WagerproofKit layering)

| Module | iOS equivalent | Contents | Tech |
|---|---|---|---|
| `:core:models` | WagerproofModels (46) | Pure Kotlin/JVM data classes | kotlinx.serialization |
| `:core:services` | WagerproofServices (38) | Supabase clients ×2, auth, SSE, voice, RevenueCat, Mixpanel | supabase-kt 3.x, okhttp-sse, Credential Manager |
| `:core:stores` | WagerproofStores (54) | `@Stable` classes, `by mutableStateOf`, store-owned MainScope | compose-runtime only |
| `:core:design` | WagerproofDesign (26) + SharedKit (2) | Tokens, typography, glass, shimmer, procedural backgrounds, PixelOffice | Compose, haze |
| `:core:shared` | WagerproofSharedKit | Widget payload contract, app-group analog (DataStore) | DataStore |
| `:app` | Wagerproof/ (286) | Feature packages mirroring `Features/` 1:1, single Activity | Compose |
| `:widgets` | WagerProofWidgetExtension (8) | 2 home-screen widgets | Glance |

## Architecture decisions (locked, do not relitigate)
- @Observable store → `@Stable` Kotlin class with `by mutableStateOf` + store-owned `MainScope`; `Task{}` → `scope.launch{}`. NOT ViewModel+StateFlow.
- DI: manual `AppGraph` in `Application.onCreate` + CompositionLocals. No Hilt.
- Navigation: stores own back stacks (`RootRouter` phases launching/unauthenticated/onboarding/ready + `MainTabStore` per-tab stacks), rendered with a hand-rolled AnimatedContent+BackHandler renderer. Not NavController.
- Sheets → `ModalBottomSheet` driven by store booleans; deep links `wagerproof://` via intent filters.
- Dark-only (iOS double-forces dark), portrait-locked, single Activity, minSdk 31, targetSdk 36.

## Backend (reuse everything, change nothing)
- Main Supabase `gnjrklxotmbvnxbnnqgq` (auth/user/agents/chat/polymarket/live) + CFB `jpxnjuwglavsjbgbasnl` (anon predictions). Anon keys hardcoded in source (deliberate — see 02_services.md; do NOT move to secrets).
- Google Sign-In via Credential Manager → `auth.signInWithIdToken`. Apple Sign-In dropped (FIDELITY-WAIVER).
- Edge functions as-is: `wagerbot-chat` + `wagerbot-agent` (SSE — port the Swift parser exactly, incl. the explicit `Authorization: Bearer` header workaround), `create-wagerbot-voice-session` → OpenAI Realtime over OkHttp WebSocket + AudioRecord/AudioTrack 24kHz PCM16 push-to-talk. Client must NOT send `session.update` and must NOT send the `OpenAI-Beta: realtime=v1` header.
- Push token: write FCM token into the `expo_push_token` column (iOS writes raw APNs hex there — verify server dispatcher handles FCM shape).
- RevenueCat: needs a NEW `goog_` Android API key (iOS key is `appl_…`); Google client ID for Android likewise.

## Phase order
1. ✅ Inventory (docs/inventory/)
2. ✅ Scaffold (all modules compile)
3. :core:design — tokens/typography/shimmer/backgrounds/PixelOffice assets first (everything depends on it)
4. :core:models — 46 files, kotlinx.serialization (see 01_models.md porting notes: FlexDouble/FlexInt serializers, lossy arrays, dual-casing, camelCase families)
5. :core:services — clients, auth, data services, SSE, voice
6. :core:stores — RootRouter/MainTabStore first, then per-feature stores
7. :app features — shell/nav first, then Games/GameCards (universal card), then Agents, Chat, Props, Outliers, Onboarding, remaining
8. :widgets + final verification + PARITY.md sign-off

## Cross-cutting parity gotchas (from inventory)
- `RootRouter.temporarilyDisableOnboarding = true` — onboarding hard-bypassed; carry the flag.
- CFB dryrun fetches hardcoded `week == 7`; CFB team trends hardcode season 2025. Port as-is.
- Three date-zone regimes coexist (agents device-local, outliers/MLB America/New_York, LiveScores NFL UTC) — do not unify.
- Chat `blocks` JSONB sometimes arrives as a JSON string → re-parse; lossy per-row decoding everywhere.
- `AgentSpriteIndex` FNV-1a hash must match iOS byte-for-byte; `UnitsCalculation` must match the SQL (`recalculate_avatar_performance`, Formula B, -110 fallback).
- Widget payload key is the legacy literal `"widgetPayload"` (NOT `widget_payload_v1`).
- Polymarket is cache-only (pg_cron) — no live API path.
- `wagerproof://reset-password` dead-ends on iOS — Android should add a real consumer (tracked as an improvement ticket, not silent parity break).
- Synthetic-data placeholders to keep: AgentFormChart buckets, recentWinPct, AgentSparkline (deterministic FNV-seeded PRNG).
- UNDER is red in pick cards but blue #3B82F6 in insight badges (deliberate legacy convention).

## Fidelity waivers
Numbered `// FIDELITY-WAIVER #NNN` comments + a ticket file under `docs/waivers/`. Existing iOS waivers (#008 team colors, #021, #024, #032/#033 chart stubs, #051 push token column, #053 Mixpanel purchase, #054 delete account, #061 roast mic, #070/#071 glow cycles, #079/#080/#081 creation Lotties) carry over. Android-new: #201 Apple Sign-In dropped, #202 ATT prompt replaced (no Android equivalent), #203 CoreMotion ticket parallax → Android SensorManager.

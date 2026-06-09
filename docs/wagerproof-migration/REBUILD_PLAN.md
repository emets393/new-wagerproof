# Wagerproof Swift Migration — Rebuild Plan

The working contract for porting the Wagerproof React Native app to a native Swift / SwiftUI iOS app (iOS 17+). Adapted from the Honeydew swift-migration `REBUILD_PLAN.md`. The Honeydew port is the reference for both **process** (this document) and **visual / interaction language** (the [07/08/09 native specs](https://github.com/anthropics/honeydew_ios_native/docs/swift-migration/)).

A page is "done" only when **every** item in the contract below holds. Reviewer agents reject work that fails any item.

---

## Source of truth

| File | What it tracks |
|---|---|
| [`inventory.csv`](./inventory.csv) | Auto-generated status of every RN `.ts`/`.tsx` file vs its Swift counterpart. Re-run anytime: `python3 scripts/wagerproof-migration/build-inventory.py` |
| [`inventory.overrides.csv`](./inventory.overrides.csv) | Human-edited verdicts. A reviewer adds a row when they sign off (`reviewed`) or when a file is intentionally out of scope (`wontport`). |
| [`navigation-map.md`](./navigation-map.md) | Authoritative map of every route, modal, sheet, deep link, push handler, and API call. |
| [`08-screen-native-spec.md`](./08-screen-native-spec.md) | Per-screen RN-component → SwiftUI-primitive mapping. Read your screen's section before you write any view code. |
| [`tickets/`](./tickets/) | Every fidelity gap we accept (waivers) becomes a numbered ticket here. **No in-line waivers without a ticket.** |
| [`parity/<screen>/`](./parity/) | Empty / loaded / error parity screenshots per ported screen. |

The Honeydew specs live at `/Users/chrishabib/Documents/honeydew/docs/swift-migration/`. Implementer agents pull `README.md`, `07-native-interactions.md`, `09-motion-and-haptics.md`, and the relevant feature subfolder into context.

---

## Hard rules

1. **Backend untouched.** Endpoints, payloads, auth, JSON shapes — byte-identical. The two Supabase projects (`gnjrklxotmbvnxbnnqgq` main + `jpxnjuwglavsjbgbasnl` CFB) and every edge function / RPC stay exactly as-is. If something on the backend looks wrong, file a ticket — do not fix in the port.
2. **No silent drops.** If a feature can't ship in scope, file a `docs/wagerproof-migration/tickets/NNN-<slug>.md` waiver AND annotate the Swift code with `// FIDELITY-WAIVER #NNN: <reason>`. Reviewer rejects any waiver without a tracked ticket.
3. **No stubs, no `@State` fakes, no "we'll come back."** Every screen wires to a real store hitting the real backend. Inline `@State` test arrays = automatic FAIL.
4. **Native iOS idioms always.** Never hand-roll a custom view when a SwiftUI primitive exists. The native catalog is [Honeydew's 07-native-interactions.md](https://github.com/anthropics/honeydew_ios_native/docs/swift-migration/07-native-interactions.md). Anything outside that catalog needs a justification in the screen's fidelity table.
5. **Honeydew visual language with Wagerproof tokens.** Spacing, motion curves, haptics, transitions follow [Honeydew's 05-design-system.md](https://github.com/anthropics/honeydew_ios_native/docs/swift-migration/05-design-system.md) + [09-motion-and-haptics.md](https://github.com/anthropics/honeydew_ios_native/docs/swift-migration/09-motion-and-haptics.md). Colors, brand marks, and typography use the Wagerproof palette (defined in `WagerproofKit/Sources/WagerproofDesign/Tokens.swift`).
6. **A screen without empty + loaded + error parity screenshots is not done.** All three states captured into `docs/wagerproof-migration/parity/<screen>/`.

---

## The agent contract (read before running any agent)

A page port is "done" only when ALL of these are true. Reviewer agents reject work that fails any item.

1. **Fidelity table** at `docs/wagerproof-migration/fidelity/<slug>.md` —
   exhaustive enumeration of the RN source, mapped row-by-row to the Swift counterpart. Required row categories:
   - **Visual structure** — every Container/SafeAreaView/ScrollView/FlatList/SectionList → its Swift analogue.
   - **Tokens** — every color hex, font family/size/weight, padding, border radius, shadow.
   - **Gestures** — every `onPress`, long-press, swipe, drag, pinch — what triggers, what fires.
   - **Navigation** — every `router.push/replace/navigate`, every bottom-sheet `openSheet(...)`, every `Linking.openURL`.
   - **Analytics** — every Mixpanel / RevenueCat / push event the screen fires.
   - **State reads/writes** — every `useContext`, `useState`, `useQuery`, `supabase.from(...)`, `supabase.rpc(...)`, `supabase.functions.invoke(...)` the screen touches.
   - **Async actions** — every fetch, every realtime subscription, every cold-start path.
   - **Empty / loading / error states** — the literal copy and the conditions that trigger each.

   Each row has a Match column: `✅ matches` / `🔧 fixed` (diverged and better — explain why) / `⚠️ #NNN` (waiver to open ticket) / `❌ missing`. A row marked `❌` is a FAIL.

2. **Diff list** in the agent report — derived from the fidelity table: every `🔧`, `⚠️`, and `❌` row listed explicitly. No surprises.

3. **Build green** — `xcodebuild -workspace wagerproof_ios_native/Wagerproof.xcworkspace -scheme Wagerproof -destination 'platform=iOS Simulator,name=iPhone 16 Pro,OS=latest' build` succeeds. Orchestrator runs this itself; doesn't trust the receipt.

4. **Parity screenshots** — three PNGs under `docs/wagerproof-migration/parity/<screen>/`:
   - `empty.png` — no-data state (logged out / no games / no picks).
   - `loaded.png` — populated with real production data (test account: TBD).
   - `error.png` — network failure / unauthorized / 500 from edge function.

   Each filename includes a SHA1 of the source for cache invalidation, e.g. `loaded-2026-05-20.png`.

5. **Tap-target proof** — a one-line log or screenshot showing every interactive element is hit-testable (minimum 44×44pt). For complex sheets, attach `xcrun simctl io booted screenshot --type=jpeg` with `--mask=alpha` to expose hit zones if a tap target is suspect.

6. **Real-store wiring** — the screen hydrates from a `@Observable` store under `WagerproofKit/Sources/WagerproofStores/`. The store calls real `WagerproofAPI` / `SupabaseClient` methods. If the store doesn't expose what's needed, file a store-bug ticket — do NOT inline a fetch in the view.

7. **No new icon waivers** — every Material/Lucide/Expo icon used in the RN source maps to an SF Symbol per `08-screen-native-spec.md`'s SF Symbol table. Untracked icon substitution is a FAIL.

8. **Reviewer signoff** — independent reviewer agent (fresh context, no implementer notes) reads both the RN source and the Swift source end-to-end, reconstructs the fidelity table from scratch, and confirms every row the implementer claimed. Implementer iterates until reviewer issues a clean PASS.

9. **Inventory updated** — the implementer appends rows to `inventory.overrides.csv` flipping status from `missing` → `candidate` after their pass. The reviewer flips `candidate` → `reviewed` after signoff. Re-running `build-inventory.py` confirms the change.

---

## Done = these eight bars, in order

| Gate | What |
|---|---|
| G1 | RN source read end-to-end (every hook, store, selector the screen touches) |
| G2 | Fidelity table written |
| G3 | Swift code written; build green |
| G4 | Real-store wiring verified (manual run on simulator with prod data) |
| G5 | Parity screenshots captured (empty/loaded/error) |
| G6 | Tap-target proof captured |
| G7 | Reviewer signoff |
| G8 | Inventory flipped to `reviewed` |

Skipping a gate doesn't ship the screen — it ships a regression.

---

## Phases

Phases run sequentially. We don't start Phase N+1 until Phase N's gate passes. Within a phase, batches run in parallel up to N agents.

### Phase 0 — Foundation (orchestrator)

- [x] `scripts/wagerproof-migration/build-inventory.py` — produces `inventory.csv`.
- [x] `docs/wagerproof-migration/navigation-map.md` — routes, sheets, deep links, push, API surface.
- [x] `docs/wagerproof-migration/REBUILD_PLAN.md` (this file).
- [ ] `docs/wagerproof-migration/08-screen-native-spec.md` — per-screen primitive map.
- [ ] `wagerproof_ios_native/` — Xcode project scaffold + `WagerproofKit` SPM package (`WagerproofModels`, `WagerproofServices`, `WagerproofStores`, `WagerproofDesign`, `WagerproofKit`).
- [ ] `WagerproofKit/Sources/WagerproofServices/WagerproofAPI.swift` — `actor` wrapping `URLSession`. Mirrors the RN client byte-for-byte.
- [ ] Two `SupabaseClient` actors (main + CFB). Auth listener bridged as `AsyncStream<AuthState>`.
- [ ] `RootRouter`, `AuthStore`, `AnalyticsStore`, `ThemeStore`, sheet stores (per `navigation-map.md` §2).
- [ ] Splash screen + auth gate redirect logic.

**Exit criteria**: an empty SwiftUI app that boots, accepts a Supabase login via email or Google, hits the `(drawer)/(tabs)` shell with placeholder tabs, and renders the user's `profiles` row in a debug panel.

### Phase 1 — Critical path

The path a new user actually walks: **Login → Games tab populates → tap NFL game card → NFLGameBottomSheet opens → tap "Bet on DraftKings" deep link**.

| Order | Screen / sheet | RN source | Swift target |
|---|---|---|---|
| 1 | LoginView | `app/(auth)/login.tsx` | `Features/Auth/LoginView.swift` |
| 2 | EmailLoginView | `app/(auth)/email-login.tsx` | `Features/Auth/EmailLoginView.swift` |
| 3 | OnboardingView | `app/(onboarding)/index.tsx` | `Features/Onboarding/OnboardingView.swift` |
| 4 | GamesView (home tab) | `app/(drawer)/(tabs)/index.tsx` | `Features/Games/GamesView.swift` |
| 5 | NFLGameCard | `components/NFLGameCard.tsx` | `Features/NFL/Components/NFLGameCard.swift` |
| 6 | NFLGameBottomSheet | `components/NFLGameBottomSheet.tsx` | `Features/NFL/Sheets/NFLGameBottomSheet.swift` |
| 7 | SportsbookButtons | `components/SportsbookButtons.tsx` | `Features/GameCards/Sheets/SportsbookButtons.swift` |

**Gate**: full critical-path smoke runs in the simulator without manual intervention against a real test account.

### Phase 2 — Tabs + tab content

Each tab gets its own batch. Reviewer signs off per batch.

- Picks tab (Editor Picks): `picks.tsx` + EditorPickCard, EditorPicksStatsBanner, PickDetailBottomSheet, EditorPickCreatorBottomSheet.
- Outliers tab: `outliers.tsx` + OutlierMatchupCard, OutliersHeroHeader, OutlierCardShimmer.
- Scoreboard tab: `scoreboard.tsx` + LiveScoreCard, LiveScoreDetailModal, LiveScorePredictionCard.
- Settings tab: `(tabs)/settings.tsx` + Discord modal, ios-widget modal, delete-account modal, ReviewRequestModal.
- Feature Requests tab: `feature-requests.tsx`.

### Phase 3 — Sport-specific game cards + bottom sheets (parallel)

Per-sport, one batch each:

- CFB: `CFBGameCard`, `CFBGameBottomSheet`, `CFBPredictionCard`, `cfb/*` subcomponents.
- NBA: `NBAGameCard`, `NBAGameBottomSheet`, `NBABettingTrendsBottomSheet`, `nba/*`.
- NCAAB: `NCAABGameCard`, `NCAABGameBottomSheet`, `NCAABBettingTrendsBottomSheet`, `ncaab/*`.
- MLB: `MLBGameCard`, `MLBGameBottomSheet`, `MLBBettingTrendsBottomSheet`, `mlb/*`.

### Phase 4 — Agents (the big one)

- `AgentsView` (list), `AgentCreateView`, `AgentDetailView`, `AgentDetailSettingsView`, `PublicAgentDetailView`.
- All agent components: `AgentCard`, `AgentChatRoom`, `AgentHRBottomSheet`, `AgentIdCard`, `AgentLeaderboard`, `AgentOverlapFooter`, `AgentPerformanceCharts`, `AgentPickCard`, `AgentPickItem`, `AgentPickPayloadAuditWidget`, `AgentPickRationaleWidget`, `AgentTimeline`, `CompanyDashboardBanner`, `TopAgentPicksFeed`.
- Creation flow (6 screens): `Screen1_SportArchetype` … `Screen6_Review`, plus `AgentBornCreationCelebration`, `AgentCreationGenerationIntro`.
- Agent inputs: `ArchetypeCard`, `OddsInput`, `SliderInput`, `SwipeableEmojiPicker`, `TimePickerModal`, `TimezonePickerModal`, `ToggleInput`.
- DevTools: `PixelOffice`, `PixelEmojiInline`, `PrinterSlipAnimation`, `ThinkingAnimation`, `GlowAccentBar`, `GlowingCardWrapper`.
- All `useAgent*` hooks → `AgentStore` Observable methods.

### Phase 5 — Chat + Voice

- WagerBot chat tab: `chat.tsx`, `WagerBotChat`, `WagerBotChatScreen`, `WagerBotChatBottomSheet`, `WagerBotInsightPill`, `WagerBotSuggestionBubble`, `FloatingAssistantBubble`.
- Chat subcomponents: `AssistantActionRow`, `ChatGameCard`, `ChatGameCardList`, `FollowUpPills`, `MessageBubble`, `ShimmerText`, `StreamingText`.
- Voice tab: `voice-chat.tsx`, `wagerbot-voice.tsx`, `VoiceSettingsSheet`, `useWagerBotVoice` hook → `VoiceStore`.
- Services: `wagerBotChatService`, `wagerBotVoiceService`, `wagerBotSuggestionService`, `geminiLiveService`.

### Phase 6 — Analytics dashboards

The analytics tab screens: NBA/NCAAB betting trends, NBA/NCAAB model accuracy, MLB betting trends, MLB regression report, and their per-game banners/widgets (`BettingTrendsBanner`, `ModelAccuracyBanner`, `MLBRegressionReportBanner`).

### Phase 7 — Settings, Modals, Roast, LearnMore

- Settings refinement: `secret-settings.tsx`, `delete-account.tsx`, `discord.tsx`, `ios-widget.tsx`.
- Roast tab: `roast.tsx`, `roast/*` components, `useRoastSession`.
- LearnMore: `learn-wagerproof/*`, `LearnWagerProofBottomSheet`, `LearnWagerProofContext`.
- ReviewRequestModal, PostOnboardingPaywall, RevenueCatPaywall, CustomerCenter.
- ToolExplainerBanner, ProContentSection, ProFeatureGate, LockedGameCard, LockedOverlay, LockedPickCard.

### Phase 8 — Polish + hardening

- Real-data smoke matrix run on iPhone 12 / 15 Pro / iPad mini.
- Crashlytics-equivalent (`MetricKit` + Sentry?) verified.
- Performance pass: cold-start ≤ 1.5s, tab swap ≤ 100ms, scroll perf 60fps on game list.
- TestFlight to internal users for two weeks.
- App Store submission. RN build retired from EAS.

---

## Agent fleet

| Role | Tool access | Output | Cadence |
|---|---|---|---|
| Architect (orchestrator) | Read-only across repo + write to `docs/wagerproof-migration/` | Phase queue + per-batch briefs | One-shot per phase |
| Data-layer fixer | Full code | Single store rewired + before/after store-audit | ~1 store per session |
| Page implementer | Full code, scoped to `wagerproof_ios_native/Wagerproof/Features/<area>/` and `WagerproofKit/Sources/<area>/` | One screen (or sheet) + fidelity table + parity screenshots + tap proof | ~1 screen per session |
| Reviewer | Read-only + simulator screenshots, NO Edit | Independent diff list + verdict | ~3–5 reviews per session |
| Integration smoke | Full simulator automation, no Edit | Recorded critical-path runthrough | One per phase end |

**Hard rules:**
- ≤ 2 implementer agents in parallel per feature directory.
- Reviewer never reuses an implementer agent's session — fresh context only.
- Architect's queue is the source of truth — implementers don't pick their own work.

---

## Waiver policy

Zero waivers without a tracked ticket. When an agent encounters a fidelity gap they can't resolve in scope, they MUST:

1. Create a ticket in `docs/wagerproof-migration/tickets/NNN-<slug>.md` using the template (see [`tickets/_template.md`](./tickets/_template.md)).
2. Reference the ticket ID in the source code comment: `// FIDELITY-WAIVER #042: <reason>`
3. Note it in the agent's report and in `inventory.overrides.csv`'s `note` column.

The reviewer rejects any waiver without a ticket. The
`scripts/wagerproof-migration/grep-waivers.sh` script greps for the `#NNN` syntax and confirms every waiver in code maps to an open ticket.

---

## Daily flow

1. Run `python3 scripts/wagerproof-migration/build-inventory.py` → updates `inventory.csv`.
2. Pick the next work from the active phase. Confirm the screen has no blocking ticket on a store it depends on.
3. Run an implementer agent against the screen with the contract.
4. Run a reviewer agent (fresh context) against the result.
5. If reviewer passes, append a row to `inventory.overrides.csv` flipping the screen to `reviewed`. Re-generate the inventory.
6. Loop.

---

## Status snapshot (Phase 1.3 author-time)

Run the generator to see live numbers. At the time this plan was written:

| Status | Count |
|---|---|
| reviewed | 0 |
| candidate | 0 |
| waivered | 0 |
| missing | 374 |
| **Total tracked** | **374** |

Type breakdown (initial sweep):

| Type | Count |
|---|---|
| component | 186 |
| hook | 35 |
| screen | 35 |
| service | 26 |
| store (context) | 24 |
| sheet | 24 |
| type | 15 |
| util | 11 |
| layout | 7 |
| module (native) | 4 |
| constant | 4 |
| asset | 1 |
| config | 1 |
| other | 1 |

The 186 "component" rows include many small co-located helpers that will be absorbed into a parent SwiftUI View as private subviews (legitimate coverage, just not tracked yet). The reviewer pass during Phase 1+ will reclassify these via `inventory.overrides.csv`.

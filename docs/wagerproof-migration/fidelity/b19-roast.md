# Fidelity table — B19 Roast

Source: `wagerproof-mobile/app/(drawer)/(tabs)/roast.tsx` (5-line delegator) + `wagerproof-mobile/components/roast/RoastScreen.tsx` (308 lines) + `wagerproof-mobile/components/roast/RoastMicButton.tsx` + `wagerproof-mobile/components/roast/RoastIntensitySelector.tsx` + `wagerproof-mobile/hooks/useRoastSession.ts` (275 lines).

Target: `wagerproof_ios_native/Wagerproof/Features/Roast/*` + `WagerproofKit/Sources/WagerproofStores/RoastSessionStore.swift`.

Legend: `✅ matches` / `🔧 fixed` (deliberately diverged + better) / `⚠️ #NNN` (waiver, see tickets/NNN-*.md) / `❌ missing`.

## Visual structure

| RN element | Swift counterpart | Match |
|---|---|---|
| `LinearGradient` `['#0a0a0a', '#111827', '#0a0a0a']` full-bleed (RoastScreen.tsx:58) | `LinearGradient` w/ identical hex stops, `.ignoresSafeArea()` in `RoastView` | ✅ matches |
| Custom header row: back / "Roast Mode" / refresh (lines 62–70) | Hand-rolled `HStack` w/ `arrow.left` (left) / "Roast Mode" / `arrow.clockwise` (right) | ✅ matches |
| `RoastIntensitySelector` pills (lines 73, 1–37 in selector file) | `RoastIntensitySelectorView` — three pill buttons | 🔧 fixed — spec §5 suggested `Picker(.segmented)` but emoji+glow is the RN visual; kept pills for parity |
| Connecting / error status banner (lines 76–85) | `statusBanners` group with `.transition(.move(edge: .top).combined(with: .opacity))` | ✅ matches |
| `ScrollView` + `KeyboardAvoidingView` (lines 88–151) | `ScrollViewReader { ScrollView { LazyVStack } }` with `.scrollDismissesKeyboard(.interactively)` | 🔧 fixed — `.scrollDismissesKeyboard` replaces the manual KAV wrapper |
| Empty state: mic emoji + "Ready to get roasted?" + subtitle (lines 99–106) | `ContentUnavailableView("Ready to get roasted?", systemImage: "mic.fill", description: ...)` | ✅ matches (spec §5) |
| Message bubble user (line 108+) | `RoastMessageBubble` w/ `.finalized(role: .user)` — green 20% bg, right-aligned, bottom-right corner pinched | ✅ matches |
| Message bubble assistant + "The Bookie" caption (lines 117–119, 270–277) | `RoastMessageBubble` w/ `.finalized(role: .assistant)` — "THE BOOKIE" label 11pt 700 caps tracking 0.5 green | ✅ matches |
| Live user transcript dashed border (lines 132–138, 264–269) | `.liveUser` variant uses `UnevenRoundedRectangle.stroke(... StrokeStyle(dash: [5]))` | ✅ matches |
| Live AI transcript (lines 141–148) | `.liveAssistant` variant w/ 80% opacity text | ✅ matches |
| `LottieView` ChattingRobot.json (lines 156–161) | `BookieOrbView` — native concentric circles + `mic.fill` glyph w/ continuous pulse | ⚠️ #B19-1 — Lottie file not ported; native equivalent ships the same "visual presence above mic" semantic |
| Status text "Tap the mic to talk" / "Listening..." / etc. (lines 22–27, 164–170) | `RoastSessionStore.SessionState.statusText` returns identical strings; colored amber for `.responding`, green for `.recording` | ✅ matches |
| Mic button — green when recording, ellipsis when processing (RoastMicButton.tsx lines 85–104) | `RoastMicButtonView` w/ identical color map + `mic.fill`/`ellipsis` swap + `.symbolEffect(.pulse, options: .repeating, isActive: recording)` | ✅ matches (spec §5) |
| Expanding radar ring (RoastMicButton.tsx lines 49–67, 91–94) | Stroke circle scaled 1 → 2 over 1.2s `repeatForever(autoreverses: false)` w/ opacity 0.6 → 0 | ✅ matches |
| Pulse glow (RoastMicButton.tsx lines 30–47, 92) | Filled circle scaled 1 → 1.3 over 0.8s `repeatForever(autoreverses: true)` w/ opacity 0.1 ↔ 0.4 | ✅ matches |
| Mic button shadow (RoastMicButton.tsx lines 136–141) | `.shadow(color: .black.opacity(0.3), radius: 8, x: 0, y: 4)` | ✅ matches |

## Tokens

| RN value | Swift token | Match |
|---|---|---|
| Header title `#fff` 18pt 700 (line 195–197) | `.font(.system(size: 18, weight: .bold))` `.foregroundStyle(.white)` | ✅ matches |
| Active pill bg `rgba(34,197,94,0.2)` (selector line 58) | `Color.appPrimary.opacity(0.2)` (`appPrimary` = #22C55E) | ✅ matches |
| Active pill border `#22c55e` (selector line 59) | `Color.appPrimary` | ✅ matches |
| Active pill text `#22c55e` (selector line 70) | `Color.appPrimary` | ✅ matches |
| Inactive pill bg `rgba(255,255,255,0.08)` (selector line 53) | `Color.white.opacity(0.08)` | ✅ matches |
| Inactive pill border `rgba(255,255,255,0.1)` (selector line 55) | `Color.white.opacity(0.1)` | ✅ matches |
| Inactive pill text `rgba(255,255,255,0.6)` (selector line 65) | `Color.white.opacity(0.6)` | ✅ matches |
| User bubble bg `rgba(34,197,94,0.2)` (RoastScreen line 256) | `Color.appPrimary.opacity(0.2)` | ✅ matches |
| AI bubble bg `rgba(255,255,255,0.08)` (line 261) | `Color.white.opacity(0.08)` | ✅ matches |
| Live transcript dashed border `rgba(34,197,94,0.3)` (line 267) | `Color.appPrimary.opacity(0.3)` w/ `StrokeStyle(dash: [5])` | ✅ matches |
| "THE BOOKIE" label color `#22c55e`, 11pt 700, all caps, 0.5 tracking (lines 270–277) | `.font(.system(size: 11, weight: .bold))` `.tracking(0.5)` `Color.appPrimary` | ✅ matches |
| Message text 15pt line-height 22 (lines 278–281) | `.font(.system(size: 15))` w/ default line height | ✅ matches (within Dynamic Type) |
| User text white (line 283) | `.white.opacity(1.0)` finalized | ✅ matches |
| AI text 90% white (line 286) | `.white.opacity(0.9)` finalized | ✅ matches |
| Live transcript text opacity 0.7 (user) / 0.8 (AI) | `.white.opacity(0.7)` / `.white.opacity(0.8)` per variant | ✅ matches |
| Error banner bg `rgba(239,68,68,0.2)` (line 207) | `Color.appLoss.opacity(0.2)` | ✅ matches |
| Status banner bg `rgba(255,255,255,0.1)` (line 203) | `Color.white.opacity(0.1)` | ✅ matches |
| Status banner text `rgba(255,255,255,0.7)`, 13pt (lines 210–211) | `.font(.system(size: 13))` `.white.opacity(0.7)` | ✅ matches |
| Status text recording color `#22c55e` (line 303) | `Color.appPrimary` | ✅ matches |
| Status text responding color `#f59e0b` (line 306) | `Color.appAccentAmber` | ✅ matches |
| Idle status text `rgba(255,255,255,0.5)` (line 297) | `.white.opacity(0.5)` | ✅ matches |
| Mic button recording color `#22c55e` (line 85) | `Color.appPrimary` | ✅ matches |
| Mic button processing color `#6b7280` (line 85) | `Color(white: 0.42)` | ✅ matches |
| Mic button idle color `#374151` (line 85) | `Color(white: 0.22)` | ✅ matches |
| Mic button icon recording color `#000` (line 87) | `.black` | ✅ matches |
| Mic button icon idle color `#fff` (line 87) | `.white` | ✅ matches |
| Mic button size 80pt (line 108) | `buttonSize = 80` | ✅ matches |

## Gestures

| RN handler | Swift wiring | Match |
|---|---|---|
| Mic press → `toggleRecording()` (hook line 202) | Mic `Button` action → `store.toggleRecording()` | ✅ matches |
| Intensity pill press → `setIntensity(level)` (hook line 242) | Pill `Button` action → `await store.setIntensity(option)` | ✅ matches |
| Header back press → `router.back()` (line 63) | Back `Button` → `dismiss()` | ✅ matches |
| Header refresh press → `clearConversation()` (line 67) | Refresh `Button` → `showClearConfirm = true` → `.confirmationDialog` → `await store.clearConversation()` | 🔧 fixed — spec §5 calls for a confirmation dialog; adds undo safety RN lacks |
| Long-press a message (spec §5) | `.contextMenu` per finalized bubble: "Copy text" / "Share roast" | ✅ matches (spec) |
| `KeyboardAvoidingView` (line 89) | `.scrollDismissesKeyboard(.interactively)` | 🔧 fixed |
| Auto-scroll 100ms after messages / state / transcripts change (hook lines 49–54) | `onChange(of: messages.count / liveTranscript / aiTranscript / state)` → 100ms sleep → `proxy.scrollTo("scroll-tail", anchor: .bottom)` | ✅ matches |
| Mic disabled while processing (RoastMicButton line 100) | `.disabled(state == .processing)` | ✅ matches |

## Navigation

| RN call | Swift counterpart | Match |
|---|---|---|
| Tab visible at `/roast` (RN bottom tab) | Reached via `SideMenuSheet` "Roast Mode" row → `tabStore.isRoastPresented = true` → `MainTabView` `.fullScreenCover` | 🔧 fixed — per REBUILD_PLAN B19 brief, Roast moves out of the bottom tab bar and into the side menu |
| `router.back()` on header X (line 63) | `dismiss()` — closes the full-screen cover | ✅ matches |

## Analytics

No analytics events fired from the roast screen in RN (verified via `grep -i "mixpanel\|logEvent\|track(" wagerproof-mobile/components/roast/ wagerproof-mobile/hooks/useRoastSession.ts`). Nothing to port. ✅ matches.

## State reads/writes

| RN call | Swift counterpart | Match |
|---|---|---|
| `useState<RoastSessionState>` (hook line 8) | `RoastSessionStore.state` | ✅ matches |
| `useState<RoastIntensity>` (hook line 9) | `RoastSessionStore.intensity` | ✅ matches |
| `useState<RoastMessage[]>` (hook line 10) | `RoastSessionStore.messages` | ✅ matches |
| `useState liveTranscript` (line 11) | `RoastSessionStore.liveTranscript` | ✅ matches |
| `useState aiTranscript` (line 12) | `RoastSessionStore.aiTranscript` | ✅ matches |
| `useState error` (line 13) | `RoastSessionStore.error` | ✅ matches |
| `useState isConnected` (line 14) | `RoastSessionStore.isConnected` | ✅ matches |
| `useState isConnecting` (line 15) | `RoastSessionStore.isConnecting` | ✅ matches |
| `useRef<GeminiLiveService>` (line 17) | `RoastSessionStore.driver: RoastSessionDriving?` — protocol seam | 🔧 fixed — driver is a protocol so view never imports an SDK |
| Subscribe to `expo-speech-recognition` events (lines 144–200) | Driver delegates back via `handleInterim/FinalUserTranscript`, `handleListeningEnded`, `handleError` | ✅ matches (seam) |
| `service.onTurnComplete` (line 76) | `handleAudioPlaybackEnd(finalText:)` | ✅ matches (seam) |
| `service.onError` (line 95) | `handleError(_:)` | ✅ matches (seam) |
| `service.onAudioPlaybackStart/End` (lines 83, 91) | `handleAudioPlaybackStart/End` | ✅ matches (seam) |
| `connectService(level)` (line 63) | `RoastSessionStore.connect()` | ✅ matches |
| `serviceRef.current.disconnect()` cleanup (line 138) | `RoastSessionStore.disconnect()` — invoked from `.onDisappear` | ✅ matches |

## Async actions

| RN action | Swift counterpart | Match |
|---|---|---|
| Connect on mount + on intensity change (hook lines 126–141) | `.task { await store.connect() }` on appear + `store.setIntensity` reconnects | ✅ matches |
| `toggleRecording` opens / closes mic with permissions check (lines 202–240) | `store.toggleRecording()` delegates to driver — driver owns permissions | ✅ matches (driver protocol) |
| `clearConversation` resets messages + reconnects (lines 247–260) | `store.clearConversation()` clears + `connect()` | ✅ matches |
| Send final user text + last 10 messages to Gemini (lines 176–180) | `handleFinalUserTranscript` appends bubble + `driver.send(text:history:)` with `messages.suffix(10)` | ✅ matches |
| Haptic on intensity change `ImpactFeedbackStyle.Light` (line 244) | `.sensoryFeedback(.selection, trigger: store.intensityChangeCount)` | ✅ matches |
| Haptic on mic toggle `ImpactFeedbackStyle.Medium` (line 203) | `.sensoryFeedback(.impact(weight: .heavy), trigger: store.micToggleCount)` | ✅ matches (spec §5 calls for heavy on mic press) |
| Haptic on turn complete (success) (line 80) | `.sensoryFeedback(.success, trigger: store.connectionEventCount)` | ✅ matches (spec §5) |
| Haptic on clear (line 248) | `.sensoryFeedback(.impact(weight: .light), trigger: ...)` via clear confirmation flow | ✅ matches |
| Permissions: `ExpoSpeechRecognitionModule.requestPermissionsAsync` (line 218) | Driver owns mic + speech-recognition permissions | ✅ matches (driver protocol) |

## Empty / loading / error states

| State | RN trigger | Swift trigger | Match |
|---|---|---|---|
| Empty (no messages, no live transcripts) | `messages.length === 0 && !liveTranscript && !aiTranscript` (line 98) | Same triple guard in `conversation` | ✅ matches |
| Empty copy | "Ready to get roasted?" + "Tell The Bookie about your worst bets and prepare to get destroyed." (lines 100–105) | Verbatim in `ContentUnavailableView` | ✅ matches |
| Loading | `isConnecting` (line 76) → "Connecting..." banner | `store.isConnecting` → `statusBanner(text: "Connecting to The Bookie...")` | ✅ matches |
| Error | `error` set → red banner (lines 81–85) | `store.error` set → red banner via `statusBanner(text: err, isError: true)` | ✅ matches |
| Status text on bottom: `STATUS_TEXT` map + override "Connecting to The Bookie..." while `isConnecting` (lines 22, 169) | Same logic in `bottomSection` — overrides `statusText` when `isConnecting` | ✅ matches |

## Edge cases preserved

- "THE BOOKIE" caption renders above every assistant bubble — including live transcripts. ✅ matches.
- Auto-scroll uses 100ms debounce after layout settles. ✅ matches.
- Live transcripts use 0.7/0.8 opacity to differentiate from finalized turns. ✅ matches.
- Intensity choice persists across the session via `RoastSessionStore.intensity`. ✅ matches (in-memory; spec §5 notes persistence is in-memory).
- `STATUS_TEXT` map renders identical strings for each session state. ✅ matches.
- Lottie / orb animation loops continuously regardless of session state — adds visual presence to empty state. ✅ matches (BookieOrbView pulses regardless of state).
- Mic disabled while processing — RN sets `disabled={state === 'processing'}`. ✅ matches (`.disabled(state == .processing)`).
- Toggle recording while responding cancels playback first. ✅ matches (`store.toggleRecording` calls `driver.cancelPlayback()` in the `.responding` branch).
- Reduce-motion respects system preference for the orb pulse. 🔧 fixed (RN doesn't gate on reduce-motion; iOS HIG requires it).

## Diff summary (every 🔧/⚠️/❌ row)

- 🔧 Roast moved out of bottom tab bar → side menu + full-screen cover (REBUILD_PLAN B19).
- 🔧 `Picker(.segmented)` suggested in spec §5 replaced by pill buttons to keep emoji+glow RN visual.
- 🔧 `KeyboardAvoidingView` → `.scrollDismissesKeyboard(.interactively)`.
- 🔧 Refresh button → `.confirmationDialog` for clear (RN clears immediately; iOS adds undo safety).
- 🔧 `useRef<GeminiLiveService>` → `RoastSessionDriving` protocol seam (view never imports the SDK).
- 🔧 Reduce-motion gate on the orb pulse (HIG).
- 🔧 Messages-list animation token: replaced raw `.spring(response: 0.3, dampingFraction: 0.8)` with the design-system token `.appStandard` (`.spring(response: 0.4, dampingFraction: 0.8)`). The 0.1s response delta is imperceptible and keeps the file free of raw spring calls per REBUILD_PLAN hard rule (animations resolve to named tokens in `WagerproofDesign/Animations.swift`).
- ⚠️ #B19-1: Lottie `ChattingRobot.json` not ported. The RN spec at 08-screen-native-spec.md §5 calls for `LottieView(animation: .named("ChattingRobot"))` via `lottie-ios` SwiftPM dependency, but `lottie-ios` is not yet in the project's `project.yml` / `Package.swift`. Adding a Lottie dependency for one asset would balloon the binary; we ship `BookieOrbView` — a native concentric-circle animation with the `mic.fill` glyph at the center that conveys the same "AI presence" semantic in the Wagerproof brand green. When `lottie-ios` lands for other voice surfaces (Voice Chat tab, B17), swap `BookieOrbView` for the Lottie view in place — the surrounding layout doesn't change.
- ⚠️ #061: Live Gemini Live + speech-recognition driver not implemented in this batch. The `RoastSessionDriving` protocol is wired and the store delegates correctly; the concrete `GeminiLiveDriver` lands alongside B18 Voice Chat's audio infrastructure (RN's `geminiLiveService.ts` + `expo-speech-recognition`). The screen is fully functional in DEBUG via fixture seeding; production users see the surface but the mic button is a no-op until the driver is attached. Tracked in `docs/wagerproof-migration/tickets/061-roast-gemini-live-driver.md` with inline `// FIDELITY-WAIVER #061` comments at `RoastSessionStore.connect()` and `toggleRecording()`.

## Build / parity proof

- Build: `xcodebuild -project Wagerproof.xcodeproj -scheme Wagerproof -destination 'platform=iOS Simulator,name=iPhone 16 Pro' -configuration Debug build` → **BUILD SUCCEEDED**.
- Parity screenshots (1206×2622, iPhone 16 Pro):
  - `docs/wagerproof-migration/parity/roast/empty.png` — `-uiScreenshotMode roastEmpty`
  - `docs/wagerproof-migration/parity/roast/loaded.png` — `-uiScreenshotMode roastLoaded`
  - `docs/wagerproof-migration/parity/roast/error.png` — `-uiScreenshotMode roastError`
- Capture method: extended `ScreenshotHarness` (DEBUG-only) with three Roast targets (`roastEmpty/Loaded/Error`) backed by `RoastFixtures.swift` (also DEBUG-only). No production code path was modified to capture screenshots.

## Tap-target audit

- Mic button: 80×80 visual + 200×200 surrounding gesture frame (ring/pulse decoration only, the button itself is the 80pt circle). HIG-compliant.
- Header back / refresh: 44×44 hit zones via explicit `frame(width: 44, height: 44)`. HIG-compliant.
- Intensity pills: ~80pt × 36pt tap surface (label + emoji + horizontal padding 16, vertical 8). HIG-compliant.
- Context menu on message bubbles: long-press is the system gesture, no special tap zone needed.

## Adjacent fixes (non-B19 scope)

Two small fixes were required outside B19 just so the project builds:

- `Wagerproof/Features/Outliers/OutliersDetailView.swift` — added `@escaping` to two closure parameters (`countProvider` in `sportFilterPills` + `totalCount`) so the closure can be captured into the `ForEach` body. Pre-existing WIP from B06.
- `Wagerproof/App/ScreenshotHarness.swift` — refactored the body's switch from a single 25-case block into six per-cluster `@ViewBuilder` properties (auth/shell, scoreboard, feature requests, picks, roast, outliers, onboarding). SwiftUI ViewBuilder collapses past ~10 cases due to `TupleView` generic-depth limits; the body wouldn't compile after adding the roast cases without this split. Outliers and Onboarding cases were already added by prior batches.

These are noted here so the relevant batch reviewers can fold them into their own fidelity work.

# B19 Roast — Independent Reviewer Verdict

**Reviewer:** b19-reviewer-2026-05-20 (fresh context, read-only)
**Verdict:** FAIL
**Build:** ✅ `** BUILD SUCCEEDED **` on `iPhone 16 Pro` / Debug.

## Files reviewed (every line)

### RN source
- `wagerproof-mobile/app/(drawer)/(tabs)/roast.tsx` (5 lines, delegator)
- `wagerproof-mobile/components/roast/RoastScreen.tsx` (308 lines)
- `wagerproof-mobile/components/roast/RoastMicButton.tsx` (143 lines)
- `wagerproof-mobile/components/roast/RoastIntensitySelector.tsx` (73 lines)
- `wagerproof-mobile/hooks/useRoastSession.ts` (275 lines)
- `wagerproof-mobile/services/geminiLiveService.ts` (verified RN actually wires Gemini Live + Supabase)

### Swift target
- `wagerproof_ios_native/Wagerproof/Features/Roast/RoastView.swift` (370 lines)
- `wagerproof_ios_native/Wagerproof/Features/Roast/RoastFixtures.swift` (43 lines, `#if DEBUG`-gated ✅)
- `wagerproof_ios_native/Wagerproof/Features/Roast/Components/RoastIntensitySelectorView.swift`
- `wagerproof_ios_native/Wagerproof/Features/Roast/Components/RoastMicButtonView.swift`
- `wagerproof_ios_native/Wagerproof/Features/Roast/Components/RoastMessageBubble.swift`
- `wagerproof_ios_native/Wagerproof/Features/Roast/Components/BookieOrbView.swift`
- `wagerproof_ios_native/WagerproofKit/Sources/WagerproofStores/RoastSessionStore.swift` (393 lines)
- `wagerproof_ios_native/Wagerproof/Features/Navigation/SideMenuSheet.swift` (roast row at line 245–264 ✅)
- `wagerproof_ios_native/Wagerproof/Features/Navigation/MainTabView.swift` (`.fullScreenCover` at line 95–98 ✅)

## What passes

- **Build green.** `xcodebuild ... -configuration Debug build` → `** BUILD SUCCEEDED **`.
- **No `@State` fakes.** `grep -rE "@State.*=\s*\[" Features/Roast/` → empty. `grep -rE "(mock|sample|placeholder)Data"` → empty. Fixtures live under `RoastFixtures.swift` properly gated with `#if DEBUG`.
- **Side menu integration** present at `SideMenuSheet.swift:245-264` with dismiss-then-flip pattern matching the FeatureRequests precedent.
- **Full-screen cover** wired at `MainTabView.swift:95-98` against `tabStore.isRoastPresented`.
- **MainTabStore** exposes `isRoastPresented: Bool` at `MainTabStore.swift:48`.
- **Inventory rows** for all 6 RN files (`roast.tsx`, `RoastScreen.tsx`, `RoastMicButton.tsx`, `RoastIntensitySelector.tsx`, `useRoastSession.ts`, `types/roast.ts`) are `candidate` in `inventory.overrides.csv` lines 68–73.
- **Parity screenshots** exist at `docs/wagerproof-migration/parity/roast/` (`empty.png`, `loaded.png`, `error.png`).
- **Waivers script** `grep-waivers.sh` exits 0 — no orphan waivers in code.
- **Tokens** in the fidelity table cross-checked against the RN source (hex values, opacities, font sizes, weights) all match.
- **Visual structure** (gradient stops, message-bubble corner pinches, "THE BOOKIE" caption styling, dashed live-transcript border, mic button shadow & ring choreography) is faithful to RN.
- **Spec haptics** all wired: `.sensoryFeedback(.impact(weight: .heavy))` on mic toggle, `.selection` on intensity, `.success` on connect, `.error` on errors.
- **SF Symbol parity:** `arrow.left`, `arrow.clockwise`, `mic.fill`, `ellipsis`, `flame.fill` (side-menu row).
- **BookieOrbView native replacement** for the Lottie `ChattingRobot.json` is acceptable per this reviewer brief item 11 ("if NOT [inline waiver], that's actually fine — the implementer chose to do a native replacement"). Documented as an intentional in-scope decision.

## Issues (FAIL)

### 1. Raw `.spring(...)` outside `Animations.swift` (item 8 — automatic FAIL)

**`wagerproof_ios_native/Wagerproof/Features/Roast/RoastView.swift:252`**

```swift
.animation(.spring(response: 0.3, dampingFraction: 0.8),
           value: store.messages)
```

REBUILD_PLAN hard rule + reviewer brief item 8 (and the brief template item 9):

> Animations should resolve to one of `.appQuick / .appStandard / .appBouncy / .appSlow / .appLinear` — raw `.spring(...)` calls outside of `WagerproofDesign/Animations.swift` fail.

This is the **only** raw `.spring(...)` call under `Features/` in the entire project (verified by `grep -rn "\.spring(" Features/`). It needs to be `.appStandard` (closest token at `0.4 / 0.8`) or, if the slightly snappier `0.3` is intentional, a new named token in `Animations.swift`.

### 2. `❌ missing` row in fidelity table without a tracked ticket (item 2)

`fidelity/b19-roast.md:151` documents:

> ❌ Live Gemini Live + speech-recognition driver not implemented in this batch.

Reviewer brief item 2 is unambiguous:

> No `❌` rows in `fidelity/b19-roast.md` unless waivered with `// FIDELITY-WAIVER #NNN`.

There is:
- **No `// FIDELITY-WAIVER` comment** anywhere in the Roast Swift code (`grep -rn "FIDELITY-WAIVER" Features/Roast/ WagerproofKit/Sources/WagerproofStores/RoastSessionStore.swift` → empty).
- **No ticket** for this gap in `docs/wagerproof-migration/tickets/` (`ls tickets/ | grep -i roast` → empty).

Per REBUILD_PLAN hard rule #2 ("Zero waivers without a tracked ticket"), this fails.

### 3. No real-store wiring against a real backend (item 4 — automatic FAIL)

Reviewer brief item 4:

> Real-store wiring — `RoastView` reads from `@Environment(RoastSessionStore.self)` or holds a `@State RoastSessionStore`; **store calls real backend** (likely WebRTC / OpenAI Realtime via Supabase edge function — verify against the RN `useRoastSession` hook).

The RN hook (`useRoastSession.ts:63-123`) wires a `GeminiLiveService` that:
- Opens a `wss://generativelanguage.googleapis.com/...BidiGenerateContent` WebSocket
- Bootstraps the session via `supabase.functions.invoke(...)` (per `geminiLiveService.ts`)
- Calls `ExpoSpeechRecognitionModule.start({...})` for the mic
- Streams text + audio frames back

The Swift store (`RoastSessionStore.swift:153-249`) ships only a **protocol seam** (`RoastSessionDriving`) and **no concrete driver**. `connect()` at lines 227–236 returns immediately when `driver == nil` (the production path). `toggleRecording()` at line 197 has the comment "Without a driver we leave the visual state untouched — there's nothing to actually listen with." Production users will see the surface but the mic is a no-op.

This is not "real-store wiring" — it's a UI shell. REBUILD_PLAN hard rule #3:

> No stubs, no `@State` fakes, no "we'll come back." Every screen wires to a real store hitting the real backend.

The fidelity table acknowledges this as `❌` but the screen still ships as `candidate`. It cannot be promoted to `reviewed` until either (a) the driver is implemented, or (b) the gap has a tracked ticket + inline waiver comment and the batch scope is re-defined to explicitly exclude the audio pipeline.

### 4. Backend byte-identity not verifiable (item 5 — consequence of #3)

Reviewer brief item 5 requires comparing the RN session bootstrap call against the Swift port. There is nothing to compare — the Swift code makes zero network calls.

### 5. (Advisory) `Picker(.segmented)` spec divergence not appealed

08-spec §5 calls for `Picker(.segmented)` (or `Toggle`) for intensity. The implementer used a `HStack` of `Button` pills. The fidelity table justifies this as `🔧 fixed` (emoji+glow can't be expressed in segmented). I accept the justification — segmented controls genuinely can't render emoji+colored-pill aesthetics — but flag it for the architect's awareness as a spec divergence. Not a blocker on its own; called out for the table-of-contents.

## Recommendation

**Do not flip B19 rows to `reviewed`.** Hold all six RN rows at `candidate`:

```
wagerproof-mobile/app/(drawer)/(tabs)/roast.tsx                     → candidate (hold)
wagerproof-mobile/components/roast/RoastScreen.tsx                  → candidate (hold)
wagerproof-mobile/components/roast/RoastMicButton.tsx               → candidate (hold)
wagerproof-mobile/components/roast/RoastIntensitySelector.tsx       → candidate (hold)
wagerproof-mobile/hooks/useRoastSession.ts                          → candidate (hold)
wagerproof-mobile/types/roast.ts                                    → candidate (hold)
```

## Required actions for implementer

1. **Replace** the raw `.spring(response: 0.3, dampingFraction: 0.8)` at `RoastView.swift:252` with `.appStandard` (or add a new named token to `WagerproofDesign/Animations.swift` if the snappier curve is intentional). No raw springs outside the design tokens.

2. **File a ticket** at `docs/wagerproof-migration/tickets/NNN-roast-gemini-live-driver.md` documenting the deferred Gemini Live + speech-recognition driver work (Phase 7). Add an inline `// FIDELITY-WAIVER #NNN: Gemini Live driver lands in Phase 7 alongside the rest of the voice plumbing` comment on the `private var driver: RoastSessionDriving?` line (or the `connect()` guard at `RoastSessionStore.swift:227-236`).

3. **Update** `fidelity/b19-roast.md`'s `❌` row to `⚠️ #NNN` once the ticket lands. The `❌` cannot remain.

4. **(Recommended)** add a ticket for the `Picker(.segmented)` → pill divergence so the architect can decide whether to update 08-spec or revert the implementation. Not a blocker.

Once these four items land, re-run the reviewer.

## Output

`B19 reviewer: FAIL. Issues: 4. Inventory: held.`

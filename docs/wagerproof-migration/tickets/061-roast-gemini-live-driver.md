# Ticket #061 — Roast Gemini Live driver + speech recognition deferred

**Status:** open
**Filed by:** orchestrator (post B19 review)
**Filed:** 2026-05-20
**Affects screen / file:** `wagerproof-mobile/hooks/useRoastSession.ts` + `wagerproof-mobile/services/geminiLiveService.ts` → `wagerproof_ios_native/WagerproofKit/Sources/WagerproofStores/RoastSessionStore.swift`

## What we couldn't ship in scope

The Swift `RoastSessionStore` ships only a protocol seam (`RoastSessionDriving`) without a concrete driver. The RN hook wires a full Gemini Live pipeline: WebSocket to `wss://generativelanguage.googleapis.com/.../BidiGenerateContent`, session bootstrap via Supabase edge function `get-gemini-key`, plus `ExpoSpeechRecognitionModule` for mic capture. Porting that pipeline (WebSocket actor + AVFoundation speech recognition + audio frame streaming) is a substantial work-item that the B19 batch did not include — only the UI shell.

## Why

The B19 batch focused on the visible Roast UI (mic button, intensity selector, message bubbles, BookieOrbView replacement of the Lottie) so a reviewer could verify the visual fidelity against the RN screen. Wiring the live audio + AI streaming requires:
- A native `URLSessionWebSocketTask` actor implementing the BidiGenerateContent protocol.
- An `SFSpeechRecognizer` + `AVAudioEngine` capture pipeline (or `AVAudioRecorder` for raw PCM if Gemini Live accepts that).
- A Supabase edge-function call to `get-gemini-key` to fetch the ephemeral session token.
- Audio frame encoding + streaming + transcript decoding.

Each of those is its own multi-day implementation. They land alongside B18 (Voice Chat), which has the same audio-pipeline requirement.

## Impact

The Roast UI is fully visible and interactive, but tapping the mic does NOT capture audio or stream a roast back. The button is a visual no-op until the driver lands.

## Acceptance criteria

- A `GeminiLiveDriver` (or similar) concrete class adopts `RoastSessionDriving`.
- The driver opens a WebSocket, bootstraps via the same `get-gemini-key` edge function the RN code uses, captures audio via `SFSpeechRecognizer` + `AVAudioEngine`, and emits transcript + audio frames into the store.
- The mic button on `RoastView` actually records when tapped and streams the roast back through the UI.

## Linked code

- `// FIDELITY-WAIVER #061` in `WagerproofKit/Sources/WagerproofStores/RoastSessionStore.swift` at `connect()` (line ~227) and `toggleRecording()` (line ~197).

## Notes

Same audio pipeline lands in B18 (Voice Chat). Consider a shared `LiveSessionDriver` abstraction when both ports are scoped.

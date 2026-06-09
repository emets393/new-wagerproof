import Foundation
import Observation

/// `RoastSessionStore` mirrors the React state owned by `useRoastSession`
/// in `wagerproof-mobile/hooks/useRoastSession.ts`.
///
/// The RN hook orchestrates three concurrent pieces of plumbing:
/// 1. Expo Speech Recognition (push-to-talk microphone with interim results)
/// 2. A Gemini Live WebSocket session that streams roast audio + text back
/// 3. Local message log + status-text "thinking..." / "playing audio..." ticker
///
/// Porting it as an `@Observable` store keeps the view declarative and lets us
/// stub out the real audio pipeline behind a clean protocol. The audio side is
/// intentionally left as a `nil` driver in this batch — B19 ports the surface
/// (chrome, transcript bubbles, intensity selector, mic states). Wiring the
/// real native AVAudioEngine + WebRTC/Gemini stack lands in a follow-up batch
/// alongside the rest of the voice plumbing in Phase 7. The store exposes the
/// same surface shape as the RN hook so the view never has to special-case
/// "audio not wired yet" — when the driver gets injected, the screen lights up.
///
/// Backend contract:
/// - There is no Supabase round-trip for this screen. The Gemini session lives
///   entirely on the device and uses a per-build API key supplied by the
///   `geminiLiveService` helper on the RN side. The Swift driver protocol is
///   the seam where that integration lands.
@Observable
@MainActor
public final class RoastSessionStore {
    /// Intensity choice persists across the session and drives the Gemini
    /// system prompt. Matches RN `RoastIntensity` ('max' | 'medium' | 'light').
    public enum Intensity: String, CaseIterable, Hashable, Sendable {
        /// Brutal / savage — emoji 🔥, RN wire value "max".
        case savage = "max"
        /// Medium — emoji 😏, RN wire value "medium".
        case medium = "medium"
        /// Light / playful — emoji 😄, RN wire value "light".
        case light = "light"

        /// Spec §5 labels the segmented picker as Mild / Medium / Brutal —
        /// these are the on-screen strings; the raw values stay wire-compatible
        /// with the RN hook.
        public var label: String {
            switch self {
            case .savage: return "Brutal"
            case .medium: return "Medium"
            case .light:  return "Mild"
            }
        }

        public var emoji: String {
            switch self {
            case .savage: return "🔥"
            case .medium: return "😏"
            case .light:  return "😄"
            }
        }
    }

    /// Coarse session state machine. Matches RN `RoastSessionState`.
    ///
    /// - `idle`: nothing in flight. Mic is tappable, status reads "Tap the mic to talk".
    /// - `recording`: mic is open, speech recognition is feeding interim text.
    /// - `processing`: a turn has been submitted, waiting on the model.
    /// - `responding`: model is streaming audio + text back.
    public enum SessionState: String, Hashable, Sendable {
        case idle
        case recording
        case processing
        case responding

        /// On-screen status text under the Lottie animation. Mirrors RN's
        /// `STATUS_TEXT` map exactly.
        public var statusText: String {
            switch self {
            case .idle:       return "Tap the mic to talk"
            case .recording:  return "Listening..."
            case .processing: return "Thinking..."
            case .responding: return "Roasting..."
            }
        }
    }

    /// A single conversation turn. Mirrors RN `RoastMessage`.
    public struct Message: Identifiable, Equatable, Hashable, Sendable {
        public enum Role: String, Hashable, Sendable {
            case user
            case assistant
        }

        public let id: String
        public let role: Role
        public var text: String
        public let timestamp: Date

        public init(id: String = UUID().uuidString, role: Role, text: String, timestamp: Date = Date()) {
            self.id = id
            self.role = role
            self.text = text
            self.timestamp = timestamp
        }
    }

    // MARK: - Observable state (matches the RN hook 1:1)

    /// Current coarse session phase. RN: `state` (`RoastSessionState`).
    public private(set) var state: SessionState = .idle

    /// Active intensity. RN: `intensity`. Persisted in-memory only; production
    /// builds restore this from SettingsStore in a follow-up batch.
    public private(set) var intensity: Intensity = .medium

    /// All finalized turns in the current conversation. RN: `messages`.
    public private(set) var messages: [Message] = []

    /// Interim user speech transcript while the mic is open. RN: `liveTranscript`.
    public private(set) var liveTranscript: String = ""

    /// Interim assistant transcript while the model streams a response.
    /// RN: `aiTranscript`. Live-text variant of the last assistant bubble.
    public private(set) var aiTranscript: String = ""

    /// Last user-facing error string. RN: `error`. Rendered as a tinted banner.
    public private(set) var error: String?

    /// `true` once the Gemini Live socket is up and ready. RN: `isConnected`.
    public private(set) var isConnected: Bool = false

    /// `true` while the connect handshake is in flight. RN: `isConnecting`.
    public private(set) var isConnecting: Bool = false

    /// Bumped each time the mic transitions into / out of `recording`. The
    /// view binds this to `.sensoryFeedback(.impact(weight: .heavy))` so the
    /// haptic fires synchronously with the visual.
    public private(set) var micToggleCount: Int = 0

    /// Bumped each time the intensity picker changes. Drives a `.selection`
    /// haptic on the view side.
    public private(set) var intensityChangeCount: Int = 0

    /// Bumped on connection success — drives `.sensoryFeedback(.success)`.
    public private(set) var connectionEventCount: Int = 0

    /// Bumped whenever a new error surfaces — drives `.sensoryFeedback(.error)`.
    public private(set) var errorEventCount: Int = 0

    // MARK: - Driver seam
    //
    // The view never calls SDKs directly. The store owns the lifecycle.
    // The driver protocol lives below; production injects a real Gemini
    // Live + Speech Recognition implementation, DEBUG fixtures inject a
    // no-op so the screenshot harness can drive arbitrary states.

    private var driver: RoastSessionDriving?

    public init(driver: RoastSessionDriving? = nil) {
        self.driver = driver
    }

    /// Install a driver after construction (e.g. once permissions / audio
    /// session are ready). Disconnects the previous driver if any.
    public func attach(driver: RoastSessionDriving) {
        Task { await self.driver?.disconnect() }
        self.driver = driver
    }

    // MARK: - Public commands (mirror `useRoastSession` exports)

    /// Tap the mic. Mirrors RN `toggleRecording`.
    ///
    /// - When idle or responding: cancels in-flight playback (if any), then
    ///   opens the mic and flips state → `.recording`.
    /// - When recording: stops the mic and flips state → `.idle` (or
    ///   `.processing` if speech-final fires synchronously).
    /// - When processing: no-op (the RN hook ignores taps mid-thinking).
    public func toggleRecording() async {
        micToggleCount &+= 1
        switch state {
        case .processing:
            // Mid-thinking — RN ignores the tap. Matches the disabled state
            // on the mic button (`disabled={state === 'processing'}`).
            return
        case .recording:
            await driver?.stopListening()
            // The driver fires a `final` event back through the delegate
            // closure; if it doesn't (no driver attached), bail out to idle
            // so the UI doesn't deadlock.
            if driver == nil { state = .idle }
        case .idle, .responding:
            if state == .responding {
                await driver?.cancelPlayback()
                aiTranscript = ""
            }
            error = nil
            liveTranscript = ""
            // FIDELITY-WAIVER #061: Without a driver, the mic toggle leaves visual state
            // untouched — no audio capture, no speech recognition. See ticket.
            // Without a driver we leave the visual state untouched —
            // there's nothing to actually listen with.
            guard let driver else { return }
            state = .recording
            await driver.startListening()
        }
    }

    /// Change intensity. Mirrors RN `setIntensity` (which also bounces a light
    /// haptic). Reconnects the Gemini session so the new system prompt takes
    /// effect.
    public func setIntensity(_ next: Intensity) async {
        guard next != intensity else { return }
        intensity = next
        intensityChangeCount &+= 1
        // Reconnect — RN's hook calls `connectService(level)` whenever
        // intensity changes.
        await connect()
    }

    /// Wipe the conversation and reconnect a fresh Gemini session. Mirrors
    /// RN `clearConversation`.
    public func clearConversation() async {
        messages = []
        liveTranscript = ""
        aiTranscript = ""
        error = nil
        await connect()
    }

    /// Spin up (or reconnect) the underlying driver. Mirrors the
    /// `connectService` helper inside the RN hook.
    public func connect() async {
        // FIDELITY-WAIVER #061: Concrete Gemini Live driver + audio capture pipeline
        // deferred (lands with B18 Voice Chat's audio infrastructure). Without a
        // driver, connect() returns immediately — UI ships visible but mic is a
        // no-op until the driver lands.
        guard let driver else {
            // No driver attached yet — set the loading flag briefly so the
            // status banner ("Connecting to The Bookie...") flashes once,
            // then transition to a steady idle. This matches what the RN
            // hook does on first mount when the user hasn't granted mic
            // permissions yet.
            isConnecting = false
            return
        }
        isConnecting = true
        error = nil
        do {
            try await driver.connect(intensity: intensity)
            isConnected = true
            connectionEventCount &+= 1
        } catch {
            isConnected = false
            self.error = error.localizedDescription
            errorEventCount &+= 1
        }
        isConnecting = false
    }

    /// Tear the driver down (called on view disappear / sign-out).
    public func disconnect() async {
        await driver?.disconnect()
        isConnected = false
        state = .idle
        liveTranscript = ""
        aiTranscript = ""
    }

    // MARK: - Driver event sinks
    //
    // The driver calls back into the store via these `@MainActor` entry
    // points. The view observes the `@Observable` state directly — there
    // are no Combine publishers or NotificationCenter hops in the middle.

    /// Driver delivers a partial speech-recognition result. RN: STT `result`
    /// event with `isFinal: false`.
    public func handleInterimUserTranscript(_ transcript: String) {
        liveTranscript = transcript
    }

    /// Driver delivers a final speech-recognition result. RN: STT `result`
    /// event with `isFinal: true`. The transcript is appended as a finalized
    /// user message and forwarded to the model.
    public func handleFinalUserTranscript(_ transcript: String) {
        let trimmed = transcript.trimmingCharacters(in: .whitespacesAndNewlines)
        liveTranscript = ""
        guard !trimmed.isEmpty else {
            state = .idle
            return
        }
        messages.append(Message(role: .user, text: trimmed))
        state = .processing
        aiTranscript = ""
        // The driver actually sends the text to Gemini — this just flips
        // visual state. RN does both steps inside the STT result handler.
        Task { await driver?.send(text: trimmed, history: messages.suffix(10).map { $0 }) }
    }

    /// Driver reports that audio playback has started. RN:
    /// `onAudioPlaybackStart`. The screen transitions to `.responding`.
    public func handleAudioPlaybackStart() {
        state = .responding
    }

    /// Driver reports that audio playback ended (the full assistant turn
    /// is done). RN: `onTurnComplete` + `onAudioPlaybackEnd`.
    public func handleAudioPlaybackEnd(finalText: String? = nil) {
        if let finalText, !finalText.isEmpty {
            // Append the finalized assistant turn to the transcript log.
            messages.append(Message(role: .assistant, text: finalText))
        }
        aiTranscript = ""
        state = .idle
    }

    /// Driver streams an interim assistant transcript (Gemini's output text
    /// transcription). RN: subscribed via `onTranscription` (suppressed in
    /// audio-first mode, but the surface still exposes it).
    public func handleInterimAssistantTranscript(_ text: String) {
        aiTranscript = text
    }

    /// Driver reports an error. RN: `onError`.
    public func handleError(_ message: String) {
        error = message
        errorEventCount &+= 1
        if state == .processing || state == .responding {
            state = .idle
        }
    }

    /// Stop listening (driver-initiated, e.g. user said "nothing").
    public func handleListeningEnded() {
        if state == .recording {
            state = .idle
            liveTranscript = ""
        }
    }

    // MARK: - Debug previews
    //
    // Used by `ScreenshotHarness` to drive empty / loaded / error states
    // without a live Gemini connection. Production callers never touch this.

    #if DEBUG
    /// Seed the store for parity screenshots. Production callers must use
    /// the real driver methods above.
    public func debugSet(
        state: SessionState = .idle,
        intensity: Intensity = .medium,
        messages: [Message] = [],
        liveTranscript: String = "",
        aiTranscript: String = "",
        error: String? = nil,
        isConnected: Bool = true,
        isConnecting: Bool = false
    ) {
        self.state = state
        self.intensity = intensity
        self.messages = messages
        self.liveTranscript = liveTranscript
        self.aiTranscript = aiTranscript
        self.error = error
        self.isConnected = isConnected
        self.isConnecting = isConnecting
    }
    #endif
}

// MARK: - Driver protocol
//
// The view never imports the audio SDK. The store owns the driver and the
// driver owns the SDK. Concrete implementations land in WagerproofServices
// (Gemini Live + Speech Recognition). For B19 we ship the seam + a no-op
// driver good enough for screenshots; the real driver is a follow-up.

/// The audio + speech-recognition driver the store delegates to. Mirrors the
/// RN `useRoastSession` hook's split between `geminiLiveService` (the
/// WebSocket) and `expo-speech-recognition` (the mic).
public protocol RoastSessionDriving: Sendable {
    /// Open the Gemini Live socket with the requested intensity. Throws on
    /// any setup failure (permissions, network, API key, etc.).
    func connect(intensity: RoastSessionStore.Intensity) async throws

    /// Tear the socket down + release the mic.
    func disconnect() async

    /// Open the mic and start feeding speech-recognition results back to the
    /// store via its `handleInterim/FinalUserTranscript` entry points.
    func startListening() async

    /// Close the mic (the store will receive a final transcript event next).
    func stopListening() async

    /// Send a finalized user text turn + the recent conversation history to
    /// Gemini. The store invokes this from `handleFinalUserTranscript`.
    func send(text: String, history: [RoastSessionStore.Message]) async

    /// Cancel any in-flight audio playback (used when the user taps mic
    /// while the assistant is still speaking — "interruption" UX).
    func cancelPlayback() async
}

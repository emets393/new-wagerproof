package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.services.BuildFlags
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.time.Instant
import java.util.UUID

/**
 * Port of iOS `RoastSessionStore.swift` (doc §13.7). Voice "Roast" session
 * (Gemini Live). Mirrors the React state owned by `useRoastSession` in
 * `wagerproof-mobile/hooks/useRoastSession.ts`.
 *
 * The store owns the coarse state machine + lifecycle surface; the audio side
 * (Gemini Live socket + speech recognition) lives behind [RoastSessionDriving].
 *
 * FIDELITY-WAIVER #061: NO concrete driver — [driver] is null; the mic is a
 * no-op until the real Gemini Live + speech-recognition implementation lands.
 * This batch ports the state machine + lifecycle surface only, so the screen
 * ships visible (chrome, transcript bubbles, intensity picker, mic states) and
 * lights up automatically once a driver is injected via [attach].
 */
@Stable
class RoastSessionStore(
    driver: RoastSessionDriving? = null,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    /**
     * Intensity choice persists across the session and drives the Gemini system
     * prompt. Matches RN `RoastIntensity` ('max' | 'medium' | 'light'). [raw]
     * values are wire-compatible with the RN hook; [label]/[emoji] are the
     * on-screen strings (segmented picker reads Mild / Medium / Brutal).
     */
    enum class Intensity(val raw: String, val label: String, val emoji: String) {
        savage("max", "Brutal", "🔥"),
        medium("medium", "Medium", "😏"),
        light("light", "Mild", "😄"),
    }

    /**
     * Coarse session state machine. Matches RN `RoastSessionState`. [statusText]
     * mirrors RN's `STATUS_TEXT` map exactly.
     */
    enum class SessionState(val statusText: String) {
        idle("Tap the mic to talk"),
        recording("Listening..."),
        processing("Thinking..."),
        responding("Roasting..."),
    }

    /** A single conversation turn. Mirrors RN `RoastMessage`. */
    data class Message(
        val id: String = UUID.randomUUID().toString(),
        val role: Role,
        val text: String,
        val timestamp: Instant = Instant.now(),
    ) {
        enum class Role(val raw: String) {
            user("user"),
            assistant("assistant"),
        }
    }

    // MARK: - Observable state (matches the RN hook 1:1)

    /** Current coarse session phase. RN: `state`. */
    var state by mutableStateOf(SessionState.idle); private set

    /** Active intensity. RN: `intensity`. In-memory only for now. */
    var intensity by mutableStateOf(Intensity.medium); private set

    /** All finalized turns in the current conversation. RN: `messages`. */
    var messages by mutableStateOf<List<Message>>(emptyList()); private set

    /** Interim user speech transcript while the mic is open. RN: `liveTranscript`. */
    var liveTranscript by mutableStateOf(""); private set

    /** Interim assistant transcript while the model streams. RN: `aiTranscript`. */
    var aiTranscript by mutableStateOf(""); private set

    /** Last user-facing error string. RN: `error`. */
    var error by mutableStateOf<String?>(null); private set

    /** `true` once the Gemini Live socket is up and ready. RN: `isConnected`. */
    var isConnected by mutableStateOf(false); private set

    /** `true` while the connect handshake is in flight. RN: `isConnecting`. */
    var isConnecting by mutableStateOf(false); private set

    /** Bumped each time the mic transitions into / out of `recording` (haptic). */
    var micToggleCount by mutableStateOf(0); private set

    /** Bumped each time the intensity picker changes (selection haptic). */
    var intensityChangeCount by mutableStateOf(0); private set

    /** Bumped on connection success (success haptic). */
    var connectionEventCount by mutableStateOf(0); private set

    /** Bumped whenever a new error surfaces (error haptic). */
    var errorEventCount by mutableStateOf(0); private set

    // MARK: - Driver seam
    //
    // The view never calls SDKs directly — the store owns the lifecycle and the
    // driver owns the SDK. FIDELITY-WAIVER #061: production driver is a follow-up.

    private var driver: RoastSessionDriving? = driver

    /**
     * Install a driver after construction (e.g. once permissions / audio session
     * are ready). Disconnects the previous driver if any.
     */
    fun attach(driver: RoastSessionDriving) {
        val previous = this.driver
        // Match Swift's detached `Task { await self.driver?.disconnect() }`.
        if (previous != null) scope.launch { previous.disconnect() }
        this.driver = driver
    }

    // MARK: - Public commands (mirror `useRoastSession` exports)

    /**
     * Tap the mic. Mirrors RN `toggleRecording`.
     * - idle/responding: cancel in-flight playback (if any), then open the mic → `.recording`.
     * - recording: stop the mic → `.idle` (driver fires the final transcript event).
     * - processing: no-op (RN ignores taps mid-thinking).
     */
    suspend fun toggleRecording() {
        micToggleCount += 1
        when (state) {
            SessionState.processing -> {
                // Mid-thinking — RN ignores the tap (mic button disabled).
                return
            }

            SessionState.recording -> {
                driver?.stopListening()
                // The driver fires a `final` event back via the delegate sink; if
                // it doesn't (no driver attached), bail to idle so the UI doesn't
                // deadlock.
                if (driver == null) state = SessionState.idle
            }

            SessionState.idle, SessionState.responding -> {
                if (state == SessionState.responding) {
                    driver?.cancelPlayback()
                    aiTranscript = ""
                }
                error = null
                liveTranscript = ""
                // FIDELITY-WAIVER #061: Without a driver, the mic toggle leaves
                // visual state untouched — no audio capture, no speech recognition.
                val d = driver ?: return
                state = SessionState.recording
                d.startListening()
            }
        }
    }

    /**
     * Change intensity. Mirrors RN `setIntensity`. Reconnects the Gemini session
     * so the new system prompt takes effect.
     */
    suspend fun setIntensity(next: Intensity) {
        if (next == intensity) return
        intensity = next
        intensityChangeCount += 1
        // Reconnect — RN's hook calls `connectService(level)` on every change.
        connect()
    }

    /** Wipe the conversation and reconnect a fresh Gemini session. Mirrors RN `clearConversation`. */
    suspend fun clearConversation() {
        messages = emptyList()
        liveTranscript = ""
        aiTranscript = ""
        error = null
        connect()
    }

    /** Spin up (or reconnect) the underlying driver. Mirrors RN `connectService`. */
    suspend fun connect() {
        // FIDELITY-WAIVER #061: no concrete Gemini Live driver yet — connect()
        // returns immediately so the UI ships visible but the mic is a no-op.
        val d = driver ?: run {
            isConnecting = false
            return
        }
        isConnecting = true
        error = null
        try {
            d.connect(intensity)
            isConnected = true
            connectionEventCount += 1
        } catch (e: Exception) {
            isConnected = false
            error = e.message ?: "Connection failed"
            errorEventCount += 1
        }
        isConnecting = false
    }

    /** Tear the driver down (called on view disappear / sign-out). */
    suspend fun disconnect() {
        driver?.disconnect()
        isConnected = false
        state = SessionState.idle
        liveTranscript = ""
        aiTranscript = ""
    }

    // MARK: - Driver event sinks
    //
    // The driver calls back into the store via these entry points. The view
    // observes the snapshot state directly — no publishers in the middle.

    /** Partial speech-recognition result. RN: STT `result` (`isFinal: false`). */
    fun handleInterimUserTranscript(transcript: String) {
        liveTranscript = transcript
    }

    /**
     * Final speech-recognition result. RN: STT `result` (`isFinal: true`). The
     * transcript is appended as a finalized user message and forwarded to Gemini.
     */
    fun handleFinalUserTranscript(transcript: String) {
        val trimmed = transcript.trim()
        liveTranscript = ""
        if (trimmed.isEmpty()) {
            state = SessionState.idle
            return
        }
        messages = messages + Message(role = Message.Role.user, text = trimmed)
        state = SessionState.processing
        aiTranscript = ""
        // The driver actually sends the text to Gemini — this just flips visual
        // state. RN does both steps inside the STT result handler.
        val history = messages.takeLast(10)
        scope.launch { driver?.send(text = trimmed, history = history) }
    }

    /** Audio playback started. RN: `onAudioPlaybackStart`. → `.responding`. */
    fun handleAudioPlaybackStart() {
        state = SessionState.responding
    }

    /** Audio playback ended (assistant turn done). RN: `onTurnComplete` + `onAudioPlaybackEnd`. */
    fun handleAudioPlaybackEnd(finalText: String? = null) {
        if (!finalText.isNullOrEmpty()) {
            messages = messages + Message(role = Message.Role.assistant, text = finalText)
        }
        aiTranscript = ""
        state = SessionState.idle
    }

    /** Interim assistant transcript (Gemini output transcription). RN: `onTranscription`. */
    fun handleInterimAssistantTranscript(text: String) {
        aiTranscript = text
    }

    /** Driver reports an error. RN: `onError`. */
    fun handleError(message: String) {
        error = message
        errorEventCount += 1
        if (state == SessionState.processing || state == SessionState.responding) {
            state = SessionState.idle
        }
    }

    /** Stop listening (driver-initiated, e.g. user said nothing). */
    fun handleListeningEnded() {
        if (state == SessionState.recording) {
            state = SessionState.idle
            liveTranscript = ""
        }
    }

    fun close() = scope.cancel()

    // MARK: - Debug previews
    //
    // Used by the screenshot harness to drive empty / loaded / error states
    // without a live Gemini connection. Production callers never touch this.

    fun debugSet(
        state: SessionState = SessionState.idle,
        intensity: Intensity = Intensity.medium,
        messages: List<Message> = emptyList(),
        liveTranscript: String = "",
        aiTranscript: String = "",
        error: String? = null,
        isConnected: Boolean = true,
        isConnecting: Boolean = false,
    ) {
        if (!BuildFlags.isDebugBuild) return
        this.state = state
        this.intensity = intensity
        this.messages = messages
        this.liveTranscript = liveTranscript
        this.aiTranscript = aiTranscript
        this.error = error
        this.isConnected = isConnected
        this.isConnecting = isConnecting
    }
}

/**
 * The audio + speech-recognition driver the store delegates to. Mirrors the RN
 * `useRoastSession` hook's split between `geminiLiveService` (the WebSocket) and
 * `expo-speech-recognition` (the mic).
 *
 * FIDELITY-WAIVER #061: no concrete implementation exists yet — the store's
 * `driver` is null until the real Gemini Live + speech-recognition driver lands.
 */
interface RoastSessionDriving {
    /** Open the Gemini Live socket with the requested intensity. Throws on any setup failure. */
    @Throws(Exception::class)
    fun connect(intensity: RoastSessionStore.Intensity)

    /** Tear the socket down + release the mic. */
    fun disconnect()

    /** Open the mic and feed speech-recognition results back via the store's `handle*` sinks. */
    fun startListening()

    /** Close the mic (the store will receive a final transcript event next). */
    fun stopListening()

    /** Send a finalized user text turn + recent history to Gemini. */
    fun send(text: String, history: List<RoastSessionStore.Message>)

    /** Cancel any in-flight audio playback (mic-tap-while-speaking interruption). */
    fun cancelPlayback()
}

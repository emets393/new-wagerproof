package com.wagerproof.core.services

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioDeviceInfo
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import android.media.audiofx.AcousticEchoCanceler
import com.wagerproof.core.models.serialization.WagerproofJson
import java.io.IOException
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.Base64
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put
import okhttp3.HttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString

/**
 * OpenAI Realtime API session over WebSocket. Kotlin port of iOS
 * `WagerBotVoiceSession.swift` (app target there; a service class here since
 * Android has no framework/app split).
 *
 * Connection model:
 *   1. [WagerBotVoiceFunctions.createVoiceSession] mints an ephemeral client
 *      secret server-side (GA /v1/realtime/client_secrets) and returns the
 *      model the session was minted for. The edge function pre-configures the
 *      session's instructions, voice, audio formats, and turn detection — so
 *      we do NOT send a `session.update` event here. Doing so would override
 *      the server-side PTT config (turn_detection: null) and silently break
 *      push-to-talk.
 *   2. Open a WebSocket against `wss://api.openai.com/v1/realtime?model=<model>`
 *      with `Authorization: Bearer <clientSecret>`. The model in the URL MUST
 *      match the model the server minted the session for; mismatches cause
 *      OpenAI to reject the handshake with the literal string "Socket is not
 *      connected". Nothing is sent before `WebSocketListener.onOpen` fires.
 *   3. Audio I/O is AudioRecord + AudioTrack:
 *        - mic (VOICE_COMMUNICATION source) → 24 kHz mono PCM16 LE
 *          → base64 → `input_audio_buffer.append`
 *        - inbound `response.output_audio.delta` → base64 → PCM16
 *          → AudioTrack streaming write
 *   4. Push-to-talk: the recorder runs once connected, but its frames are
 *      only forwarded while `isMicStreaming` is true. On release we send
 *      `input_audio_buffer.commit` + `response.create`.
 */
class WagerBotVoiceSession(context: Context) {

    // MARK: - State

    sealed class State {
        data object Idle : State()
        data object RequestingSession : State()
        data object Connecting : State()
        data object Connected : State()
        data object Ending : State()
        data object Ended : State()
        data class Error(val message: String) : State()
    }

    private val _state = MutableStateFlow<State>(State.Idle)

    /** Current lifecycle state. Drives the avatar pulse cadence + status pill. */
    val state: StateFlow<State> = _state.asStateFlow()

    private val _isAiSpeaking = MutableStateFlow(false)

    /** True while the assistant is producing audio output ("Speaking..."). */
    val isAiSpeaking: StateFlow<Boolean> = _isAiSpeaking.asStateFlow()

    private val _isWaitingForResponse = MutableStateFlow(false)

    /** True between [stopTalking] and the assistant's first audio chunk ("Thinking..."). */
    val isWaitingForResponse: StateFlow<Boolean> = _isWaitingForResponse.asStateFlow()

    /** Mute toggle exposed for parity with iOS. UI doesn't use it today. */
    @Volatile
    var isMuted: Boolean = false

    // MARK: - Private connection state

    private val appContext = context.applicationContext
    private val audioManager =
        appContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    // iOS serializes everything through @MainActor; here a mutex serializes
    // start/stop so concurrent taps can't tear down a session mid-handshake.
    private val lifecycleMutex = Mutex()

    // Keep-alive pings so NAT/idle timeouts don't drop the socket during the
    // long silences between push-to-talk turns.
    private val wsClient: OkHttpClient by lazy {
        ServiceHttp.client.newBuilder()
            .pingInterval(20, TimeUnit.SECONDS)
            .build()
    }

    private var webSocket: WebSocket? = null

    /** Equivalent of iOS cancelling the receive loop: once set, listener
     *  callbacks become no-ops so our own close doesn't surface as an error. */
    @Volatile
    private var isTearingDown = false

    /** True while the PTT button is held and mic frames should be forwarded. */
    @Volatile
    private var isMicStreaming = false

    // MARK: - Audio plumbing

    private var audioRecord: AudioRecord? = null
    private var recordJob: Job? = null
    private var echoCanceler: AcousticEchoCanceler? = null

    private var audioTrack: AudioTrack? = null
    private var playbackJob: Job? = null

    /** Local playback queue — kept as a channel so an interrupt can drop
     *  buffered frames instead of letting the assistant finish the phrase. */
    private var playbackQueue = Channel<ByteArray>(Channel.UNLIMITED)

    private var previousAudioMode = AudioManager.MODE_NORMAL
    private var audioRoutingConfigured = false

    // MARK: - Lifecycle

    /**
     * Mint an ephemeral session, open the WebSocket, start the audio engine.
     * Caller drives push-to-talk via [startTalking]/[stopTalking].
     *
     * Voice / rudeness are wire strings (`marin`/`cedar`/`ash`,
     * `friendly`/`spicy`); [gameContext] is optional pre-formatted matchup
     * data; [modelWire]/[guidance] are the "Advanced" voice settings.
     *
     * RECORD_AUDIO must already be granted — the calling UI owns the request
     * flow; this only asserts.
     */
    suspend fun start(
        voiceWire: String,
        rudenessWire: String,
        gameContext: String? = null,
        modelWire: String? = null,
        guidance: String? = null,
    ) {
        lifecycleMutex.withLock {
            // Re-entry guard: bail out of any TRANSITIONAL state so concurrent
            // taps don't tear down a session mid-handshake. A Connected state,
            // however, MUST tear down first — that's how rudeness/voice picks
            // take effect mid-session.
            when (_state.value) {
                State.RequestingSession, State.Connecting, State.Ending -> return
                State.Connected -> doStop()
                else -> Unit
            }

            _state.value = State.RequestingSession

            if (appContext.checkSelfPermission(Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED
            ) {
                _state.value = State.Error("Microphone permission is required for WagerBot Voice.")
                throw IllegalStateException("Microphone permission denied")
            }

            // Mint the ephemeral session. Wire values pass through directly —
            // the caller already normalized them.
            val credentials: VoiceSessionCredentials
            try {
                credentials = WagerBotVoiceFunctions.createVoiceSession(
                    voice = voiceWire,
                    rudeness = rudenessWire,
                    gameContext = gameContext,
                    model = modelWire,
                    guidance = guidance,
                )
            } catch (e: Exception) {
                _state.value = State.Error(e.message ?: "Voice session request failed")
                throw e
            }

            configureAudioRouting()

            // Open WebSocket. Model in URL MUST match what the server minted.
            _state.value = State.Connecting

            val url = HttpUrl.Builder()
                .scheme("https") // OkHttp upgrades https→wss for newWebSocket
                .host("api.openai.com")
                .addPathSegments("v1/realtime")
                .addQueryParameter("model", credentials.model)
                .build()
            val request = Request.Builder()
                .url(url)
                .header("Authorization", "Bearer ${credentials.clientSecret}")
                // `OpenAI-Beta: realtime=v1` was the Beta-API opt-in header. The
                // Realtime API went GA and the Beta shape now rejects requests
                // with `beta_api_shape_disabled` — deliberately omitted.
                .build()

            isTearingDown = false
            val opened = CompletableDeferred<Unit>()
            val socket = wsClient.newWebSocket(request, RealtimeListener(opened))
            webSocket = socket

            // Wait for onOpen before sending anything — sending immediately
            // after newWebSocket races the handshake (the original "Socket is
            // not connected" bug pattern on iOS).
            try {
                opened.await()
            } catch (e: Exception) {
                _state.value = State.Error("WebSocket failed to open: ${e.message}")
                socket.cancel()
                webSocket = null
                restoreAudioRouting()
                throw e
            }

            // Start audio after the handshake settles: playback first (so the
            // first inbound delta has somewhere to go), then the recorder.
            try {
                startPlayback()
                startRecorder()
            } catch (e: Exception) {
                _state.value = State.Error("Failed to start audio engine: ${e.message}")
                doStop()
                throw e
            }

            _state.value = State.Connected
        }
    }

    /** Tear down WebSocket, audio engine, and audio routing. Idempotent. */
    suspend fun stop() {
        lifecycleMutex.withLock { doStop() }
    }

    private fun doStop() {
        val current = _state.value
        if (current == State.Idle || current == State.Ended) {
            // Parity with iOS: even when already torn down, leave the audio
            // routing restored.
            restoreAudioRouting()
            return
        }

        _state.value = State.Ending

        // "Cancel receive loop" first so our own close doesn't fire a stale
        // error through the listener.
        isTearingDown = true

        webSocket?.close(1001, "goingAway")
        webSocket = null

        // Stop player.
        playbackJob?.cancel()
        playbackJob = null
        while (playbackQueue.tryReceive().isSuccess) { /* drop queued frames */ }
        audioTrack?.let { track ->
            runCatching {
                track.pause()
                track.flush()
                track.stop()
            }
            track.release()
        }
        audioTrack = null

        // Stop recorder — cancel the loop before stopping the record so the
        // blocking read() returns and the coroutine exits.
        recordJob?.cancel()
        recordJob = null
        audioRecord?.let { record ->
            runCatching { record.stop() }
            record.release()
        }
        audioRecord = null
        echoCanceler?.release()
        echoCanceler = null

        restoreAudioRouting()

        isMicStreaming = false
        _isAiSpeaking.value = false
        _isWaitingForResponse.value = false

        _state.value = State.Ended
    }

    // MARK: - Push-to-talk

    /**
     * Begin streaming mic audio. Cancels any in-flight assistant response
     * first so the user can interrupt mid-sentence.
     */
    fun startTalking() {
        if (_state.value != State.Connected || webSocket == null) return

        if (_isWaitingForResponse.value || _isAiSpeaking.value) {
            cancelActiveResponse()
        }

        // Clear any leftover frames from a previous turn before a new one.
        sendEvent("input_audio_buffer.clear")

        isMicStreaming = true
        _isWaitingForResponse.value = false
    }

    /** Stop streaming mic audio and ask the assistant to respond. */
    fun stopTalking() {
        if (_state.value != State.Connected || !isMicStreaming) return

        isMicStreaming = false

        sendEvent("input_audio_buffer.commit")
        // GA Realtime: response.create must carry NO overrides. The Beta name
        // `modalities` now errors, and the session was minted with
        // `output_modalities: ["audio"]` server-side — an empty response.create
        // uses those session defaults.
        sendEvent("response.create")

        _isWaitingForResponse.value = true
    }

    /** Cancel an in-flight response (user interrupts). */
    private fun cancelActiveResponse() {
        sendEvent("response.cancel")
        sendEvent("output_audio_buffer.clear")
        val wasSpeaking = _isAiSpeaking.value
        _isWaitingForResponse.value = false
        _isAiSpeaking.value = false
        if (wasSpeaking) {
            // Drop queued playback so the assistant goes quiet immediately
            // rather than finishing the buffered phrase.
            flushLocalPlayback()
        }
    }

    private fun flushLocalPlayback() {
        while (playbackQueue.tryReceive().isSuccess) { /* drop queued frames */ }
        audioTrack?.let { track ->
            runCatching {
                track.pause()
                track.flush()
                track.play()
            }
        }
    }

    // MARK: - Audio routing

    private fun configureAudioRouting() {
        if (audioRoutingConfigured) return
        previousAudioMode = audioManager.mode
        // MODE_IN_COMMUNICATION = the "phone call" audio path (engages platform
        // echo cancellation / AGC alongside the VOICE_COMMUNICATION source).
        audioManager.mode = AudioManager.MODE_IN_COMMUNICATION

        // MODE_IN_COMMUNICATION routes to the earpiece by default like a phone
        // call. Force the built-in speaker so users hear the AI out loud —
        // but let a connected headset keep priority (mirrors iOS, where the
        // speaker override yields to Bluetooth/wired routes automatically).
        val devices = audioManager.availableCommunicationDevices
        val headset = devices.firstOrNull {
            it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO ||
                it.type == AudioDeviceInfo.TYPE_BLE_HEADSET ||
                it.type == AudioDeviceInfo.TYPE_WIRED_HEADSET ||
                it.type == AudioDeviceInfo.TYPE_WIRED_HEADPHONES ||
                it.type == AudioDeviceInfo.TYPE_USB_HEADSET
        }
        val target = headset
            ?: devices.firstOrNull { it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER }
        target?.let { runCatching { audioManager.setCommunicationDevice(it) } }

        audioRoutingConfigured = true
    }

    private fun restoreAudioRouting() {
        if (!audioRoutingConfigured) return
        runCatching { audioManager.clearCommunicationDevice() }
        audioManager.mode = previousAudioMode
        audioRoutingConfigured = false
    }

    // MARK: - Recorder (mic → 24 kHz PCM16 → base64 append)

    @SuppressLint("MissingPermission") // asserted in start()
    private fun startRecorder() {
        // Prefer capturing at the wire rate so no resample is needed; some
        // hardware only does 44.1/48 kHz — fall back and linear-resample.
        var record: AudioRecord? = null
        var sampleRate = 0
        for (candidate in intArrayOf(WIRE_SAMPLE_RATE, 44_100, 48_000)) {
            val minBuf = AudioRecord.getMinBufferSize(
                candidate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT
            )
            if (minBuf <= 0) continue
            val chunkFrames = candidate * CHUNK_MS / 1000
            val attempt = runCatching {
                AudioRecord(
                    // VOICE_COMMUNICATION source enables the platform echo/noise
                    // pipeline so the assistant's speaker output doesn't loop
                    // back into the mic.
                    MediaRecorder.AudioSource.VOICE_COMMUNICATION,
                    candidate,
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT,
                    maxOf(minBuf, chunkFrames * 2 * 4),
                )
            }.getOrNull()
            if (attempt?.state == AudioRecord.STATE_INITIALIZED) {
                record = attempt
                sampleRate = candidate
                break
            }
            attempt?.release()
        }
        val rec = record ?: throw IllegalStateException("Unable to initialize microphone capture")

        // Belt-and-suspenders AEC on top of the VOICE_COMMUNICATION source.
        echoCanceler = if (AcousticEchoCanceler.isAvailable()) {
            AcousticEchoCanceler.create(rec.audioSessionId)?.also { it.enabled = true }
        } else null

        audioRecord = rec
        rec.startRecording()

        // ~90 ms chunks — parity with iOS's 4096-frame tap at 44.1 kHz: small
        // enough for near-real-time, big enough to amortize per-send overhead.
        val chunkFrames = sampleRate * CHUNK_MS / 1000
        recordJob = scope.launch(Dispatchers.IO) {
            val chunk = ShortArray(chunkFrames)
            while (isActive) {
                val n = runCatching { rec.read(chunk, 0, chunk.size) }.getOrDefault(-1)
                if (n < 0) break
                if (n == 0) continue
                // Frames are forwarded ONLY while push-to-talk is held.
                if (!isMicStreaming || _state.value != State.Connected) continue

                val pcm24k = if (sampleRate == WIRE_SAMPLE_RATE) {
                    if (n == chunk.size) chunk else chunk.copyOf(n)
                } else {
                    resampleTo24k(chunk, n, sampleRate)
                }
                if (pcm24k.isEmpty()) continue
                val b64 = Base64.getEncoder()
                    .encodeToString(toLittleEndianBytes(pcm24k, pcm24k.size))
                sendEvent("input_audio_buffer.append", audioB64 = b64)
            }
        }
    }

    /** Naive linear resampler — voice-band mic audio, quality is fine. */
    private fun resampleTo24k(input: ShortArray, frames: Int, sourceRate: Int): ShortArray {
        val outFrames = (frames.toLong() * WIRE_SAMPLE_RATE / sourceRate).toInt()
        if (outFrames <= 0) return ShortArray(0)
        val out = ShortArray(outFrames)
        val step = sourceRate.toDouble() / WIRE_SAMPLE_RATE
        for (i in 0 until outFrames) {
            val pos = i * step
            val i0 = pos.toInt().coerceAtMost(frames - 1)
            val i1 = (i0 + 1).coerceAtMost(frames - 1)
            val frac = pos - pos.toInt()
            out[i] = (input[i0] + (input[i1] - input[i0]) * frac).toInt().toShort()
        }
        return out
    }

    private fun toLittleEndianBytes(samples: ShortArray, frames: Int): ByteArray {
        val bytes = ByteArray(frames * 2)
        ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)
            .asShortBuffer().put(samples, 0, frames)
        return bytes
    }

    // MARK: - Playback (base64 delta → 24 kHz PCM16 → AudioTrack)

    private fun startPlayback() {
        val minBuf = AudioTrack.getMinBufferSize(
            WIRE_SAMPLE_RATE, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT
        )
        // >= 500 ms of 24 kHz PCM16 (48 KB/s) so streaming writes don't underrun.
        val bufferBytes = maxOf(minBuf, WIRE_SAMPLE_RATE)
        val track = AudioTrack(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build(),
            AudioFormat.Builder()
                .setSampleRate(WIRE_SAMPLE_RATE)
                .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .build(),
            bufferBytes,
            AudioTrack.MODE_STREAM,
            AudioManager.AUDIO_SESSION_ID_GENERATE,
        )
        if (track.state != AudioTrack.STATE_INITIALIZED) {
            track.release()
            throw IllegalStateException("AudioTrack failed to initialize")
        }
        track.play()
        audioTrack = track

        playbackQueue = Channel(Channel.UNLIMITED)
        val queue = playbackQueue
        playbackJob = scope.launch(Dispatchers.IO) {
            for (pcm in queue) {
                if (!isActive) break
                // Blocking write paces playback to real time; errors after
                // release just end the loop.
                val written = runCatching { track.write(pcm, 0, pcm.size) }.getOrDefault(-1)
                if (written < 0) break
            }
        }
    }

    // MARK: - Event send

    /**
     * Send a JSON event over the WebSocket. OkHttp enqueues sends; failures
     * (e.g. a stale event during teardown) are expected and ignored.
     */
    private fun sendEvent(type: String, audioB64: String? = null) {
        val socket = webSocket ?: return
        val payload = buildJsonObject {
            put("type", type)
            if (audioB64 != null) put("audio", audioB64)
        }
        socket.send(payload.toString())
    }

    // MARK: - Receive

    private fun handleServerEvent(text: String) {
        if (isTearingDown) return
        val event = runCatching {
            WagerproofJson.parseToJsonElement(text).jsonObject
        }.getOrNull() ?: return
        val type = (event["type"] as? JsonPrimitive)?.contentOrNull ?: return

        when (type) {
            "session.created", "session.updated" -> {
                // Server-initial events. The edge function pre-configured
                // everything, so we don't react (and never reply with
                // session.update — see class docs).
            }

            "response.created" -> _isWaitingForResponse.value = true

            "output_audio_buffer.started" -> {
                _isWaitingForResponse.value = false
                _isAiSpeaking.value = true
            }

            "output_audio_buffer.stopped", "output_audio_buffer.cleared" -> {
                _isAiSpeaking.value = false
                _isWaitingForResponse.value = false
            }

            "response.done" -> {
                // Text-only responses still need to flip out of "Thinking...".
                if (!_isAiSpeaking.value) _isWaitingForResponse.value = false
            }

            "response.cancelled" -> {
                _isWaitingForResponse.value = false
                _isAiSpeaking.value = false
            }

            // Beta-era "response.audio.delta" kept as a fallback in case OpenAI
            // re-emits it for older sessions. Harmless if it never fires.
            "response.output_audio.delta", "response.audio.delta" -> {
                val b64 = (event["delta"] as? JsonPrimitive)?.contentOrNull ?: return
                val pcm16 = runCatching { Base64.getDecoder().decode(b64) }.getOrNull() ?: return
                if (pcm16.isNotEmpty()) playbackQueue.trySend(pcm16)
            }

            "error" -> {
                val message = ((event["error"] as? JsonObject)
                    ?.get("message") as? JsonPrimitive)?.contentOrNull
                    ?: "WagerBot Voice hit a realtime error."
                _state.value = State.Error(message)
            }

            else -> {
                // session.* lifecycle, transcript deltas, etc. — no-op.
            }
        }
    }

    /**
     * WebSocket listener. `opened` resolves when the handshake completes —
     * the only reliable signal that subsequent send() calls will stick.
     */
    private inner class RealtimeListener(
        private val opened: CompletableDeferred<Unit>,
    ) : WebSocketListener() {

        override fun onOpen(webSocket: WebSocket, response: Response) {
            opened.complete(Unit)
        }

        override fun onMessage(webSocket: WebSocket, text: String) {
            handleServerEvent(text)
        }

        override fun onMessage(webSocket: WebSocket, bytes: ByteString) {
            handleServerEvent(bytes.utf8())
        }

        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
            val message = reason.ifEmpty { "Connection closed (code $code)" }
            if (!opened.isCompleted) {
                // Closed before we ever opened — surface as an open failure.
                opened.completeExceptionally(IOException(message))
            } else if (!isTearingDown && _state.value == State.Connected) {
                _state.value = State.Error(message)
            }
        }

        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
            if (!opened.isCompleted) {
                opened.completeExceptionally(t)
            } else if (!isTearingDown && _state.value == State.Connected) {
                _state.value = State.Error(t.message ?: "Connection lost")
            }
        }
    }

    private companion object {
        /** OpenAI Realtime wire format: 24 kHz mono PCM16 little-endian. */
        const val WIRE_SAMPLE_RATE = 24_000

        /** Mic chunk duration per input_audio_buffer.append. */
        const val CHUNK_MS = 90
    }
}

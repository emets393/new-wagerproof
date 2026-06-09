// WagerBotVoiceSession.swift
//
// OpenAI Realtime API session over WebSocket. Ported from Honeydew's
// VoiceChefSession (already migrated to the GA Realtime API) — same audio +
// WebSocket engine, rebranded for WagerBot and pointed at WagerProof's
// `create-wagerbot-voice-session` Supabase edge function.
//
// Connection model:
//   1. `WagerBotVoiceFunctions.createVoiceSession(voice:rudeness:gameContext:)`
//      mints an ephemeral client secret server-side (GA
//      /v1/realtime/client_secrets) and returns the model the session was
//      minted for. The edge function pre-configures the session's
//      instructions, voice, audio formats, and turn detection — so we do NOT
//      send a `session.update` event here. Doing so would override the
//      server-side PTT config (turn_detection: null) and silently break
//      push-to-talk.
//   2. Open a WebSocket against `wss://api.openai.com/v1/realtime?model=<model>`
//      with `Authorization: Bearer <clientSecret>`. The model in the URL MUST
//      match the model the server minted the session for; mismatches cause
//      OpenAI to reject the handshake with the literal string "Socket is not
//      connected".
//   3. Audio I/O is AVAudioEngine + AVAudioPlayerNode:
//        - mic tap → AVAudioConverter → 24 kHz / mono / PCM16
//          → base64 → `input_audio_buffer.append`
//        - inbound `response.output_audio.delta` → base64 → PCM16
//          → AVAudioPCMBuffer (Float32) → AVAudioPlayerNode.scheduleBuffer
//   4. Push-to-talk: the mic tap is always installed once connected, but its
//      frames are only forwarded when `isMicStreaming` is true. On release we
//      send `input_audio_buffer.commit` + `response.create`.

import Foundation
import Observation
import AVFoundation
import WagerproofServices

@Observable @MainActor
public final class WagerBotVoiceSession: NSObject {
    // MARK: - State

    public enum State: Equatable {
        case idle
        case requestingSession
        case connecting
        case connected
        case ending
        case ended
        case error(String)
    }

    /// Current lifecycle state. Drives the avatar pulse cadence + status pill.
    public private(set) var state: State = .idle

    /// True when the assistant is producing audio output. Drives the
    /// "Speaking..." status text in the view.
    public private(set) var isAiSpeaking: Bool = false

    /// True between `stopTalking()` and the assistant's first audio chunk.
    /// Drives the "Thinking..." status text.
    public private(set) var isWaitingForResponse: Bool = false

    /// Mute toggle exposed for parity. View doesn't use it today; left in
    /// place so a future "mute" UI affordance has somewhere to land.
    public var isMuted: Bool = false

    // MARK: - Private connection state

    @ObservationIgnored private var websocketTask: URLSessionWebSocketTask?
    @ObservationIgnored private var receiveTask: Task<Void, Never>?
    @ObservationIgnored private var session: RealtimeSession?

    /// URLSession with self as the delegate — we need the delegate so we get
    /// the `didOpenWithProtocol` callback that confirms the WebSocket
    /// handshake completed. Using `URLSession.shared` and immediately calling
    /// `.send()` on the resumed task is the bug pattern that produced the
    /// original "Socket is not connected" error: messages were queued before
    /// the handshake completed and failed when the connection was refused.
    ///
    /// `@ObservationIgnored` is required because `@Observable` rewrites
    /// stored properties into observation-tracked computed ones, which is
    /// incompatible with `lazy var`.
    @ObservationIgnored private lazy var urlSession: URLSession = {
        let config = URLSessionConfiguration.default
        return URLSession(configuration: config, delegate: self, delegateQueue: nil)
    }()

    /// Resolved when the WebSocket delegate confirms the handshake completed.
    @ObservationIgnored private var connectionOpenContinuation: CheckedContinuation<Void, Error>?

    // MARK: - Audio plumbing

    /// Owns the input tap and the output player node. Same engine handles
    /// both directions so `AVAudioSession` only needs one `.playAndRecord`
    /// activation.
    @ObservationIgnored private let audioEngine = AVAudioEngine()
    @ObservationIgnored private let playerNode = AVAudioPlayerNode()

    /// Converter mic-native format → OpenAI's expected 24 kHz mono PCM16.
    /// Recreated whenever the input format changes (e.g., headphones plugged
    /// in mid-session — AVAudioEngine fires a configuration change).
    @ObservationIgnored private var micConverter: AVAudioConverter?

    /// Converter 24 kHz PCM16 (server output) → engine mixer's native float
    /// format so `scheduleBuffer` accepts the result. Format negotiated lazily
    /// on the first audio delta because the mixer's format isn't stable until
    /// the engine starts.
    @ObservationIgnored private var playbackConverter: AVAudioConverter?

    /// Engine's mixer format at the moment we attached the player. Used as
    /// the destination format for inbound audio decode. Set in `start(...)`.
    @ObservationIgnored private var playbackFormat: AVAudioFormat?

    /// OpenAI's audio format on the wire: 24 kHz, mono, PCM16, interleaved.
    /// Used for both the input converter destination and the output decode
    /// source. Created once at init.
    @ObservationIgnored private let openAIWireFormat: AVAudioFormat = {
        // commonFormat .pcmFormatInt16, interleaved true matches the
        // little-endian PCM16 bytes the Realtime API emits/expects.
        return AVAudioFormat(
            commonFormat: .pcmFormatInt16,
            sampleRate: 24_000,
            channels: 1,
            interleaved: true
        )!
    }()

    /// True while the PTT button is held and we should forward mic tap
    /// buffers to the server. Flipped by `startTalking()` / `stopTalking()`.
    @ObservationIgnored private var isMicStreaming: Bool = false

    public override init() {
        super.init()
    }

    // MARK: - Lifecycle

    /// Mint an ephemeral session, open the WebSocket, prepare the audio
    /// engine. Caller is responsible for invoking `startTalking()` /
    /// `stopTalking()` for push-to-talk turns.
    ///
    /// Voice / rudeness are wire strings — `marin`/`cedar`/`ash` and
    /// `friendly`/`spicy`. The caller (WagerBotVoiceView) is the source of
    /// truth for what the user picked.
    ///
    /// `gameContext` is optional pre-formatted matchup data the edge function
    /// appends to the system prompt so the bot can talk about a specific game.
    ///
    /// `modelWire` and `guidance` are the iOS "Advanced" voice settings (parity
    /// with Honeydew): `modelWire` is an OpenAI Realtime model id
    /// (`gpt-realtime` / `gpt-realtime-mini`); nil → server default. `guidance`
    /// is free-text steering appended to the system prompt server-side.
    public func start(
        voiceWire: String,
        rudenessWire: String,
        gameContext: String? = nil,
        modelWire: String? = nil,
        guidance: String? = nil
    ) async throws {
        // Re-entry guard: bail out of any TRANSITIONAL state (requesting,
        // connecting, ending) so concurrent taps don't tear down a session
        // mid-handshake. A `.connected` state, however, MUST tear down
        // first — that's how rudeness/voice picks take effect mid-session.
        switch state {
        case .idle, .ended, .error, .connected:
            break
        case .requestingSession, .connecting, .ending:
            return
        }

        // Tear down any prior session so a reconnect (e.g., picking Spicy
        // while connected on Friendly) starts from a clean slate. `stop()`
        // is idempotent and short-circuits when already idle.
        if state == .connected {
            await stop()
        }

        state = .requestingSession

        // Ensure mic permission.
        let granted = await Self.ensureMicrophonePermission()
        if !granted {
            state = .error("Microphone permission is required for WagerBot Voice.")
            throw NSError(
                domain: "WagerBotVoiceSession", code: 403,
                userInfo: [NSLocalizedDescriptionKey: "Microphone permission denied"]
            )
        }

        // Mint the ephemeral session. Wire values pass through directly — the
        // caller already normalized to marin/cedar/ash and friendly/spicy.
        let realtimeSession: RealtimeSession
        do {
            realtimeSession = try await WagerBotVoiceFunctions.createVoiceSession(
                voice: voiceWire,
                rudeness: rudenessWire,
                gameContext: gameContext,
                model: modelWire,
                guidance: guidance
            )
        } catch {
            state = .error(error.localizedDescription)
            throw error
        }
        self.session = realtimeSession

        // Audio session config — `.playAndRecord` + `.voiceChat` is the
        // documented mode for two-way real-time audio (it engages the Voice
        // Processing IO unit, which adds echo cancellation so the AI's voice
        // doesn't loop back into the mic).
        do {
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(
                .playAndRecord,
                mode: .voiceChat,
                options: [.defaultToSpeaker, .allowBluetoothHFP, .allowBluetoothA2DP]
            )
            try audioSession.setActive(true, options: [])
            // `.defaultToSpeaker` is silently ignored under `.voiceChat` mode —
            // that mode treats the session like a phone call and routes to the
            // receiver/earpiece. Force the built-in speaker explicitly so users
            // hear the AI out loud. Bluetooth and wired headsets still take
            // priority over this override automatically.
            try audioSession.overrideOutputAudioPort(.speaker)
        } catch {
            state = .error("Failed to configure audio: \(error.localizedDescription)")
            throw error
        }

        // Open WebSocket. Model in URL MUST match what the server minted.
        state = .connecting

        var components = URLComponents(string: "wss://api.openai.com/v1/realtime")!
        components.queryItems = [URLQueryItem(name: "model", value: realtimeSession.model)]
        var request = URLRequest(url: components.url!)
        request.setValue("Bearer \(realtimeSession.clientSecret)", forHTTPHeaderField: "Authorization")
        // `OpenAI-Beta: realtime=v1` was the Beta-API opt-in header. The
        // Realtime API went GA in May 2026 and the Beta shape now rejects
        // requests with `beta_api_shape_disabled`; sending the header is at
        // best a no-op and at worst causes the same rejection, so we omit it.

        let task = urlSession.webSocketTask(with: request)
        websocketTask = task

        // Wait for the delegate's didOpen callback before we send anything.
        // Without this, `task.send()` can race the handshake.
        do {
            try await withCheckedThrowingContinuation { continuation in
                connectionOpenContinuation = continuation
                task.resume()
            }
        } catch {
            state = .error("WebSocket failed to open: \(error.localizedDescription)")
            websocketTask?.cancel()
            websocketTask = nil
            connectionOpenContinuation = nil
            throw error
        }

        // Start the receive loop now that the handshake is settled.
        startReceiveLoop()

        // Prepare audio engine. Installs the mic tap (PTT-controlled),
        // attaches the player node.
        do {
            try setupAudioEngine()
        } catch {
            state = .error("Failed to start audio engine: \(error.localizedDescription)")
            await stop()
            throw error
        }

        state = .connected
    }

    /// Tear down WebSocket, audio engine, and audio session. Idempotent.
    public func stop() async {
        guard state != .idle, state != .ended else {
            // Even when already torn down, leave audio session deactivated.
            try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
            return
        }

        state = .ending

        // Cancel receive loop first so it doesn't fire a stale .error on the
        // task cancellation we're about to issue.
        receiveTask?.cancel()
        receiveTask = nil

        websocketTask?.cancel(with: .goingAway, reason: nil)
        websocketTask = nil

        // Audio teardown — order matters: stop player → stop engine → remove
        // tap → deactivate session. Reversing causes "tap installed on
        // running engine" errors on relaunch.
        playerNode.stop()
        if audioEngine.isRunning { audioEngine.stop() }
        audioEngine.inputNode.removeTap(onBus: 0)

        try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])

        isMicStreaming = false
        isAiSpeaking = false
        isWaitingForResponse = false
        micConverter = nil
        playbackConverter = nil
        playbackFormat = nil

        state = .ended
    }

    // MARK: - Push-to-talk

    /// Begin streaming mic audio. Cancels any in-flight assistant response
    /// first so the user can interrupt mid-sentence.
    public func startTalking() async {
        guard state == .connected, websocketTask != nil else { return }

        // Interrupt the assistant if it's mid-response.
        if isWaitingForResponse || isAiSpeaking {
            await cancelActiveResponse()
        }

        // Clear any leftover frames from a previous turn before we begin a
        // new one.
        await sendEvent(["type": "input_audio_buffer.clear"])

        isMicStreaming = true
        isWaitingForResponse = false
    }

    /// Stop streaming mic audio and ask the assistant to respond.
    public func stopTalking() async {
        guard state == .connected, isMicStreaming else { return }

        isMicStreaming = false

        await sendEvent(["type": "input_audio_buffer.commit"])
        // GA Realtime: response.create's per-call config uses `output_modalities`
        // (the Beta name was `modalities`, which now errors with "unknown
        // parameter response.modalities"). The session was created with
        // `output_modalities: ["audio"]`, so we omit the override entirely and
        // let the server use session defaults.
        await sendEvent(["type": "response.create"])

        isWaitingForResponse = true
    }

    /// Cancel an in-flight response (e.g., user interrupts).
    private func cancelActiveResponse() async {
        await sendEvent(["type": "response.cancel"])
        await sendEvent(["type": "output_audio_buffer.clear"])
        let wasSpeaking = isAiSpeaking
        isWaitingForResponse = false
        isAiSpeaking = false
        if wasSpeaking {
            // Drop any queued playback frames so the assistant goes quiet
            // immediately rather than finishing the buffered phrase.
            playerNode.stop()
            playerNode.play()
        }
    }

    // MARK: - Audio engine setup

    /// Installs the mic tap, attaches the player node, starts the engine.
    /// Called once after the WebSocket is open.
    private func setupAudioEngine() throws {
        let engine = audioEngine
        let inputNode = engine.inputNode

        // Player attach. Format `nil` lets the mixer auto-negotiate based on
        // the buffers we schedule. We capture the mixer's format after start
        // so the playback converter can target it.
        engine.attach(playerNode)
        engine.connect(playerNode, to: engine.mainMixerNode, format: nil)

        // Mic tap. We let the tap run at the input's native format and
        // convert per-buffer to 24 kHz PCM16 mono inside the callback. Buffer
        // size 4096 is roughly 90 ms at 44.1 kHz — small enough that the
        // server perceives near-real-time audio, big enough to amortize the
        // converter overhead.
        let inputFormat = inputNode.outputFormat(forBus: 0)
        inputNode.installTap(
            onBus: 0,
            bufferSize: 4096,
            format: inputFormat
        ) { [weak self] buffer, _ in
            self?.handleMicBuffer(buffer)
        }

        engine.prepare()
        try engine.start()
        playerNode.play()

        // Snapshot the player's input format for inbound decode. mainMixer's
        // output format is what `scheduleBuffer` ultimately wants.
        playbackFormat = engine.mainMixerNode.outputFormat(forBus: 0)
    }

    /// Convert a mic buffer to 24 kHz mono PCM16 and forward base64 to the
    /// server. Runs on the tap's audio thread — keep it non-blocking.
    private nonisolated func handleMicBuffer(_ buffer: AVAudioPCMBuffer) {
        // Snapshot state on the main actor without blocking the audio thread.
        Task { @MainActor [weak self] in
            guard let self else { return }
            guard self.isMicStreaming, self.state == .connected else { return }
            self.encodeAndSendMic(buffer)
        }
    }

    private func encodeAndSendMic(_ buffer: AVAudioPCMBuffer) {
        guard let inputFormat = buffer.format.commonFormat == .pcmFormatFloat32
            ? buffer.format
            : AVAudioFormat(
                commonFormat: .pcmFormatFloat32,
                sampleRate: buffer.format.sampleRate,
                channels: buffer.format.channelCount,
                interleaved: false
            ) else { return }

        // Build / refresh the converter if the input format changed (e.g.,
        // route changed mid-session — headphones unplugged).
        if micConverter?.inputFormat != inputFormat {
            micConverter = AVAudioConverter(from: inputFormat, to: openAIWireFormat)
        }
        guard let converter = micConverter else { return }

        // Compute destination capacity. Source N frames at source rate →
        // N * (dest_rate / source_rate) frames at dest rate. Round up.
        let ratio = openAIWireFormat.sampleRate / inputFormat.sampleRate
        let outputCapacity = AVAudioFrameCount(
            (Double(buffer.frameLength) * ratio).rounded(.up)
        )
        guard let outputBuffer = AVAudioPCMBuffer(
            pcmFormat: openAIWireFormat,
            frameCapacity: outputCapacity
        ) else { return }

        var error: NSError?
        var inputProvided = false
        let status = converter.convert(to: outputBuffer, error: &error) { _, outStatus in
            if inputProvided {
                outStatus.pointee = .noDataNow
                return nil
            }
            inputProvided = true
            outStatus.pointee = .haveData
            return buffer
        }

        guard status == .haveData || status == .inputRanDry,
              error == nil,
              outputBuffer.frameLength > 0,
              let int16Channel = outputBuffer.int16ChannelData?[0] else {
            return
        }

        // Interleaved PCM16: frameLength frames × channelCount samples × 2 bytes.
        let byteCount = Int(outputBuffer.frameLength) * Int(openAIWireFormat.channelCount) * MemoryLayout<Int16>.size
        let data = Data(bytes: int16Channel, count: byteCount)
        let base64 = data.base64EncodedString()

        Task { [weak self] in
            await self?.sendEvent([
                "type": "input_audio_buffer.append",
                "audio": base64,
            ])
        }
    }

    // MARK: - Event send

    /// Send a JSON event over the WebSocket. Errors are swallowed and logged
    /// in DEBUG — a stale event during teardown is expected.
    private func sendEvent(_ event: [String: Any]) async {
        guard let task = websocketTask else { return }
        do {
            let data = try JSONSerialization.data(withJSONObject: event)
            let text = String(data: data, encoding: .utf8) ?? ""
            try await task.send(.string(text))
        } catch {
            #if DEBUG
            print("WagerBotVoiceSession sendEvent failed: \(error)")
            #endif
        }
    }

    // MARK: - Mic permission

    private static func ensureMicrophonePermission() async -> Bool {
        if #available(iOS 17.0, *) {
            switch AVAudioApplication.shared.recordPermission {
            case .granted: return true
            case .denied:  return false
            case .undetermined:
                return await AVAudioApplication.requestRecordPermission()
            @unknown default:
                return false
            }
        } else {
            // Pre-iOS-17 fallback.
            let session = AVAudioSession.sharedInstance()
            switch session.recordPermission {
            case .granted: return true
            case .denied:  return false
            case .undetermined:
                return await withCheckedContinuation { continuation in
                    session.requestRecordPermission { granted in
                        continuation.resume(returning: granted)
                    }
                }
            @unknown default:
                return false
            }
        }
    }

    // MARK: - Receive loop

    private func startReceiveLoop() {
        receiveTask = Task { [weak self] in
            while let self, !Task.isCancelled {
                guard let task = await self.websocketTask else { break }
                do {
                    let message = try await task.receive()
                    await self.handleMessage(message)
                } catch {
                    if !Task.isCancelled {
                        await self.handleReceiveError(error)
                    }
                    break
                }
            }
        }
    }

    private func handleReceiveError(_ error: Error) {
        // Connection dropped — flip to error so the view shows a reconnect
        // affordance. Surface the localized description so the toast text
        // matches what the user sees.
        state = .error(error.localizedDescription)
    }

    private func handleMessage(_ message: URLSessionWebSocketTask.Message) async {
        let json: [String: Any]?
        switch message {
        case .string(let text):
            json = (try? JSONSerialization.jsonObject(with: Data(text.utf8))) as? [String: Any]
        case .data(let data):
            json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        @unknown default:
            return
        }

        guard let event = json, let type = event["type"] as? String else { return }
        await handleEvent(type: type, payload: event)
    }

    private func handleEvent(type: String, payload: [String: Any]) async {
        switch type {
        case "session.created", "session.updated":
            // Server-initial events. No view state changes — the edge function
            // pre-configured everything, so we don't react.
            break

        case "response.created":
            isWaitingForResponse = true

        case "output_audio_buffer.started":
            isWaitingForResponse = false
            isAiSpeaking = true

        case "output_audio_buffer.stopped",
             "output_audio_buffer.cleared":
            isAiSpeaking = false
            isWaitingForResponse = false

        case "response.done":
            // If the assistant generated text-only (no audio) we still want
            // to flip out of "Thinking..." once the response completes.
            if !isAiSpeaking { isWaitingForResponse = false }

        case "response.cancelled":
            isWaitingForResponse = false
            if isAiSpeaking {
                isAiSpeaking = false
            }

        case "response.output_audio.delta",
             // Beta-era name kept as a belt-and-suspenders fallback in case
             // OpenAI re-emits it for older sessions. Harmless if never fires.
             "response.audio.delta":
            // Inbound audio chunk — decode base64 PCM16 and schedule for
            // playback. The transcript surface isn't used in this feature so
            // we drop transcript deltas.
            if let b64 = payload["delta"] as? String,
               let pcm16 = Data(base64Encoded: b64) {
                schedulePlayback(pcm16: pcm16)
            }

        case "error":
            let msg = (payload["error"] as? [String: Any])?["message"] as? String
                ?? "WagerBot Voice hit a realtime error."
            state = .error(msg)

        default:
            // session.* lifecycle, transcript deltas, etc. — no-op.
            break
        }
    }

    // MARK: - Inbound audio playback

    /// Decode PCM16 @ 24 kHz mono → engine mixer's float format → schedule on
    /// the player node.
    private func schedulePlayback(pcm16: Data) {
        guard let playbackFormat else { return }

        // Wrap the inbound bytes as an Int16 PCM buffer.
        let frameCount = AVAudioFrameCount(pcm16.count / MemoryLayout<Int16>.size)
        guard frameCount > 0,
              let int16Buffer = AVAudioPCMBuffer(
                pcmFormat: openAIWireFormat,
                frameCapacity: frameCount
              ) else { return }
        int16Buffer.frameLength = frameCount
        pcm16.withUnsafeBytes { rawBuffer in
            guard let src = rawBuffer.baseAddress,
                  let dst = int16Buffer.int16ChannelData?[0] else { return }
            memcpy(dst, src, pcm16.count)
        }

        // Refresh converter if the playback format changed (e.g., route flip
        // mid-session swaps the mixer's output format).
        if playbackConverter?.outputFormat != playbackFormat {
            playbackConverter = AVAudioConverter(from: openAIWireFormat, to: playbackFormat)
        }
        guard let converter = playbackConverter else { return }

        let ratio = playbackFormat.sampleRate / openAIWireFormat.sampleRate
        let outCapacity = AVAudioFrameCount((Double(frameCount) * ratio).rounded(.up))
        guard outCapacity > 0,
              let floatBuffer = AVAudioPCMBuffer(
                pcmFormat: playbackFormat,
                frameCapacity: outCapacity
              ) else { return }

        var error: NSError?
        var provided = false
        let status = converter.convert(to: floatBuffer, error: &error) { _, outStatus in
            if provided {
                outStatus.pointee = .noDataNow
                return nil
            }
            provided = true
            outStatus.pointee = .haveData
            return int16Buffer
        }

        guard status == .haveData || status == .inputRanDry,
              error == nil,
              floatBuffer.frameLength > 0 else {
            return
        }

        playerNode.scheduleBuffer(floatBuffer, completionHandler: nil)
        if !playerNode.isPlaying {
            playerNode.play()
        }
    }
}

// MARK: - URLSessionWebSocketDelegate

extension WagerBotVoiceSession: URLSessionWebSocketDelegate {
    /// Fires when the WebSocket handshake completes — the only reliable
    /// signal that subsequent `.send()` calls won't hit "Socket is not
    /// connected".
    nonisolated public func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didOpenWithProtocol protocol: String?
    ) {
        Task { @MainActor [weak self] in
            self?.connectionOpenContinuation?.resume()
            self?.connectionOpenContinuation = nil
        }
    }

    /// Fires on handshake rejection (HTTP 4xx) or remote close.
    nonisolated public func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didCloseWith closeCode: URLSessionWebSocketTask.CloseCode,
        reason: Data?
    ) {
        let reasonText: String
        if let reason, let s = String(data: reason, encoding: .utf8), !s.isEmpty {
            reasonText = s
        } else {
            reasonText = "Connection closed (code \(closeCode.rawValue))"
        }
        Task { @MainActor [weak self] in
            guard let self else { return }
            if let cont = self.connectionOpenContinuation {
                // Closed before we ever opened — surface as an open failure.
                cont.resume(throwing: NSError(
                    domain: "WagerBotVoiceSession", code: closeCode.rawValue,
                    userInfo: [NSLocalizedDescriptionKey: reasonText]
                ))
                self.connectionOpenContinuation = nil
            } else if self.state == .connected {
                self.state = .error(reasonText)
            }
        }
    }

    /// Fires on TLS errors, name resolution failures, etc. before the
    /// WebSocket handshake even reaches the server.
    nonisolated public func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        didCompleteWithError error: Error?
    ) {
        guard let error else { return }
        Task { @MainActor [weak self] in
            guard let self else { return }
            if let cont = self.connectionOpenContinuation {
                cont.resume(throwing: error)
                self.connectionOpenContinuation = nil
            } else if self.state == .connected {
                self.state = .error(error.localizedDescription)
            }
        }
    }
}

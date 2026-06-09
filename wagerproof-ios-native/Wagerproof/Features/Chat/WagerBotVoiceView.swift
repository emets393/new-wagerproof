// WagerBotVoiceView.swift
//
// Faithful UX port of Honeydew's `RoastChefView`, rebranded for WagerProof as
// "WagerBot Voice". Drives `WagerBotVoiceSession` (the already-ported realtime
// audio + WebSocket engine) and renders the same visual state machine:
// connecting → ready → listening → thinking → speaking, a press-and-hold
// push-to-talk button, a voice + personality picker sheet, an inline error
// card + top toast, a session-duration timer, and a close/hang-up control.
//
// Port-time translations from Honeydew:
//   - Honeydew's `Color.appSecondary/appAlternate/appPrimaryBackground/
//     appSecondaryText` DO NOT exist in WagerProof. We map onto WagerProof's
//     real tokens: brand green `appPrimary`, surfaces `appSurface` /
//     `appSurfaceElevated`, border `appBorder`, text `appTextPrimary` /
//     `appTextSecondary`. The screen uses WagerProof's dark theme (matching
//     `RoastView`) so the green orb reads as the focal point.
//   - Honeydew bundles per-voice "monster" Lottie files; WagerProof has none,
//     so the avatar uses `ChattingRobot.json` (the WagerProof voice avatar) for
//     every voice — the voice name/subtitle still changes underneath.
//   - Custom Nunito/Manrope fonts → WagerProof's system-font `AppFont` ramp.
//   - Honeydew persists voice/rudeness in `SettingsStore`; WagerProof's
//     `SettingsStore` has no voice fields, so we persist with `@AppStorage`.
//   - The session exposes coarse state (idle/connecting/connected/error) plus
//     `isAiSpeaking` / `isWaitingForResponse`. We mirror those into local
//     visual flags and track the PTT-held flag locally (the engine doesn't
//     surface it).
//
// Backend wire ids (from WagerBotVoiceFunctions): voice ∈ {marin, cedar, ash},
// rudeness ∈ {friendly, spicy}.

import SwiftUI
import UIKit
import WagerproofDesign
import WagerproofServices
import WagerproofStores

// MARK: - Voice / personality identity

/// The three voices the picker exposes. Raw values are the backend wire ids
/// passed straight to `WagerBotVoiceSession.start(voiceWire:)`.
private enum WagerBotVoice: String, CaseIterable, Hashable {
    case marin
    case cedar
    case ash

    /// Marketing name shown beneath the orb.
    var displayName: String {
        switch self {
        case .marin: return "Sky"
        case .cedar: return "Vegas"
        case .ash:   return "Ace"
        }
    }

    var subtitle: String {
        switch self {
        case .marin: return "Warm, measured voice"
        case .cedar: return "Deep, confident voice"
        case .ash:   return "Crisp, neutral voice"
        }
    }
}

/// Two-step personality picker. Raw values are the backend wire ids passed to
/// `WagerBotVoiceSession.start(rudenessWire:)`.
private enum WagerBotPersonality: String, CaseIterable, Hashable {
    case friendly
    case spicy

    var label: String {
        switch self {
        case .friendly: return "Friendly"
        case .spicy:    return "Spicy"
        }
    }

    var subtitle: String {
        switch self {
        case .friendly: return "Helpful, level-headed betting analyst"
        case .spicy:    return "Brutally honest hot takes — adults only"
        }
    }
}

/// Realtime model picker (the "Advanced" section, parity with Honeydew). Raw
/// values are the OpenAI Realtime model ids passed straight to
/// `WagerBotVoiceSession.start(modelWire:)`.
private enum WagerBotModel: String, CaseIterable, Hashable {
    case flagship = "gpt-realtime"
    case fast = "gpt-realtime-mini"

    var displayName: String {
        switch self {
        case .flagship: return "Flagship"
        case .fast:     return "Fast"
        }
    }

    var subtitle: String {
        switch self {
        case .flagship: return "Most capable"
        case .fast:     return "Lower latency"
        }
    }

    var icon: String {
        switch self {
        case .flagship: return "sparkles"
        case .fast:     return "bolt.fill"
        }
    }
}

// MARK: - WagerBotVoiceView

struct WagerBotVoiceView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(ProAccessStore.self) private var proAccess

    /// Underlying realtime session — the already-ported audio + WS engine.
    @State private var session = WagerBotVoiceSession()

    // ---- Persisted picks (WagerProof's SettingsStore has no voice fields) ---
    @AppStorage("wagerbot.voice") private var voiceRaw: String = WagerBotVoice.marin.rawValue
    @AppStorage("wagerbot.personality") private var personalityRaw: String = WagerBotPersonality.friendly.rawValue
    // Advanced settings (parity with Honeydew): the realtime model and free-text
    // steering guidance. Both apply on the next connect; model change reconnects.
    @AppStorage("wagerbot.model") private var modelRaw: String = WagerBotModel.flagship.rawValue
    @AppStorage("wagerbot.guidance") private var guidanceText: String = ""

    private var selectedVoice: WagerBotVoice {
        WagerBotVoice(rawValue: voiceRaw) ?? .marin
    }
    private var selectedPersonality: WagerBotPersonality {
        WagerBotPersonality(rawValue: personalityRaw) ?? .friendly
    }
    private var selectedModel: WagerBotModel {
        WagerBotModel(rawValue: modelRaw) ?? .flagship
    }
    /// Trimmed guidance, or nil when empty — the session expects nil, not "".
    private var guidanceWire: String? {
        let trimmed = guidanceText.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    // ---- Local visual flags (mirror of Honeydew's page model) ---------------

    /// True while the user holds the talk button. The engine doesn't surface
    /// this, so it's tracked locally.
    @State private var isHoldingToTalk: Bool = false

    /// Mirror of `session.isWaitingForResponse` / `session.isAiSpeaking`,
    /// copied via `.onChange` so the status pill follows real server state.
    @State private var isWaitingForResponse: Bool = false
    @State private var isAiSpeaking: Bool = false

    /// Last error surfaced as the inline card + transient toast banner.
    @State private var lastError: String?
    @State private var showToast: Bool = false

    /// Wall-clock at successful connect — drives the duration timer.
    @State private var connectedAt: Date?
    @State private var nowTick: Int = 0

    /// Picker sheet + limit sheet presentation.
    @State private var showSettingsSheet: Bool = false
    @State private var showLimitSheet: Bool = false
    @State private var limitMessage: String?
    @State private var showPaywall: Bool = false

    /// Orb breathing animation phase.
    @State private var pulsePhase: Double = 0

    // Haptic counters — `.sensoryFeedback` only fires on value change.
    @State private var ptStartCount: Int = 0
    @State private var ptEndCount: Int = 0
    @State private var selectionCount: Int = 0

    // MARK: - Derived state

    private var isConnecting: Bool {
        switch session.state {
        case .requestingSession, .connecting: return true
        default: return false
        }
    }

    private var isConnected: Bool {
        session.state == .connected
    }

    private var isActive: Bool {
        isHoldingToTalk || isAiSpeaking || isWaitingForResponse
    }

    /// Status pill text — mirrors Honeydew's `_statusText`.
    private var statusText: String {
        if lastError != nil { return "Reconnect needed" }
        if isHoldingToTalk { return "Listening..." }
        if isAiSpeaking { return "Speaking..." }
        if isWaitingForResponse { return "Thinking..." }
        if isConnecting { return "Connecting..." }
        if isConnected { return "Ready" }
        return "Disconnected"
    }

    private var statusDotColor: Color {
        if lastError != nil { return Color.appAccentRed }
        if isHoldingToTalk { return Color.appAccentAmber }
        if isAiSpeaking || isWaitingForResponse { return Color.appPrimary }
        if isConnected { return Color.appPrimary }
        return Color.white.opacity(0.4)
    }

    /// Header duration label — matches Honeydew's `_formatDuration`.
    private var formattedDuration: String {
        _ = nowTick // force recompute each tick
        guard let connectedAt else { return "00:00" }
        let elapsed = Int(Date().timeIntervalSince(connectedAt))
        return String(format: "%02d:%02d", (elapsed / 60) % 60, elapsed % 60)
    }

    // MARK: - Body

    var body: some View {
        ZStack {
            // Full-bleed dark gradient — matches RoastView so the green orb
            // pops as the focal point.
            LinearGradient(
                colors: [Color(hex: 0x0A0A0A), Color(hex: 0x111827), Color(hex: 0x0A0A0A)],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            GeometryReader { geo in
                let isCompact = geo.size.height < 620

                VStack(spacing: 0) {
                    header

                    VStack(spacing: 14) {
                        statusPill
                        botHeaderRow
                    }
                    .padding(.top, 8)

                    Spacer(minLength: 0)
                    orbColumn(isCompact: isCompact)
                    Spacer(minLength: 0)

                    if let err = lastError {
                        errorCard(message: err)
                    }

                    bottomControls
                }
                .frame(maxWidth: 560)
                .frame(maxWidth: .infinity)
            }

            // Transient toast banner (Honeydew uses a top-pill snackbar mirror).
            if showToast, let err = lastError {
                VStack {
                    toastBanner(err)
                    Spacer()
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .transition(.move(edge: .top).combined(with: .opacity))
                .zIndex(2)
            }
        }
        .preferredColorScheme(.dark)
        .navigationBarHidden(true)
        .task {
            // Keep the screen awake during a voice session (hands-busy).
            UIApplication.shared.isIdleTimerDisabled = true
            await connect()
        }
        .task {
            // Tick once a second to refresh the duration label.
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                if connectedAt != nil { nowTick &+= 1 }
            }
        }
        .onChange(of: session.isAiSpeaking) { _, speaking in
            isAiSpeaking = speaking
        }
        .onChange(of: session.isWaitingForResponse) { _, waiting in
            isWaitingForResponse = waiting
        }
        .onChange(of: session.state) { _, newState in
            switch newState {
            case .connected:
                isHoldingToTalk = false
                isWaitingForResponse = false
                isAiSpeaking = false
                lastError = nil
                connectedAt = Date()
            case .ended, .idle:
                isHoldingToTalk = false
                isWaitingForResponse = false
                isAiSpeaking = false
                connectedAt = nil
            case .error(let msg):
                isHoldingToTalk = false
                isWaitingForResponse = false
                isAiSpeaking = false
                surfaceError(msg)
            case .requestingSession, .connecting, .ending:
                break
            }
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 1.4).repeatForever(autoreverses: true)) {
                pulsePhase = 1.0
            }
        }
        .onDisappear {
            UIApplication.shared.isIdleTimerDisabled = false
            Task { await session.stop() }
        }
        .sheet(isPresented: $showSettingsSheet) {
            VoiceSettingsSheet(
                selectedVoice: selectedVoice,
                selectedPersonality: selectedPersonality,
                selectedModel: selectedModel,
                guidance: $guidanceText,
                onVoiceChanged: { v in changeVoice(v) },
                onPersonalityChanged: { p in changePersonality(p) },
                onModelChanged: { m in changeModel(m) }
            )
            .presentationDetents([.fraction(0.6), .large])
            .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showLimitSheet) {
            WagerBotVoiceLimitSheet(
                isPro: proAccess.isPro,
                serverMessage: limitMessage,
                onUpgrade: { showPaywall = true }
            )
            .presentationDetents([.medium, .large])
        }
        .sheet(isPresented: $showPaywall) {
            RevenueCatPaywallView(placementId: RevenueCatService.Placement.genericFeature)
        }
        .sensoryFeedback(.impact(weight: .medium), trigger: ptStartCount)
        .sensoryFeedback(.impact(weight: .light), trigger: ptEndCount)
        .sensoryFeedback(.selection, trigger: selectionCount)
    }

    // MARK: - Header (close / duration / settings)

    @ViewBuilder
    private var header: some View {
        HStack {
            Button {
                Task { await hangUp(); dismiss() }
            } label: {
                Image(systemName: "chevron.backward")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 44, height: 44, alignment: .leading)
                    .padding(.leading, 8)
            }
            .accessibilityLabel("Close WagerBot Voice")

            Spacer()

            Text(formattedDuration)
                .font(.system(size: 15, weight: .medium, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(.white.opacity(0.7))

            Spacer()

            Button {
                selectionCount &+= 1
                showSettingsSheet = true
            } label: {
                Image(systemName: "gearshape.fill")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 44, height: 44, alignment: .trailing)
                    .padding(.trailing, 8)
            }
            .accessibilityLabel("Voice settings")
        }
        .padding(.top, 8)
    }

    // MARK: - Status pill + bot title

    private var statusPill: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(statusDotColor)
                .frame(width: 8, height: 8)
            Text(statusText)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.white)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 7)
        .background(Capsule().fill(statusDotColor.opacity(0.14)))
        .overlay(Capsule().stroke(statusDotColor.opacity(0.3), lineWidth: 1))
        .animation(.easeInOut(duration: 0.18), value: statusText)
    }

    private var botHeaderRow: some View {
        HStack(spacing: 10) {
            ZStack {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(Color.appPrimary.opacity(0.18))
                    .frame(width: 36, height: 36)
                Image(systemName: "waveform")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(Color.appPrimary)
            }
            Text("WagerBot Voice")
                .font(.system(size: 26, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
        }
    }

    // MARK: - Orb

    @ViewBuilder
    private func orbColumn(isCompact: Bool) -> some View {
        let orbSize: CGFloat = isCompact ? 200 : 240
        let innerSize: CGFloat = orbSize * 0.82
        let activeGlow = isActive ? pulsePhase : 0.0
        let scale: CGFloat = isActive ? CGFloat(1.0 + pulsePhase * 0.06) : 1.0

        VStack(spacing: 0) {
            ZStack {
                // Soft glow that intensifies while active.
                Circle()
                    .fill(Color.appPrimary.opacity(0.18 * activeGlow + 0.04))
                    .frame(
                        width: orbSize + (5 + 10 * activeGlow) * 2,
                        height: orbSize + (5 + 10 * activeGlow) * 2
                    )
                    .blur(radius: (30 + 30 * activeGlow) / 2.0)

                // Outer ring — brand green, brighter while active.
                Circle()
                    .fill(Color.appPrimary.opacity(0.25 + activeGlow * 0.45))
                    .frame(width: orbSize, height: orbSize)

                // Inner disk — dark surface holding the ChattingRobot avatar.
                Circle()
                    .fill(Color(white: 0.07))
                    .frame(width: innerSize, height: innerSize)
                    .overlay(
                        LottieView(name: "ChattingRobot")
                            .frame(width: innerSize, height: innerSize)
                            .clipShape(Circle())
                    )
            }
            .scaleEffect(scale)
            .padding(.bottom, 16)

            Text(selectedVoice.displayName)
                .font(.system(size: 20, weight: .bold, design: .rounded))
                .foregroundStyle(.white)

            Spacer().frame(height: 4)

            Text("WagerBot Voice")
                .font(AppFont.body)
                .foregroundStyle(.white.opacity(0.6))
        }
    }

    // MARK: - Error card + toast

    private func errorCard(message: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "exclamationmark.circle")
                .font(.system(size: 22, weight: .regular))
                .foregroundStyle(Color.appAccentRed)
            Text(message)
                .font(AppFont.caption)
                .foregroundStyle(Color.appAccentRed)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color.appAccentRed.opacity(0.12))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Color.appAccentRed.opacity(0.3), lineWidth: 1)
        )
        .padding(.horizontal, 22)
        .padding(.bottom, 12)
    }

    private func toastBanner(_ message: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(.white)
            Text(message)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(.white)
                .lineLimit(2)
            Spacer(minLength: 0)
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 14)
        .frame(maxWidth: .infinity)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.appAccentRed.opacity(0.92))
        )
    }

    // MARK: - Bottom controls

    private var bottomControls: some View {
        VStack(spacing: 12) {
            holdToTalkButton
            HStack(spacing: 12) {
                bottomActionButton(
                    icon: "arrow.clockwise",
                    label: "Reconnect",
                    isPrimary: false,
                    action: { Task { await connect() } }
                )
                bottomActionButton(
                    icon: "phone.down.fill",
                    label: "Hang Up",
                    isPrimary: true,
                    action: { Task { await hangUp() } }
                )
            }
        }
        .padding(.horizontal, 22)
        .padding(.bottom, 12)
    }

    private var holdToTalkButton: some View {
        let isDisabled = !isConnected || isConnecting

        let backgroundColor: Color = {
            if isDisabled { return Color.white.opacity(0.12) }
            if isHoldingToTalk { return Color.appPrimary.opacity(0.85) }
            return Color.appPrimary
        }()

        let labelText: String = {
            if isDisabled { return isConnecting ? "Connecting..." : "Disconnected" }
            return isHoldingToTalk ? "Release To Send" : "Press And Hold To Talk"
        }()

        let iconName = isHoldingToTalk ? "mic.fill" : "hand.tap.fill"

        return HStack(spacing: 12) {
            Image(systemName: iconName)
                .font(.system(size: 24, weight: .semibold))
                .foregroundStyle(.white)
            Text(labelText)
                .font(.system(size: 16, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 18)
        .padding(.vertical, 18)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(backgroundColor)
        )
        .shadow(
            color: isDisabled ? .clear : Color.appPrimary.opacity(0.35),
            radius: 8, x: 0, y: 6
        )
        .animation(.easeInOut(duration: 0.18), value: isDisabled)
        .animation(.easeInOut(duration: 0.18), value: isHoldingToTalk)
        // Press-and-hold: LongPress (0s) fires on press, a 0-distance drag's
        // onEnded fires reliably on release (LongPress doesn't signal release).
        .gesture(
            LongPressGesture(minimumDuration: 0)
                .onEnded { _ in
                    guard !isDisabled else { return }
                    startTalking()
                }
        )
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onEnded { _ in
                    guard isHoldingToTalk else { return }
                    stopTalking()
                }
        )
        .accessibilityLabel(labelText)
    }

    private func bottomActionButton(
        icon: String,
        label: String,
        isPrimary: Bool,
        action: @escaping () -> Void
    ) -> some View {
        let bgColor: Color = isPrimary
            ? Color.appAccentRed.opacity(0.12)
            : Color.white.opacity(0.06)
        let borderColor: Color = isPrimary
            ? Color.appAccentRed.opacity(0.35)
            : Color.white.opacity(0.18)
        let tint: Color = isPrimary ? Color.appAccentRed : .white

        return Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(tint)
                Text(label)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(tint)
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(bgColor)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(borderColor, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Actions

    private func connect() async {
        lastError = nil
        connectedAt = nil
        do {
            try await session.start(
                voiceWire: selectedVoice.rawValue,
                rudenessWire: selectedPersonality.rawValue,
                modelWire: selectedModel.rawValue,
                guidance: guidanceWire
            )
        } catch let error as NSError {
            // HTTP 429 from the edge function → present the limit sheet rather
            // than the generic error card (matches Honeydew's limit handling).
            if isLimitError(error) {
                limitMessage = error.localizedDescription
                lastError = nil
                showToast = false
                showLimitSheet = true
            }
            // Any other error is already reflected via `session.state` →
            // `.error`, handled by the onChange above.
        }
    }

    private func changeVoice(_ voice: WagerBotVoice) {
        guard voice != selectedVoice else { return }
        selectionCount &+= 1
        voiceRaw = voice.rawValue
        // Reconnect so the new voice takes effect server-side (the engine
        // tears down the prior session internally).
        Task { await connect() }
    }

    private func changePersonality(_ personality: WagerBotPersonality) {
        guard personality != selectedPersonality else { return }
        selectionCount &+= 1
        personalityRaw = personality.rawValue
        Task { await connect() }
    }

    private func changeModel(_ model: WagerBotModel) {
        guard model != selectedModel else { return }
        selectionCount &+= 1
        modelRaw = model.rawValue
        // Reconnect so the new model takes effect (the session mints a new
        // ephemeral session pinned to this model). Guidance edits do NOT
        // reconnect — they apply on the next connect / Reconnect tap.
        Task { await connect() }
    }

    private func startTalking() {
        guard isConnected, !isConnecting else { return }
        ptStartCount &+= 1
        isHoldingToTalk = true
        isWaitingForResponse = false
        isAiSpeaking = false
        lastError = nil
        Task { await session.startTalking() }
    }

    private func stopTalking() {
        guard isHoldingToTalk else { return }
        ptEndCount &+= 1
        isHoldingToTalk = false
        Task { await session.stopTalking() }
    }

    private func hangUp() async {
        selectionCount &+= 1
        await session.stop()
        connectedAt = nil
    }

    // MARK: - Error helpers

    /// Detect the daily-limit (HTTP 429) failure so we route to the limit
    /// sheet instead of the inline error card.
    private func isLimitError(_ error: NSError) -> Bool {
        if error.code == 429 { return true }
        let msg = error.localizedDescription.lowercased()
        return msg.contains("daily limit") || msg.contains("rate limit") || msg.contains("limit reached")
    }

    private func surfaceError(_ msg: String) {
        lastError = msg
        withAnimation(.appQuick) { showToast = true }
        // Auto-dismiss the toast after a few seconds; the inline card stays.
        Task {
            try? await Task.sleep(nanoseconds: 4_000_000_000)
            withAnimation(.appQuick) { showToast = false }
        }
    }
}

// MARK: - Voice + personality picker sheet

/// Voice + personality + advanced picker. Full parity with Honeydew's
/// `VoiceSettingsSheet`: VOICE, PERSONALITY (with the 3-step spicy confirmation
/// cascade), and ADVANCED (model picker + free-text guidance). The parent owns
/// state mutation for voice/personality/model — tiles call the `onChanged`
/// closures, which persist via `@AppStorage` and reconnect. Guidance binds
/// directly through `@AppStorage` so edits persist as the user types.
private struct VoiceSettingsSheet: View {
    @Environment(\.dismiss) private var dismiss

    let selectedVoice: WagerBotVoice
    let selectedPersonality: WagerBotPersonality
    let selectedModel: WagerBotModel
    @Binding var guidance: String
    let onVoiceChanged: (WagerBotVoice) -> Void
    let onPersonalityChanged: (WagerBotPersonality) -> Void
    /// Fires when the model picker changes. Parent reconnects so the new model
    /// takes effect; guidance changes do NOT reconnect (users edit iteratively).
    let onModelChanged: (WagerBotModel) -> Void

    /// Focus state for the guidance editor so the keyboard can be dismissed.
    @FocusState private var guidanceFocused: Bool

    @State private var selectionTapCount: Int = 0

    /// Three-step spicy confirmation cascade. Each tier is a separate `.alert`
    /// presented sequentially. 0 = inactive, 1..3 = active step. Cancel at any
    /// step aborts and leaves personality on friendly; confirm on step 3
    /// enables spicy + triggers a reconnect (via `onPersonalityChanged`).
    @State private var spicyStep: Int = 0

    private var spicyStep1Binding: Binding<Bool> {
        Binding(
            get: { spicyStep == 1 },
            set: { if !$0 && spicyStep == 1 { spicyStep = 0 } }
        )
    }
    private var spicyStep2Binding: Binding<Bool> {
        Binding(
            get: { spicyStep == 2 },
            set: { if !$0 && spicyStep == 2 { spicyStep = 0 } }
        )
    }
    private var spicyStep3Binding: Binding<Bool> {
        Binding(
            get: { spicyStep == 3 },
            set: { if !$0 && spicyStep == 3 { spicyStep = 0 } }
        )
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Spacer().frame(height: 8)

                HStack {
                    Spacer()
                    Text("Voice Settings")
                        .font(.system(size: 20, weight: .semibold, design: .rounded))
                        .foregroundStyle(Color.appTextPrimary)
                    Spacer()
                }
                .padding(.bottom, 24)

                sectionLabel("VOICE")
                VStack(spacing: 8) {
                    ForEach(WagerBotVoice.allCases, id: \.self) { v in
                        optionTile(
                            label: v.displayName,
                            subtitle: v.subtitle,
                            icon: "waveform.circle.fill",
                            isSelected: selectedVoice == v,
                            action: {
                                selectionTapCount &+= 1
                                // Parent owns state mutation — don't write a
                                // binding here (would race the parent's
                                // `!= selected` guard and skip the reconnect).
                                onVoiceChanged(v)
                                dismiss()
                            }
                        )
                    }
                }
                .padding(.top, 10)
                .padding(.bottom, 24)

                sectionLabel("PERSONALITY")
                VStack(spacing: 8) {
                    optionTile(
                        label: WagerBotPersonality.friendly.label,
                        subtitle: WagerBotPersonality.friendly.subtitle,
                        icon: "face.smiling.inverse",
                        isSelected: selectedPersonality == .friendly,
                        action: {
                            selectionTapCount &+= 1
                            onPersonalityChanged(.friendly)
                            dismiss()
                        }
                    )
                    optionTile(
                        label: WagerBotPersonality.spicy.label,
                        subtitle: WagerBotPersonality.spicy.subtitle,
                        icon: "flame.fill",
                        isSelected: selectedPersonality == .spicy,
                        action: {
                            selectionTapCount &+= 1
                            if selectedPersonality != .spicy {
                                // Kick off the three-step Spicy confirmation
                                // cascade. Cancel at any step aborts and leaves
                                // Spicy un-selected.
                                spicyStep = 1
                            } else {
                                // Already spicy — tapping again is a no-op dismiss.
                                dismiss()
                            }
                        }
                    )
                }
                .padding(.top, 10)
                .padding(.bottom, 24)

                // ---- Advanced section ---------------------------------------
                // Model picker + free-text guidance. Model change reconnects;
                // guidance applies on the next connect (Reconnect button).
                advancedSection

                Spacer(minLength: 16)
            }
            .padding(.horizontal, 24)
            .padding(.top, 12)
            .padding(.bottom, 16)
            .frame(maxWidth: 560, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .center)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(Color.appSurface)
        // ---- Step 1: Subtle warning ---------------------------------------
        .alert("Turn on Spicy Mode?", isPresented: spicyStep1Binding) {
            Button("Never mind", role: .cancel) {
                spicyStep = 0
            }
            Button("I'm curious") {
                spicyStep = 2
            }
        } message: {
            Text("Heads up — Spicy Mode is built for entertainment. WagerBot drops the level-headed analyst act and starts throwing brutally honest hot takes on your bets.")
        }
        // ---- Step 2: Serious warning --------------------------------------
        .alert("Are you sure?", isPresented: spicyStep2Binding) {
            Button("Take me back", role: .cancel) {
                spicyStep = 0
            }
            Button("I can handle it", role: .destructive) {
                spicyStep = 3
            }
        } message: {
            Text("This gets R-rated. WagerBot will roast your picks, talk trash, and use explicit profanity. It's definitely not for kids.")
        }
        // ---- Step 3: Last chance ------------------------------------------
        .alert("Last chance!", isPresented: spicyStep3Binding) {
            Button("Actually, no", role: .cancel) {
                spicyStep = 0
            }
            Button("Turn it on", role: .destructive) {
                // Don't write a `selectedPersonality` binding here — the parent
                // owns the state flip + reconnect. Writing first would race the
                // parent's `!= .spicy` guard and short-circuit the reconnect.
                onPersonalityChanged(.spicy)
                spicyStep = 0
                dismiss()
            }
        } message: {
            Text("Okay, you've been warned. We're turning on the full degenerate — uncensored, unfiltered, and absolutely savage about your slips. No take-backs.")
        }
        .sensoryFeedback(.selection, trigger: selectionTapCount)
    }

    // MARK: - Advanced section

    /// ADVANCED section: model picker + free-text guidance. Model change
    /// reconnects (parent's `onModelChanged`); guidance binds directly to
    /// `@AppStorage` and applies on the next connect.
    @ViewBuilder
    private var advancedSection: some View {
        sectionLabel("ADVANCED")

        // ---- Model picker --------------------------------------------------
        VStack(alignment: .leading, spacing: 8) {
            Text("Model")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
                .padding(.top, 10)

            ForEach(WagerBotModel.allCases, id: \.self) { m in
                optionTile(
                    label: m.displayName,
                    subtitle: m.subtitle,
                    icon: m.icon,
                    isSelected: selectedModel == m,
                    action: {
                        selectionTapCount &+= 1
                        // Guard so re-selecting the current model doesn't
                        // reconnect (parity with voice/personality).
                        guard selectedModel != m else {
                            dismiss()
                            return
                        }
                        onModelChanged(m)
                        dismiss()
                    }
                )
            }
        }
        .padding(.bottom, 16)

        // ---- Guidance editor -----------------------------------------------
        VStack(alignment: .leading, spacing: 8) {
            Text("Custom Guidance")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)

            Text("Extra instructions for WagerBot. Applied on the next connect — tap Reconnect to apply mid-session.")
                .font(.system(size: 12, weight: .regular))
                .foregroundStyle(Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)

            TextEditor(text: $guidance)
                .focused($guidanceFocused)
                .font(.system(size: 14, weight: .regular))
                .foregroundStyle(Color.appTextPrimary)
                .scrollContentBackground(.hidden)
                .frame(minHeight: 96, maxHeight: 160)
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .background(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(Color.appSurfaceElevated)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(Color.appBorder, lineWidth: 1)
                )
                .overlay(alignment: .topLeading) {
                    // TextEditor has no native placeholder — render our own,
                    // hit-testing off so taps fall through to the editor.
                    if guidance.isEmpty {
                        Text("e.g. Focus on NBA unders, talk fast, call me 'champ'.")
                            .font(.system(size: 14, weight: .regular))
                            .foregroundStyle(Color.appTextSecondary.opacity(0.6))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 14)
                            .allowsHitTesting(false)
                    }
                }

            // Char counter — server caps at 1500. We inform, not enforce.
            HStack {
                Spacer()
                Text("\(guidance.count)/1500")
                    .font(.system(size: 11, weight: .regular))
                    .foregroundStyle(guidance.count > 1500
                                     ? Color.appAccentRed
                                     : Color.appTextSecondary)
            }
        }
        .padding(.bottom, 8)
    }

    private func sectionLabel(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 12, weight: .semibold))
            .tracking(0.8)
            .foregroundStyle(Color.appTextSecondary)
    }

    private func optionTile(
        label: String,
        subtitle: String,
        icon: String,
        isSelected: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 14) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(isSelected ? Color.appPrimary : Color.appSurfaceMuted)
                        .frame(width: 40, height: 40)
                    Image(systemName: icon)
                        .font(.system(size: 22, weight: .regular))
                        .foregroundStyle(isSelected ? .white : Color.appTextSecondary)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(label)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Color.appTextPrimary)
                    Text(subtitle)
                        .font(AppFont.caption)
                        .foregroundStyle(Color.appTextSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 24, weight: .regular))
                        .foregroundStyle(Color.appPrimary)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(isSelected ? Color.appPrimary.opacity(0.12) : Color.appSurfaceElevated)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(
                        isSelected ? Color.appPrimary : Color.appBorder,
                        lineWidth: isSelected ? 1.5 : 1.0
                    )
            )
        }
        .buttonStyle(.plain)
    }
}

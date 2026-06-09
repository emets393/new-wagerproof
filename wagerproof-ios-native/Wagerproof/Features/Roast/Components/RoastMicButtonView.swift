import SwiftUI
import WagerproofDesign
import WagerproofStores

/// The circular mic button + the two breathing animations around it.
/// Mirrors `wagerproof-mobile/components/roast/RoastMicButton.tsx`.
///
/// RN composes three layers stacked at the same center:
///   1. An expanding ring that scales 1→2 over 1200ms while fading 0.6→0
///      (continuous radar ping).
///   2. A pulse circle that scales 1→1.3 over 800ms while fading 0.4→0.1
///      (slower breathing glow).
///   3. The mic button itself — 80pt circle, gray when idle, green when
///      recording, dimmer gray with `dots-horizontal` when processing.
///
/// Spec §5 calls for `.symbolEffect(.pulse, options: .repeating)` on the
/// SF Symbol; we layer that on top of the RN-style ring/pulse because
/// `.symbolEffect` alone doesn't carry the same visual weight as the
/// 2x-scale radar ping. The RN choreography is the spec.
struct RoastMicButtonView: View {
    let state: RoastSessionStore.SessionState
    let onTap: () -> Void

    private let buttonSize: CGFloat = 80

    /// Drives the expanding-ring scale + opacity. Animates 0→1 over 1.2s
    /// with `repeatForever` while `isRecording`. We use a single phase value
    /// so the ring scale (1 + phase) and opacity (0.6 * (1 - phase)) stay in
    /// lockstep — exactly what the RN sequence does.
    @State private var ringPhase: CGFloat = 0

    /// Drives the inner pulse glow. Animates 0→1 over 0.8s `autoreverses`.
    /// Scale = 1 + 0.3 * phase, opacity = lerp(0.1, 0.4, phase).
    @State private var pulsePhase: CGFloat = 0

    private var isRecording: Bool { state == .recording }
    private var isProcessing: Bool { state == .processing || state == .responding }

    /// RN button color map:
    ///   recording → green
    ///   processing/responding → muted dark gray
    ///   idle → dark gray
    private var buttonColor: Color {
        if isRecording { return Color.appPrimary }
        if isProcessing { return Color(white: 0.42) }
        return Color(white: 0.22)
    }

    /// RN icon swap: 'microphone' when not processing, 'dots-horizontal'
    /// while processing/responding. SF Symbols equivalent.
    private var iconName: String {
        isProcessing && !isRecording ? "ellipsis" : "mic.fill"
    }

    /// Black-on-green when recording (matches the RN inversion), white otherwise.
    private var iconColor: Color {
        isRecording ? .black : .white
    }

    var body: some View {
        ZStack {
            // ---- Expanding radar ring ---------------------------------------
            // RN: 1200ms scale 1→2, opacity 0.6→0. We animate `ringPhase` 0→1
            // and derive both effects from it.
            Circle()
                .stroke(Color.appPrimary, lineWidth: 2)
                .frame(width: buttonSize, height: buttonSize)
                .scaleEffect(1 + ringPhase)
                .opacity(0.6 * (1 - ringPhase))
                .opacity(isRecording ? 1 : 0)
                .animation(
                    isRecording
                        ? .linear(duration: 1.2).repeatForever(autoreverses: false)
                        : .easeOut(duration: 0.2),
                    value: ringPhase
                )

            // ---- Inner pulse glow -------------------------------------------
            // RN: 800ms autoreverse scale 1→1.3, opacity 0.1↔0.4.
            Circle()
                .fill(Color.appPrimary)
                .frame(width: buttonSize, height: buttonSize)
                .scaleEffect(1 + 0.3 * pulsePhase)
                .opacity(isRecording ? (0.1 + 0.3 * pulsePhase) : 0)
                .animation(
                    isRecording
                        ? .easeInOut(duration: 0.8).repeatForever(autoreverses: true)
                        : .easeOut(duration: 0.2),
                    value: pulsePhase
                )

            // ---- The button itself ------------------------------------------
            Button(action: onTap) {
                Image(systemName: iconName)
                    .font(.system(size: 36, weight: .semibold))
                    .foregroundStyle(iconColor)
                    // `.symbolEffect(.pulse)` adds an extra layer of motion
                    // while recording (per spec §5). Skipped while processing
                    // so the ellipsis doesn't double-bounce against the dots.
                    .symbolEffect(.pulse, options: .repeating, isActive: isRecording)
                    .frame(width: buttonSize, height: buttonSize)
                    .background(
                        Circle().fill(buttonColor)
                    )
            }
            .buttonStyle(.plain)
            .disabled(state == .processing)
            .shadow(color: .black.opacity(0.3), radius: 8, x: 0, y: 4)
            .accessibilityLabel(accessibilityLabel)
            .accessibilityValue(state.statusText)
        }
        .frame(width: buttonSize * 2.5, height: buttonSize * 2.5)
        .onChange(of: isRecording, initial: true) { _, recording in
            // Toggle the targets — SwiftUI's animation modifier picks up the
            // value change and starts the repeating loop. Resetting on stop
            // snaps the ring back to its compact position cleanly.
            if recording {
                ringPhase = 1
                pulsePhase = 1
            } else {
                ringPhase = 0
                pulsePhase = 0
            }
        }
    }

    private var accessibilityLabel: String {
        switch state {
        case .idle:       return "Start recording"
        case .recording:  return "Stop recording"
        case .processing: return "Thinking, please wait"
        case .responding: return "Interrupt and start a new turn"
        }
    }
}

#if DEBUG
#Preview("Mic Button States") {
    HStack(spacing: 20) {
        RoastMicButtonView(state: .idle, onTap: {})
        RoastMicButtonView(state: .recording, onTap: {})
        RoastMicButtonView(state: .processing, onTap: {})
        RoastMicButtonView(state: .responding, onTap: {})
    }
    .padding()
    .background(Color.black)
    .preferredColorScheme(.dark)
}
#endif

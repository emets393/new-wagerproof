import SwiftUI
import WagerproofDesign

/// Native port of `components/agents/ThinkingAnimation.tsx`. Renders the
/// terminal-style "agent is thinking" panel with typed-out steps and a
/// blinking cursor.
///
/// We use `TimelineView(.animation)` to drive the cursor blink and a simple
/// `Timer` for the typing cadence — both are cheap on a SwiftUI canvas and
/// don't require explicit animation orchestration on the call site.
struct ThinkingAnimation: View {
    enum Variant {
        case loadingAgent
        case generatingPicks
    }

    let variant: Variant
    var customSteps: [String]? = nil

    @State private var historyLines: [String] = []
    @State private var activeLine: String = ""
    @State private var activeIndex: Int = 0
    @State private var typeTask: Task<Void, Never>? = nil

    private static let charIntervalNs: UInt64 = 18_000_000
    private static let initialDelayNs: UInt64 = 250_000_000
    private static let linePauseNs: UInt64 = 350_000_000

    private static let loadingSteps = [
        "Syncing agent profile...",
        "Loading performance snapshot...",
        "Preparing pick workspace..."
    ]

    private static let generatingSteps = [
        "Connection established. Running pick engine...",
        "Checking today's slate and active markets...",
        "Applying your risk profile and bet preferences...",
        "Scoring model edges across candidate games...",
        "Filtering for confidence and value thresholds...",
        "Finalizing picks and writing results..."
    ]

    private var resolvedSteps: [String] {
        if let s = customSteps, !s.isEmpty { return s }
        return variant == .loadingAgent ? Self.loadingSteps : Self.generatingSteps
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("terminal://agent-thinking")
                .font(.system(size: 12, design: .monospaced))
                .foregroundStyle(Color(hex: 0x9FB3AD))

            ForEach(Array(historyLines.enumerated()), id: \.offset) { _, line in
                terminalRow(text: line, isActive: false)
            }
            terminalRow(text: activeLine, isActive: true)

            Text("Step \(min(activeIndex + 1, resolvedSteps.count)) of \(resolvedSteps.count)")
                .font(.system(size: 11, design: .monospaced))
                .foregroundStyle(Color(hex: 0x9FB3AD))
                .padding(.top, 4)
        }
        .padding(14)
        .frame(maxWidth: .infinity, minHeight: 170, alignment: .topLeading)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color(hex: 0x070A0A))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(Color(hex: 0x00E676).opacity(0.25), lineWidth: 1)
        )
        .onAppear { startTyping() }
        .onDisappear { typeTask?.cancel() }
        .onChange(of: variant) { _, _ in startTyping() }
    }

    @ViewBuilder
    private func terminalRow(text: String, isActive: Bool) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text("›")
                .font(.system(size: 14, weight: .bold, design: .monospaced))
                .foregroundStyle(Color(hex: 0x00E676))
            // Use phaseAnimator to drive a blinking cursor on the active row.
            if isActive {
                ActiveTerminalLine(text: text)
            } else {
                Text(text)
                    .font(.system(size: 14, design: .monospaced))
                    .foregroundStyle(Color(hex: 0x8CA89B))
            }
        }
    }

    private func startTyping() {
        typeTask?.cancel()
        historyLines = []
        activeLine = ""
        activeIndex = 0
        typeTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: Self.initialDelayNs)
            for (idx, step) in resolvedSteps.enumerated() {
                if Task.isCancelled { return }
                activeIndex = idx
                activeLine = ""
                for char in step {
                    if Task.isCancelled { return }
                    activeLine.append(char)
                    try? await Task.sleep(nanoseconds: Self.charIntervalNs)
                }
                if idx < resolvedSteps.count - 1 {
                    historyLines.append(step)
                    try? await Task.sleep(nanoseconds: Self.linePauseNs)
                }
            }
        }
    }
}

/// Subview so the cursor phase animator only redraws the active line.
private struct ActiveTerminalLine: View {
    let text: String

    var body: some View {
        TimelineView(.periodic(from: .now, by: 0.5)) { context in
            let secondsHalf = Int(context.date.timeIntervalSinceReferenceDate * 2)
            let cursor = secondsHalf.isMultiple(of: 2) ? " █" : "  "
            Text(text + cursor)
                .font(.system(size: 14, design: .monospaced))
                .foregroundStyle(Color(hex: 0x00E676))
        }
    }
}

#Preview {
    VStack(spacing: 24) {
        ThinkingAnimation(variant: .loadingAgent)
        ThinkingAnimation(variant: .generatingPicks)
    }
    .padding()
    .background(Color.appSurface)
}

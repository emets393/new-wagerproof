import SwiftUI
import WagerproofDesign

/// Cinematic "preparing your agent" interstitial. Ports
/// `components/agents/creation/AgentCreationGenerationIntro.tsx`.
///
/// RN shows two Lottie scenes (GalaxyPlanet + OrbitPlanet) with status lines
/// scrolling above. We approximate with SwiftUI's `.symbolEffect(.pulse)`
/// for the central icon and a cycling status text view.
///
/// FIDELITY-WAIVER #080: Lottie scenes dropped — SwiftUI symbol pulse stands
/// in for the planet animations. The cycling status lines + two-stage layout
/// match.
struct AgentCreationGenerationIntroView: View {
    /// Called once the two-stage animation finishes (~6s total).
    let onComplete: () -> Void

    private let stage1Lines = [
        "Hacking Vegas computers...",
        "Mining sharp-market signals...",
        "Decoding suspicious line movement..."
    ]
    private let stage2Lines = [
        "Calibrating confidence engines...",
        "Simulating 10,000 bet outcomes...",
        "Assembling your agent brain..."
    ]

    @State private var stage: Int = 1
    @State private var lineIndex: Int = 0
    @State private var lineHistory: [String] = []
    @State private var scale: CGFloat = 0.7

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            VStack(spacing: 8) {
                ForEach(Array(lineHistory.enumerated()), id: \.offset) { idx, line in
                    Text(line)
                        .font(.system(size: 16, weight: .bold))
                        .tracking(0.15)
                        .foregroundStyle(.white.opacity(idx == 0 ? 1.0 : max(0.35, 0.85 - Double(idx) * 0.22)))
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .center)
            .padding(.horizontal, 24)
            .padding(.top, 104)
            .frame(maxHeight: .infinity, alignment: .top)

            Image(systemName: stage == 1 ? "globe.americas" : "circle.hexagongrid.fill")
                .font(.system(size: 120))
                .foregroundStyle(Color(hex: 0x00E676))
                .symbolEffect(.pulse, options: .repeating)
                .scaleEffect(scale)
                .animation(.easeInOut(duration: 0.45), value: scale)
        }
        .task {
            await runChoreography()
        }
    }

    private func runChoreography() async {
        // Stage 1: scale in, cycle lines for ~3s, scale out.
        withAnimation { scale = 1.0 }
        await cycleLines(stage1Lines, totalSeconds: 3.0)
        withAnimation { scale = 0.55 }
        try? await Task.sleep(nanoseconds: 220_000_000)

        // Stage 2: switch icon, scale in, cycle, scale out.
        stage = 2
        scale = 0.7
        withAnimation { scale = 1.0 }
        await cycleLines(stage2Lines, totalSeconds: 3.0)
        withAnimation { scale = 0.55 }
        try? await Task.sleep(nanoseconds: 220_000_000)
        onComplete()
    }

    private func cycleLines(_ lines: [String], totalSeconds: Double) async {
        // Match RN's 900ms cadence between status updates.
        let interval: UInt64 = 900_000_000
        let count = Int(totalSeconds * 1_000 / 900)
        for _ in 0..<count {
            let next = lines[lineIndex % lines.count]
            lineHistory.insert(next, at: 0)
            if lineHistory.count > 4 { lineHistory.removeLast() }
            lineIndex += 1
            try? await Task.sleep(nanoseconds: interval)
        }
    }
}

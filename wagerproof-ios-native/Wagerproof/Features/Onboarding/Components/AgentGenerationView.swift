// AgentGenerationView.swift
//
// Step 20: cinematic agent-generation animation. Port of
// `components/onboarding/steps/StepAgentGeneration.tsx`. The RN version
// plays three Lotties in sequence — RobotAnalyzing → RobotCoding →
// ChattingRobot — while status lines cycle through hacker-y copy. The
// native port now ships those same three JSONs from
// `WagerproofDesign/Resources/Lotties/` and drives them via `LottieView`,
// dropping the SF Symbol pulse placeholder.
//
// Total runtime ≈ 6 seconds (matches RN's three ~2s stages).

import SwiftUI
import WagerproofDesign
import WagerproofStores

struct AgentGenerationView: View {
    @Environment(OnboardingStore.self) private var store

    @State private var stage: Stage = .analyzing
    @State private var visibleLines: [String] = []
    @State private var lineIndex: Int = 0
    @State private var didAdvance = false

    /// Three Lotties cycle in order. Indexing `stage.rawValue` selects
    /// which JSON `LottieView` plays.
    private enum Stage: Int, CaseIterable {
        case analyzing = 0  // RobotAnalyzing.json
        case coding = 1     // RobotCoding.json
        case chatting = 2   // ChattingRobot.json

        var lottieName: String {
            switch self {
            case .analyzing: return "RobotAnalyzing"
            case .coding: return "RobotCoding"
            case .chatting: return "ChattingRobot"
            }
        }

        var lines: [String] {
            switch self {
            case .analyzing:
                return [
                    "Hacking Vegas computers...",
                    "Mining sharp-market signals...",
                    "Decoding suspicious line movement..."
                ]
            case .coding:
                return [
                    "Calibrating confidence engines...",
                    "Simulating 10,000 bet outcomes...",
                    "Wiring up your agent brain..."
                ]
            case .chatting:
                return [
                    "Teaching it how to argue picks...",
                    "Loading the trash-talk module...",
                    "Almost ready to cook..."
                ]
            }
        }
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            VStack(spacing: 8) {
                Spacer().frame(height: 80)
                ForEach(visibleLines.indices, id: \.self) { i in
                    Text(visibleLines[i])
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(.white)
                        .opacity(opacityFor(rowIndex: i))
                        .transition(.asymmetric(insertion: .move(edge: .top).combined(with: .opacity), removal: .opacity))
                        .lineLimit(1)
                }
                Spacer()
            }
            .padding(.horizontal, 24)

            // Lottie sequence — `.id(stage)` forces SwiftUI to tear down
            // and rebuild the LottieView when the stage flips, which is
            // what kicks off a fresh playback of the next JSON.
            LottieView(name: stage.lottieName)
                .id(stage)
                .frame(width: 280, height: 280)
                .transition(.opacity)
        }
        .animation(.easeInOut(duration: 0.4), value: stage)
        .task { await runSequence() }
    }

    private func opacityFor(rowIndex: Int) -> Double {
        // Newest (index 0 in our reversed list) is brightest; older ones fade.
        let total = visibleLines.count
        let distance = total - rowIndex - 1
        return max(0.35, 1.0 - Double(distance) * 0.22)
    }

    private func runSequence() async {
        // Status-line cycler — independent of stage. Updates every 900ms
        // and reads from the current stage's line list so copy stays in
        // sync with the Lottie playing on screen.
        Task {
            while !didAdvance {
                try? await Task.sleep(nanoseconds: 900_000_000)
                guard !didAdvance else { return }
                let lines = stage.lines
                let line = lines[lineIndex % lines.count]
                lineIndex &+= 1
                await MainActor.run {
                    var next = [line] + visibleLines
                    if next.count > 4 { next = Array(next.prefix(4)) }
                    withAnimation(.easeInOut(duration: 0.28)) {
                        visibleLines = next
                    }
                }
            }
        }

        // Stage 1: RobotAnalyzing for 2s.
        try? await Task.sleep(nanoseconds: 2_000_000_000)
        await MainActor.run {
            lineIndex = 0  // reset so the new stage's lines show up first
            stage = .coding
        }
        // Stage 2: RobotCoding for 2s.
        try? await Task.sleep(nanoseconds: 2_000_000_000)
        await MainActor.run {
            lineIndex = 0
            stage = .chatting
        }
        // Stage 3: ChattingRobot for 2s, then advance.
        try? await Task.sleep(nanoseconds: 2_000_000_000)
        await MainActor.run {
            didAdvance = true
            store.advance()
        }
    }
}

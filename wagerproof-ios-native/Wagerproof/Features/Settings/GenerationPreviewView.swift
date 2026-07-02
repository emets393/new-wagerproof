#if DEBUG
import SwiftUI
import WagerproofDesign
import WagerproofServices

/// DEBUG-only visual harness for the Today's Picks generation card — the whole
/// research → polling morph plus the fanned `ToolActivityStack` — driven by
/// manual controls (or an auto-play sequence) so the animation can be reviewed
/// without kicking off a real Trigger.dev run. Reached from Secret Settings →
/// UI Previews. See AgentGenerationGlyphLoader.swift for the card itself.
struct GenerationPreviewView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var isGenerating = false
    @State private var toolCalls = 0
    @State private var picks = 0
    @State private var autoPlaying = false
    @State private var accent = Color(hex: 0x6366F1)
    @State private var playTask: Task<Void, Never>?

    /// Matches the engine default so the loading bar fills realistically.
    private let maxTurns = 8

    private let accents: [Color] = [
        Color(hex: 0x6366F1), Color(hex: 0xF59E0B),
        Color(hex: 0x22C55E), Color(hex: 0xEC4899), Color(hex: 0x0EA5E9)
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    // The whole component the user reviews — idle when not polling,
                    // morphing into the live fan when isGenerating flips on.
                    AgentGenerationCard(
                        spriteIndex: 2,
                        accent: accent,
                        state: isGenerating ? previewStatus : nil,
                        isGenerating: isGenerating,
                        canGenerate: true,
                        lockedLabel: "Daily limit reached",
                        onGenerate: { startAutoPlay() }
                    )

                    // Isolated fan so the stacking UI can be tuned on its own,
                    // over the card's near-black surface.
                    VStack(alignment: .leading, spacing: 12) {
                        Text("TOOL ACTIVITY STACK")
                            .font(.system(size: 11, weight: .heavy))
                            .tracking(1)
                            .foregroundStyle(Color.appTextSecondary)
                        ToolActivityStack(count: toolCalls, accent: accent)
                    }
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: 20).fill(Color.black))
                    .overlay(RoundedRectangle(cornerRadius: 20).strokeBorder(.white.opacity(0.06)))

                    controls
                }
                .padding(16)
            }
            .background(Color(hex: 0x0B1011).ignoresSafeArea())
            .navigationTitle("Generation Preview")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .tint(Color.appTextPrimary)
                }
            }
            .preferredColorScheme(.dark)
        }
        .onDisappear { playTask?.cancel() }
    }

    // MARK: - Controls

    private var controls: some View {
        VStack(alignment: .leading, spacing: 16) {
            Toggle("Polling (live run)", isOn: $isGenerating)
                .tint(accent)

            stepperRow("Tool calls", value: $toolCalls, range: 0...20)
            stepperRow("Picks found", value: $picks, range: 0...12)

            HStack(spacing: 12) {
                Button(autoPlaying ? "Stop" : "Auto-play run") {
                    autoPlaying ? stopAutoPlay() : startAutoPlay()
                }
                .buttonStyle(.borderedProminent)
                .tint(accent)

                Button("Reset") { reset() }
                    .buttonStyle(.bordered)
                    .tint(Color.appTextSecondary)
            }

            // Accent swatches so depth/coloring can be sanity-checked per brand tint.
            HStack(spacing: 12) {
                ForEach(Array(accents.enumerated()), id: \.offset) { _, c in
                    Circle()
                        .fill(c)
                        .frame(width: 28, height: 28)
                        .overlay(Circle().strokeBorder(.white.opacity(accent == c ? 0.9 : 0), lineWidth: 2))
                        .onTapGesture { accent = c }
                }
            }
        }
        .foregroundStyle(Color.appTextPrimary)
    }

    private func stepperRow(_ title: String, value: Binding<Int>, range: ClosedRange<Int>) -> some View {
        Stepper(value: value, in: range) {
            HStack {
                Text(title)
                Spacer()
                Text("\(value.wrappedValue)")
                    .monospacedDigit()
                    .foregroundStyle(accent)
            }
        }
    }

    // MARK: - Auto-play

    /// Deals a ticket every ~0.7s into a full slate, landing a few picks near the
    /// end — a compressed stand-in for a real run so the whole morph + fan build
    /// plays through on tap.
    private func startAutoPlay() {
        reset()
        isGenerating = true
        autoPlaying = true
        playTask = Task { @MainActor in
            for step in 1...8 {
                try? await Task.sleep(nanoseconds: 700_000_000)
                if Task.isCancelled { return }
                toolCalls = step
                if step >= 5 { picks = step - 4 }
            }
            autoPlaying = false
        }
    }

    private func stopAutoPlay() {
        playTask?.cancel()
        autoPlaying = false
    }

    private func reset() {
        playTask?.cancel()
        autoPlaying = false
        toolCalls = 0
        picks = 0
    }

    // MARK: - Simulated run metadata

    private var previewStatus: TriggerV3RunStatus? {
        let label = Self.toolLabels[min(toolCalls, Self.toolLabels.count - 1)]
        return Self.makeStatus(
            toolCalls: toolCalls,
            picks: picks,
            turn: min(toolCalls, maxTurns),
            maxTurns: maxTurns,
            tool: toolCalls > 0 ? label.0 : nil,
            toolDetail: label.1
        )
    }

    private static let toolLabels: [(String, String?)] = [
        ("Reading the slate", nil),
        ("Scanning the lines", "MLB · 7 games"),
        ("Pulling model odds", "spread + total"),
        ("Checking the public", "money %"),
        ("Pricing the value", "edge vs market"),
        ("Cross-referencing", "Polymarket"),
        ("Stress-testing picks", nil),
        ("Locking it in", nil)
    ]

    /// The public `TriggerV3RunStatus` only decodes from JSON (no memberwise init),
    /// so we build the fake via a JSON round-trip — keeps the preview independent
    /// of the live types' internals.
    private static func makeStatus(
        toolCalls: Int,
        picks: Int,
        turn: Int,
        maxTurns: Int,
        tool: String?,
        toolDetail: String?
    ) -> TriggerV3RunStatus? {
        var meta: [String: Any] = [
            "turn": turn,
            "maxTurns": maxTurns,
            "toolCalls": toolCalls,
            "picksAccepted": picks
        ]
        if let tool { meta["currentTool"] = tool }
        if let toolDetail { meta["currentToolDetail"] = toolDetail }
        let root: [String: Any] = ["id": "preview", "status": "EXECUTING", "metadata": meta]
        guard let data = try? JSONSerialization.data(withJSONObject: root) else { return nil }
        return try? JSONDecoder().decode(TriggerV3RunStatus.self, from: data)
    }
}

#Preview {
    GenerationPreviewView()
}
#endif

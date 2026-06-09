import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Native port of `components/agents/PrinterSlipAnimation.tsx`. A full-screen
/// celebratory animation that "prints" a betting slip with the agent's picks
/// after a fresh generation run.
///
/// The RN component drives a 5s reveal + 3D flip with Reanimated; we approximate
/// the same beats with SwiftUI's built-in transitions and `matchedGeometryEffect`.
/// The pixel-art world map background is dropped — that's purely decorative and
/// would add ~200 LOC for an animation that only runs once per generation.
struct PrinterSlipAnimation: View {
    let visible: Bool
    let picks: [AgentPick]
    let agentName: String
    let agentEmoji: String
    /// Stable pixel-office character index for the agent (see `AgentSpriteIndex`).
    let spriteIndex: Int
    let agentColor: Color
    let sports: [String]
    let onComplete: () -> Void

    @State private var revealOffset: CGFloat = -700
    @State private var flipDegrees: Double = 0
    @State private var phase: Phase = .printing
    @Namespace private var slipNamespace

    private enum Phase {
        case printing
        case showingFront
        case flipping
        case showingBack
        case dismissing
    }

    var body: some View {
        if visible {
            ZStack {
                Color.black.opacity(0.7).ignoresSafeArea()

                slipCard
                    .offset(y: revealOffset)
                    .rotation3DEffect(.degrees(flipDegrees), axis: (x: 0, y: 1, z: 0))
                    .transition(.opacity)
            }
            .onAppear { runSequence() }
        }
    }

    @ViewBuilder
    private var slipCard: some View {
        ZStack {
            if phase == .showingBack || phase == .dismissing {
                backFace
                    .rotation3DEffect(.degrees(180), axis: (x: 0, y: 1, z: 0))
            } else {
                frontFace
            }
        }
        .frame(width: 320, height: 460)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color(hex: 0x12161B))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(Color.white.opacity(0.1), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.4), radius: 16, x: 0, y: 8)
    }

    private var frontFace: some View {
        VStack(spacing: 20) {
            crimpRow
            Spacer(minLength: 0)
            PixelSpriteAvatar(spriteIndex: spriteIndex)
                .frame(width: 64, height: 72)
            Text(agentName)
                .font(.system(size: 28, weight: .black))
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
            Text("AI PICKS PACK")
                .font(.system(size: 10, weight: .heavy, design: .monospaced))
                .tracking(4)
                .foregroundStyle(.white.opacity(0.4))
            Spacer(minLength: 0)
            HStack {
                infoCell(label: "Picks", value: "\(picks.count)", tint: agentColor)
                Spacer()
                infoCell(label: "Sports", value: sports.map { $0.uppercased() }.joined(separator: " · "))
                Spacer()
                infoCell(label: "Date", value: Self.todayString, alignment: .trailing)
            }
            .padding(.horizontal, 8)
            crimpRow
        }
        .padding(20)
    }

    private var backFace: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Text(agentEmoji).font(.system(size: 24))
                Text("\(agentName)'s Picks")
                    .font(.system(size: 18, weight: .heavy))
                    .foregroundStyle(.white)
            }
            Rectangle().fill(Color.white.opacity(0.12)).frame(height: 1)

            ForEach(Array(picks.prefix(5))) { pick in
                pickRow(pick)
            }
            if picks.count > 5 {
                Text("+\(picks.count - 5) more picks")
                    .font(.system(size: 12))
                    .foregroundStyle(.white.opacity(0.4))
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.top, 8)
            }
            Spacer(minLength: 0)
        }
        .padding(20)
    }

    private func pickRow(_ pick: AgentPick) -> some View {
        HStack(alignment: .top, spacing: 8) {
            VStack(alignment: .leading, spacing: 2) {
                Text(pick.sport.rawValue.uppercased())
                    .font(.system(size: 9, weight: .heavy))
                    .tracking(1.5)
                    .foregroundStyle(.white.opacity(0.4))
                Text(pick.matchup)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(pick.betType.uppercased())
                    .font(.system(size: 9, weight: .heavy))
                    .tracking(1)
                    .foregroundStyle(Color(hex: 0x00E676))
                Text(pick.pickSelection)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                if let odds = pick.odds {
                    Text(odds)
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(.white.opacity(0.6))
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 9)
        .background(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(Color.white.opacity(0.05))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .strokeBorder(Color.white.opacity(0.08), lineWidth: 1)
        )
    }

    private var crimpRow: some View {
        HStack(spacing: 4) {
            Circle().fill(Color.black.opacity(0.9)).frame(width: 14, height: 14)
            Rectangle().fill(Color.white.opacity(0.15)).frame(height: 1)
            Circle().fill(Color.black.opacity(0.9)).frame(width: 14, height: 14)
        }
        .padding(.horizontal, -8)
    }

    private func infoCell(
        label: String,
        value: String,
        tint: Color = .white,
        alignment: HorizontalAlignment = .leading
    ) -> some View {
        VStack(alignment: alignment, spacing: 3) {
            Text(label)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.white.opacity(0.4))
            Text(value)
                .font(.system(size: 14, weight: .heavy, design: .monospaced))
                .foregroundStyle(tint)
        }
    }

    // MARK: - Sequencing

    private func runSequence() {
        revealOffset = -700
        phase = .printing
        withAnimation(.easeOut(duration: 0.6)) {
            revealOffset = 0
        }
        // Show front for ~2s, then flip.
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            phase = .showingFront
            try? await Task.sleep(nanoseconds: 500_000_000)
            withAnimation(.easeInOut(duration: 0.8)) {
                phase = .flipping
                flipDegrees = 180
            }
            try? await Task.sleep(nanoseconds: 900_000_000)
            phase = .showingBack
            try? await Task.sleep(nanoseconds: 2_500_000_000)
            withAnimation(.easeIn(duration: 0.4)) {
                phase = .dismissing
                revealOffset = -700
            }
            try? await Task.sleep(nanoseconds: 500_000_000)
            onComplete()
        }
    }

    private static var todayString: String {
        let f = DateFormatter()
        f.dateFormat = "yyyy/MM/dd"
        return f.string(from: Date())
    }
}

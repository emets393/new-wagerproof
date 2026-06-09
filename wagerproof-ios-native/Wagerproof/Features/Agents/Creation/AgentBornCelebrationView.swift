import SwiftUI
import WagerproofDesign
import WagerproofModels

/// "Agent Created" celebration shown after the create-agent network call
/// succeeds. Ports `components/agents/creation/AgentBornCreationCelebration.tsx`.
///
/// RN uses three Lotties (WaveLines, FullscreenGreen, confetti). We approximate
/// with a brand-color flash + symbol bounce. The agent card matches the RN
/// summary card (avatar + name + sport badges + autopilot pill).
///
/// FIDELITY-WAIVER #081: Lottie confetti + reveal animations replaced with a
/// brand-color flash + SwiftUI `.symbolEffect(.bounce)`. The wave/confetti
/// motion polish is dropped; the layout, copy, and timing stay.
struct AgentBornCelebrationView: View {
    let agent: Agent
    let onContinue: () -> Void

    @State private var revealComplete: Bool = false
    @State private var contentOpacity: Double = 0
    @State private var sparkleTrigger: Int = 0

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            LinearGradient(
                colors: [Color(hex: 0x00E676).opacity(0.18), Color.black.opacity(0)],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            if !revealComplete {
                Color(hex: 0x00E676).ignoresSafeArea()
                    .transition(.opacity)
            }

            VStack(spacing: 24) {
                HStack(spacing: 8) {
                    Image(systemName: "sparkles")
                        .font(.system(size: 20))
                        .foregroundStyle(Color(hex: 0x00E676))
                        .symbolEffect(.bounce, value: sparkleTrigger)
                    Text("Agent Created")
                        .font(.system(size: 30, weight: .heavy))
                        .foregroundStyle(.white)
                }

                Text(agent.isActive
                     ? "Your strategy is live and ready for picks."
                     : "Your agent starts in manual mode until a live auto slot opens up.")
                    .font(.system(size: 15))
                    .foregroundStyle(.white.opacity(0.8))
                    .multilineTextAlignment(.center)

                agentCard
                    .padding(.horizontal, 24)

                Button(action: onContinue) {
                    Text("View Agent")
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(.black)
                        .frame(maxWidth: .infinity, minHeight: 48)
                        .background(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .fill(Color(hex: 0x00E676))
                        )
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 24)
                .disabled(!revealComplete)
            }
            .frame(maxWidth: 420)
            .opacity(contentOpacity)
        }
        .task {
            // 1.4s green flood reveal, then dissolve and fade content in.
            try? await Task.sleep(nanoseconds: 1_400_000_000)
            withAnimation(.easeInOut(duration: 0.5)) { revealComplete = true }
            withAnimation(.easeInOut(duration: 0.65).delay(0.1)) { contentOpacity = 1 }
            sparkleTrigger += 1
        }
    }

    private var agentCard: some View {
        let primary = AgentColorPalette.primary(for: agent.avatarColor)
        return HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(LinearGradient(
                        colors: AgentColorPalette.avatarGradient(for: agent.avatarColor),
                        startPoint: .topLeading, endPoint: .bottomTrailing))
                PixelSpriteAvatar(spriteIndex: agent.spriteIndex)
                    .padding(4)
            }
            .frame(width: 58, height: 58)

            VStack(alignment: .leading, spacing: 8) {
                Text(agent.name.isEmpty ? "Your Agent" : agent.name)
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)

                HStack(spacing: 6) {
                    ForEach(Array(agent.preferredSports.prefix(3)), id: \.self) { sport in
                        HStack(spacing: 4) {
                            Image(systemName: sport.sfSymbol)
                                .font(.system(size: 12))
                            Text(sport.rawValue.uppercased())
                                .font(.system(size: 11, weight: .semibold))
                        }
                        .foregroundStyle(.white.opacity(0.7))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(
                            RoundedRectangle(cornerRadius: 8, style: .continuous)
                                .fill(.white.opacity(0.08))
                        )
                    }
                }

                HStack(spacing: 6) {
                    Toggle("", isOn: .constant(agent.isActive))
                        .labelsHidden()
                        .tint(Color(hex: 0x10B981))
                        .disabled(true)
                        .scaleEffect(0.85)

                    Text(agent.isActive ? "AUTOPILOT ON" : "MANUAL MODE")
                        .font(.system(size: 11, weight: .bold))
                        .tracking(0.4)
                        .foregroundStyle(agent.isActive ? Color(hex: 0x10B981) : Color(hex: 0xFBBF24))
                }
            }
            Spacer(minLength: 0)
        }
        .padding(16)
        .background(
            ZStack {
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(Color(hex: 0x1A1A1A))
                VStack {
                    LinearGradient(
                        colors: [primary, primary.opacity(0.6)],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    .frame(height: 4)
                    Spacer()
                }
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            }
        )
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .strokeBorder(Color.white.opacity(0.12), lineWidth: 1)
        )
    }
}

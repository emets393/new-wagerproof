import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Native port of `components/agents/AgentCard.tsx`. A single-column card
/// variant used by the AgentTimelineSection header in RN. We don't render the
/// timeline section in B13 (it lands in B14 with pick generation), but the
/// card itself is a primitive other surfaces may consume — e.g. the inactive
/// hub variants or any future Settings-driven agent list.
struct AgentCard: View {
    let agent: AgentWithPerformance
    var onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 0) {
                GlowAccentBar(color: agent.agent.avatarColor)

                VStack(alignment: .leading, spacing: 16) {
                    HStack(alignment: .center, spacing: 12) {
                        avatar
                        nameAndSports
                        Spacer(minLength: 0)
                        if agent.agent.isActive {
                            Circle()
                                .fill(Color(hex: 0x10B981))
                                .frame(width: 10, height: 10)
                        }
                    }

                    Divider().background(Color.appBorder.opacity(0.5))

                    HStack {
                        statCell(label: "Record", value: agent.performance?.recordLabel ?? "0-0", color: .appTextPrimary)
                        statCell(
                            label: "Net Units",
                            value: agent.performance?.netUnitsLabel ?? "+0.00u",
                            color: (agent.performance?.netUnits ?? 0) >= 0 ? .appWin : .appLoss
                        )
                        statCell(
                            label: "Streak",
                            value: agent.performance?.currentStreakLabel ?? "-",
                            color: streakColor
                        )
                    }
                }
                .padding(16)
            }
            .background(Color.appSurfaceElevated)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(Color.appBorder.opacity(0.5), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var avatar: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(LinearGradient(
                    colors: AgentColorPalette.avatarGradient(for: agent.agent.avatarColor),
                    startPoint: .topLeading, endPoint: .bottomTrailing))
            PixelSpriteAvatar(spriteIndex: agent.agent.spriteIndex)
                .padding(3)
        }
        .frame(width: 50, height: 50)
    }

    private var nameAndSports: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(agent.agent.name)
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)
                .lineLimit(1)

            HStack(spacing: 4) {
                ForEach(agent.agent.preferredSports, id: \.self) { sport in
                    Text(sport.label)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(Color.appTextSecondary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(
                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                .fill(Color.appBorder.opacity(0.4))
                        )
                }
            }
        }
    }

    private var streakColor: Color {
        let s = agent.performance?.currentStreak ?? 0
        if s > 0 { return .appWin }
        if s < 0 { return .appLoss }
        return .appTextSecondary
    }

    private func statCell(label: String, value: String, color: Color) -> some View {
        VStack(spacing: 4) {
            Text(label.uppercased())
                .font(.system(size: 11, weight: .medium))
                .tracking(0.5)
                .foregroundStyle(Color.appTextSecondary)
            Text(value)
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(color)
        }
        .frame(maxWidth: .infinity)
    }
}

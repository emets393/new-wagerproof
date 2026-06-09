import SwiftUI
import WagerproofDesign

/// Native port of `components/agents/AgentOverlapFooter.tsx`. Renders the
/// "N other agents made this pick" footer on `AgentPickItem` — a stacked
/// row of mini-avatars + a count label.
///
/// Overlap data itself comes from the `get_agent_pick_overlap_batch` RPC,
/// hydrated into `AgentPick` by `AgentPicksService.enrichPicksWithOverlap`
/// (B14 will wire that in). For B13 we only need the renderer ready.
struct AgentOverlapFooter: View {
    let agents: [OverlapSummary]
    let totalCount: Int

    /// Tiny mirror of RN `OverlapAgentSummary` — kept local to the component
    /// so the model layer doesn't need to expose it before B14.
    struct OverlapSummary: Hashable, Sendable {
        let avatarId: String
        let name: String
        let avatarEmoji: String
        let avatarColor: String
    }

    private let maxVisible = 5

    var body: some View {
        if totalCount == 0 {
            EmptyView()
        } else {
            HStack(spacing: 6) {
                avatarStack
                Text(label)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(Color.appTextSecondary)
                    .lineLimit(1)
            }
            .padding(.top, 6)
            .overlay(alignment: .top) {
                Rectangle()
                    .fill(Color.appBorder.opacity(0.3))
                    .frame(height: 1)
            }
        }
    }

    private var label: String {
        totalCount == 1 ? "1 other agent made this pick" : "\(totalCount) other agents made this pick"
    }

    private var avatarStack: some View {
        let visible = Array(agents.prefix(maxVisible))
        let overflow = totalCount - maxVisible
        return HStack(spacing: -8) {
            ForEach(Array(visible.enumerated()), id: \.element) { i, agent in
                avatarCircle(for: agent)
                    .zIndex(Double(maxVisible - i))
            }
            if overflow > 0 {
                Text("+\(overflow)")
                    .font(.system(size: 8, weight: .bold))
                    .foregroundStyle(Color.appTextSecondary)
                    .frame(width: 22, height: 22)
                    .background(Circle().fill(Color.appBorder.opacity(0.5)))
                    .overlay(Circle().stroke(Color.appSurfaceElevated, lineWidth: 2))
                    .zIndex(0)
            }
        }
    }

    private func avatarCircle(for agent: OverlapSummary) -> some View {
        let primary = AgentColorPalette.primary(for: agent.avatarColor)
        let secondary = AgentColorPalette.secondary(for: agent.avatarColor)
        return ZStack {
            if agent.avatarColor.hasPrefix("gradient:") {
                Circle()
                    .fill(LinearGradient(colors: [primary, secondary], startPoint: .topLeading, endPoint: .bottomTrailing))
            } else {
                Circle().fill(primary)
            }
            Text(agent.avatarEmoji)
                .font(.system(size: 10))
        }
        .frame(width: 22, height: 22)
        .overlay(Circle().stroke(Color.appSurfaceElevated, lineWidth: 2))
    }
}

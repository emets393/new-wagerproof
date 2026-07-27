import SwiftUI
import WagerproofDesign
import WagerproofModels

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
        /// Kept because the DB column still exists and other clients read it —
        /// it is never drawn here (agent faces are always the pixel sprite).
        let avatarEmoji: String
        let avatarColor: String
        /// `sprite_index` when the owner picked a character. Nil (the common
        /// case) falls back to the id hash — see `spriteIndex`.
        var spriteIndexOverride: Int? = nil

        /// Canonical sprite resolution, identical to `Agent.spriteIndex`, so an
        /// agent's face is the same person here, on its card, and in the office.
        var spriteIndex: Int {
            if let idx = spriteIndexOverride, (0...7).contains(idx) { return idx }
            return AgentSpriteIndex.forSeed(avatarId)
        }
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
            // These circles are only 22pt and appear in overlapping stacks.
            // A live PixelSpriteAvatar would give every visible face its own
            // TimelineView timer; freeze the sprite at frame 0 instead.
            PixelSpriteAvatar(spriteIndex: agent.spriteIndex, animated: false)
                .frame(width: 19, height: 19)
                .offset(y: 2)
        }
        .frame(width: 22, height: 22)
        .clipShape(Circle())
        .overlay(Circle().stroke(Color.appSurfaceElevated, lineWidth: 2))
        .accessibilityLabel(agent.name)
    }
}

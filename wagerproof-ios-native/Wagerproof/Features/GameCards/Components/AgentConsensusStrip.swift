import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Agent-consensus row on a game card — what the public AI agents actually bet.
/// Native port of web's `src/features/games/components/AgentConsensusStrip.tsx`.
/// See `.claude/docs/18_agent_consensus.md`.
///
/// Three tiers, all decided server-side by `get_game_agent_consensus`:
///   - flagged → emerald strip: avatar stack · "39 agents on OVER 7.5" · "100% agree" · BET
///   - agents  → muted inline stack + bare count, no colour and no claim
///   - none    → renders nothing
///
/// The count alone deliberately does NOT earn the flag: agents bet nearly every
/// game on a slate, so participation would flag ~96% of it. Only *agreement*
/// turns the strip green.
struct AgentConsensusStrip: View {
    let consensus: GameAgentConsensus

    /// Tailwind emerald-500, matching the web strip exactly. Deliberately not
    /// `Color.appPrimary` (green-500): that green already means MODEL signal on
    /// this card (O/U lean, positive edge), and the crowd signal must not read
    /// as the model agreeing.
    private static let emerald = Color(hex: 0x10B981)
    private static let maxVisible = 4

    var body: some View {
        if consensus.agents <= 0 {
            EmptyView()
        } else if consensus.flagged {
            flaggedStrip
        } else {
            mutedRow
        }
    }

    // MARK: - Tier 2 — flagged

    @ViewBuilder
    private var flaggedStrip: some View {
        let shape = RoundedRectangle(cornerRadius: 12, style: .continuous)
        HStack(spacing: 8) {
            // Overflow counts against the WINNING side, not the whole game —
            // the stack is claiming "these agents are on this side".
            avatarStack(overflow: consensus.sideAgents - visibleAvatars.count)
            claimLabel
            Spacer(minLength: 0)
            betBadge
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(Self.emerald.opacity(0.12), in: shape)
        .overlay(shape.stroke(Self.emerald.opacity(0.35), lineWidth: 0.75))
    }

    /// "39 agents on OVER 7.5   100% agree" as one wrapping-free line. The side
    /// is verbatim from `pick_selection` and can be long ("Kansas City Royals
    /// +160"), so it truncates rather than pushing the BET badge off the card.
    @ViewBuilder
    private var claimLabel: some View {
        HStack(spacing: 5) {
            (
                Text("\(consensus.sideAgents) \(consensus.sideAgents == 1 ? "agent" : "agents") on ")
                    .font(.system(size: 11, weight: .semibold))
                    + Text(consensus.side.uppercased())
                    .font(.system(size: 11, weight: .heavy))
            )
            .foregroundStyle(Self.emerald)
            .lineLimit(1)
            .truncationMode(.tail)

            // fixedSize so the short suffix always renders whole and the long,
            // verbatim side string is what gives up width instead.
            Text("\(consensus.agreementPercent)% agree")
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(Self.emerald.opacity(0.75))
                .lineLimit(1)
                .fixedSize()
        }
    }

    @ViewBuilder
    private var betBadge: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(Color.white.opacity(0.9))
                .frame(width: 5, height: 5)
            Text("BET")
                .font(.system(size: 9, weight: .heavy))
                .tracking(0.6)
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 7)
        .padding(.vertical, 4)
        .background(Self.emerald, in: RoundedRectangle(cornerRadius: 6, style: .continuous))
        .fixedSize()
    }

    // MARK: - Tier 1 — has agents, not flagged

    @ViewBuilder
    private var mutedRow: some View {
        HStack(spacing: 6) {
            avatarStack(overflow: consensus.agents - visibleAvatars.count)
            Text(consensus.agents == 1 ? "1 agent" : "\(consensus.agents) agents")
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(Color.appTextMuted)
                .lineLimit(1)
            Spacer(minLength: 0)
        }
    }

    // MARK: - Avatar stack

    private var visibleAvatars: [ConsensusAvatar] {
        Array(consensus.avatars.prefix(Self.maxVisible))
    }

    /// Overlapping agent bubbles — same language as `AgentOverlapFooter`, sized
    /// down to sit inside a feed card rather than a pick ticket. The ring is the
    /// page surface (not a tint): its only job is to keep two adjacent bubbles
    /// from bleeding into each other, and agent colors are arbitrary.
    @ViewBuilder
    private func avatarStack(overflow: Int) -> some View {
        let visible = visibleAvatars
        if visible.isEmpty {
            EmptyView()
        } else {
            HStack(spacing: -6) {
                ForEach(Array(visible.enumerated()), id: \.element.id) { index, avatar in
                    bubble(for: avatar)
                        // Leading bubbles paint over their neighbours, matching
                        // the web stack's z-order.
                        .zIndex(Double(Self.maxVisible - index))
                }
                if overflow > 0 {
                    Text("+\(overflow)")
                        .font(.system(size: 8, weight: .bold))
                        .foregroundStyle(Color.appTextSecondary)
                        .padding(.horizontal, 3)
                        .frame(minWidth: 20, minHeight: 20)
                        .background(Capsule().fill(Color.appSurfaceMuted))
                        .overlay(Capsule().stroke(Color.appSurface, lineWidth: 1.5))
                        .zIndex(0)
                }
            }
            .fixedSize()
        }
    }

    @ViewBuilder
    private func bubble(for avatar: ConsensusAvatar) -> some View {
        ConsensusAvatarBubble(avatar: avatar, size: 20)
    }
}

/// One agent face in a consensus stack: the pixel-office character over its
/// `avatar_color` tint. Agent avatars are ALWAYS the sprite — `avatar_emoji`
/// exists in the DB but is never drawn, so the same person is recognisable
/// here, on their card, on the leaderboard, and in the office.
///
/// Shared by the feed strip (20pt) and the game-detail `AgentConsensusSection`
/// widget (32pt) so both stacks stay pixel-identical. iOS has no Outliers-tile
/// consensus surface yet — web does; see `.claude/docs/18_agent_consensus.md`.
struct ConsensusAvatarBubble: View {
    let avatar: ConsensusAvatar
    var size: CGFloat = 20
    /// Ring colour — the page surface behind the stack, so overlapping bubbles
    /// read as separate faces. Not a tint.
    var ringColor: Color = .appSurface
    var ringWidth: CGFloat = 1.5

    /// Web's `#64748b` fallback for an agent that never picked a colour.
    private static let fallbackColor = "#64748b"

    var body: some View {
        let raw = avatar.color ?? Self.fallbackColor
        ZStack {
            if raw.hasPrefix("gradient:") {
                Circle().fill(
                    LinearGradient(
                        colors: AgentColorPalette.avatarGradient(for: raw),
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
            } else {
                Circle().fill(AgentColorPalette.primary(for: raw))
            }
            // The sprite is a standing character drawn from the feet up, so it
            // is bottom-anchored and slightly oversized: at 20pt a fitted sprite
            // reads as a speck, while letting the head/shoulders fill the circle
            // and clipping the legs at the rim reads as a portrait.
            // Frozen pose, deliberately. Every animated sprite drives its own
            // TimelineView(.periodic) at 2.5fps, and these bubbles come in
            // stacks of up to 4 — on every feed card AND in the detail widget.
            // That is dozens of independent redraw timers on a scrolling list,
            // animating a 20pt character nobody is looking at. The office and
            // detail-hero sprites still animate, where they are the subject.
            PixelSpriteAvatar(spriteIndex: avatar.spriteIndex, animated: false)
                .frame(width: size * 0.86, height: size * 0.86)
                .offset(y: size * 0.12)
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .overlay(Circle().stroke(ringColor, lineWidth: ringWidth))
        .accessibilityLabel(avatar.name)
    }
}

#Preview {
    // Mixed on purpose: two owner-picked characters and two that fall back to
    // the FNV-1a hash of the agent id, which is the 96% case in prod.
    let avatars = [
        ConsensusAvatar(avatarId: "1", name: "Sharp Sam", spriteIndexOverride: 7, color: "#6366f1"),
        ConsensusAvatar(avatarId: "2", name: "Chalk Carl", spriteIndexOverride: 3, color: "gradient:#f97316,#facc15"),
        ConsensusAvatar(avatarId: "3", name: "Fade Fiona", spriteIndexOverride: nil, color: "#ec4899"),
        ConsensusAvatar(avatarId: "4", name: "Model Max", spriteIndexOverride: nil, color: nil),
    ]
    return VStack(alignment: .leading, spacing: 16) {
        AgentConsensusStrip(consensus: GameAgentConsensus(
            gameId: "1", gameDate: "2026-07-26", agents: 39, side: "Over 7.5",
            sideAgents: 39, agreement: 1.0, threshold: 8, flagged: true, avatars: avatars
        ))
        AgentConsensusStrip(consensus: GameAgentConsensus(
            gameId: "2", gameDate: "2026-07-26", agents: 45, side: "Cincinnati Reds ML",
            sideAgents: 14, agreement: 0.31, threshold: 8, flagged: false, avatars: avatars
        ))
        AgentConsensusStrip(consensus: GameAgentConsensus(
            gameId: "3", gameDate: "2026-07-26", agents: 12, side: "Kansas City Royals +160",
            sideAgents: 9, agreement: 0.75, threshold: 8, flagged: true, avatars: avatars
        ))
    }
    .padding()
    .background(Color.appSurface)
}

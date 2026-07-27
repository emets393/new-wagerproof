import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// "What are the public agents betting on this game?" — the game-detail widget.
/// Native port of web's
/// `src/features/games/detail/sections/AgentConsensusSection.tsx`.
/// See `.claude/docs/18_agent_consensus.md`.
///
/// The answer is the SIDE they agree on, not the raw count: agents bet nearly
/// every game on a slate, so a participation count says nothing on its own.
/// That's also why the widget leads with agreement and ticks the flag threshold
/// on its bar — "how close was this to a BET flag" is the actual question.
///
/// Sport-agnostic on purpose: it goes FIRST in all five detail sheets, above the
/// per-sport sections, exactly as web hosts it as the first child of the detail
/// grid.
struct AgentConsensusSection: View {
    let sport: GamesStore.Sport
    /// Join key for `avatar_picks.game_id` — build it with `GameConsensusKey`,
    /// not the model's `id` (NFL/CFB key off `trainingKey`).
    let gameId: String
    /// Raw feed date; normalized to a `yyyy-MM-dd` ET key before the fetch.
    let gameDate: String

    /// Optional so previews and the screenshot harness — which render sheets
    /// without the tab shell — degrade to "no widget" instead of trapping.
    @Environment(AgentConsensusStore.self) private var store: AgentConsensusStore?

    /// Tailwind emerald-500, matching web and the feed strip. Deliberately NOT
    /// `Color.appPrimary` (green-500): that green already means MODEL signal in
    /// game detail (O/U lean, positive edge), and the crowd signal must not read
    /// as the model agreeing. See the doc's "Don't merge BET into the model
    /// badge row".
    static let emerald = Color(hex: 0x10B981)
    private static let maxVisible = 4

    private var consensus: GameAgentConsensus? {
        store?.consensus(for: sport, gameId: gameId)
    }

    var body: some View {
        // A VStack (not a bare `if`) so the `.task` still has a view to attach
        // to on the very first render, when the store has nothing yet. Empty it
        // costs zero height in the collapsing scroll.
        VStack(spacing: 0) {
            // No agents on this game is a NORMAL state — picks land through the
            // day, and an empty card is worse than no card.
            if let consensus, consensus.agents > 0 {
                card(consensus)
            }
        }
        .task(id: gameId) {
            // Widens the feed's existing slate coverage rather than replacing
            // it; a no-op when the games feed already loaded this date. Detail
            // reached from Search/WagerBot has no feed behind it, so this is the
            // only fetch that surface ever makes.
            await store?.ensureLoaded(sport: sport, date: GameDateGrouping.dateKey(from: gameDate))
        }
    }

    @ViewBuilder
    private func card(_ c: GameAgentConsensus) -> some View {
        WidgetCollapsingSection(
            title: "Agent Consensus",
            systemImage: "person.3.fill",
            iconTint: Self.emerald,
            // The shared verdict capsule stands in for web's solid emerald "Bet"
            // pill — same slot, same word, in this app's accessory language so
            // it can't drift from every other pinned widget's badge.
            accessory: c.flagged ? .verdict(text: "BET", tintHex: 0x10B981) : .none,
            contentKey: "\(c.gameId)-\(c.agents)-\(c.sideAgents)-\(c.flagged)"
        ) {
            VStack(alignment: .leading, spacing: 12) {
                Text(headline(c))
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Color.appTextPrimary)
                    .fixedSize(horizontal: false, vertical: true)

                // Web puts this in the WidgetCard shell's `subtitle` slot; the
                // iOS collapsing shell has no such slot, so it rides under the
                // headline.
                Text("What the public AI agents bet on this game, and how much they agree.")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)

                sideRow(c)

                Divider().overlay(Color.appBorder.opacity(0.4))

                agreementBar(c)
            }
        }
    }

    private func headline(_ c: GameAgentConsensus) -> String {
        let pct = c.agreementPercent
        return c.flagged
            ? "\(c.sideAgents) of \(c.agents) agents are on \(c.side) — \(pct)% agreement."
            : "Agents are split on this game: the most-backed side is \(c.side), with only \(pct)% agreement."
    }

    // MARK: - The pick (largest thing in the card)

    @ViewBuilder
    private func sideRow(_ c: GameAgentConsensus) -> some View {
        let dir = Self.sideDirection(c.side)
        HStack(spacing: 12) {
            // Overflow counts against the WINNING side, not the whole game —
            // the stack is claiming "these agents are on this side".
            avatarStack(c, overflow: c.sideAgents - min(c.avatars.count, Self.maxVisible))

            VStack(alignment: .leading, spacing: 2) {
                eyebrow("Most-backed side")
                HStack(spacing: 4) {
                    if let dir {
                        Image(systemName: dir == .over ? "arrow.up" : "arrow.down")
                            .font(.system(size: 15, weight: .bold))
                    }
                    // Verbatim `pick_selection`, which can be long ("Kansas City
                    // Royals +160") — truncate rather than shove the percentage
                    // off the card.
                    Text(c.side)
                        .lineLimit(1)
                        .truncationMode(.tail)
                }
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(Self.sideTint(dir))
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            VStack(alignment: .trailing, spacing: 2) {
                Text("\(c.agreementPercent)%")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                eyebrow("agree")
            }
            .fixedSize()
        }
    }

    private func eyebrow(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.system(size: 9, weight: .bold))
            .tracking(0.5)
            .foregroundStyle(Color.appTextSecondary)
    }

    /// O/U picks carry colour + direction on the word itself. Under reads blue,
    /// not red — the legacy adapter convention shared with `InsightVerdictLine`.
    private enum SideDirection { case over, under }

    private static func sideDirection(_ side: String) -> SideDirection? {
        let s = side.trimmingCharacters(in: .whitespaces).lowercased()
        if s.hasPrefix("over") { return .over }
        if s.hasPrefix("under") { return .under }
        return nil
    }

    private static func sideTint(_ dir: SideDirection?) -> Color {
        switch dir {
        case .over: return emerald
        case .under: return Color(hex: 0x3B82F6)
        case nil: return Color.appTextPrimary
        }
    }

    // MARK: - Avatar stack

    @ViewBuilder
    private func avatarStack(_ c: GameAgentConsensus, overflow: Int) -> some View {
        let visible = Array(c.avatars.prefix(Self.maxVisible))
        if visible.isEmpty {
            EmptyView()
        } else {
            // Same `ConsensusAvatarBubble` the feed strip uses, just scaled up
            // from 20 to 32 — the two stacks must stay pixel-identical so the
            // same four faces are recognisable on the card and on this page.
            HStack(spacing: -8) {
                ForEach(Array(visible.enumerated()), id: \.element.id) { index, avatar in
                    ConsensusAvatarBubble(avatar: avatar, size: 32, ringWidth: 2)
                        // Leading bubbles paint over their neighbours, matching
                        // the web stack's descending z-order.
                        .zIndex(Double(Self.maxVisible - index))
                }
                if overflow > 0 {
                    Text("+\(overflow)")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(Color.appTextSecondary)
                        .padding(.horizontal, 4)
                        .frame(minWidth: 32, minHeight: 32)
                        .background(Capsule().fill(Color.appSurfaceMuted))
                        .overlay(Capsule().stroke(Color.appSurface, lineWidth: 2))
                        .zIndex(0)
                }
            }
            .fixedSize()
        }
    }

    // MARK: - Agreement bar

    /// One divided bar with the flag threshold ticked, so "how close was this to
    /// earning a BET flag" is readable without a second sentence.
    @ViewBuilder
    private func agreementBar(_ c: GameAgentConsensus) -> some View {
        let sideFraction = c.agents > 0 ? min(1, Double(c.sideAgents) / Double(c.agents)) : 0
        // The threshold is an agent COUNT; place its tick on the same
        // 0…agents scale the fill uses.
        let thresholdFraction = c.agents > 0 ? min(1, Double(c.threshold) / Double(c.agents)) : 0

        VStack(alignment: .leading, spacing: 6) {
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.appTextMuted.opacity(0.18))
                    Capsule()
                        .fill(c.flagged ? Self.emerald : Color.appTextMuted.opacity(0.5))
                        .frame(width: max(0, geo.size.width * sideFraction))
                    if thresholdFraction > 0 && thresholdFraction < 1 {
                        Rectangle()
                            .fill(Color.appTextPrimary.opacity(0.45))
                            .frame(width: 2)
                            .offset(x: geo.size.width * thresholdFraction)
                    }
                }
            }
            .frame(height: 10)

            HStack(spacing: 4) {
                Text("\(c.sideAgents)")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                Text("of \(c.agents) agents")
                Spacer(minLength: 8)
                Text(c.flagged ? "flag needs \(c.threshold) · cleared" : "flag needs \(c.threshold)")
            }
            .font(.system(size: 10, weight: .medium))
            .foregroundStyle(Color.appTextSecondary)
        }
    }
}

#Preview {
    let avatars = [
        ConsensusAvatar(avatarId: "1", name: "Sharp Sam", spriteIndexOverride: 7, color: "#6366f1"),
        ConsensusAvatar(avatarId: "2", name: "Chalk Carl", spriteIndexOverride: 3, color: "gradient:#f97316,#facc15"),
        ConsensusAvatar(avatarId: "3", name: "Fade Fiona", spriteIndexOverride: nil, color: "#ec4899"),
        ConsensusAvatar(avatarId: "4", name: "Model Max", spriteIndexOverride: nil, color: nil),
    ]
    let store = AgentConsensusStore().debugSet(sport: .mlb, rows: [
        "flagged": GameAgentConsensus(
            gameId: "flagged", gameDate: "2026-07-26", agents: 39, side: "Over 7.5",
            sideAgents: 39, agreement: 1.0, threshold: 8, flagged: true, avatars: avatars
        ),
        "split": GameAgentConsensus(
            gameId: "split", gameDate: "2026-07-26", agents: 45, side: "Cincinnati Reds ML",
            sideAgents: 14, agreement: 0.31, threshold: 12, flagged: false, avatars: avatars
        ),
    ])
    return ScrollView {
        VStack(spacing: 16) {
            AgentConsensusSection(sport: .mlb, gameId: "flagged", gameDate: "2026-07-26")
            AgentConsensusSection(sport: .mlb, gameId: "split", gameDate: "2026-07-26")
        }
        .padding(.vertical, 16)
    }
    .background(Color.appSurface)
    .environment(store)
}

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
///
/// The card states a VERDICT (`ConsensusVerdict`) and hides the mechanism. It
/// used to print "flag needs 13" — the agent-count gate only — while `flagged`
/// also requires ≥55% agreement, so a card could show 18 ≥ 13 with its bar
/// visibly past the tick and still not flag, contradicting itself. Field size is
/// not a bullish signal, it is the sample size that makes the percentage
/// trustworthy, so it lives in the bar legend rather than in a gate readout.
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

    /// Verdict chip tints. The chip is ALWAYS present now — its colour, not its
    /// existence, is what makes a consensus game pop, and a card that shows a
    /// chip only on the 21% of games that flag leaves the other 79% looking
    /// unlabelled rather than deliberately quiet.
    static func verdictTint(_ v: ConsensusVerdict) -> UInt32 {
        switch v {
        case .consensus: return 0x10B981  // emerald-500
        case .lean:      return 0xF59E0B  // amber-500
        case .split,
             .tooFew:    return 0x94A3B8  // slate-400
        }
    }

    static func verdictWord(_ v: ConsensusVerdict) -> String {
        switch v {
        case .consensus: return "CONSENSUS"
        case .lean:      return "LEAN"
        case .split:     return "SPLIT"
        case .tooFew:    return "TOO FEW"
        }
    }

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
        let verdict = c.verdict
        WidgetCollapsingSection(
            title: "Agent Consensus",
            systemImage: "person.3.fill",
            iconTint: Self.emerald,
            // The shared verdict capsule stands in for web's pill — same slot,
            // in this app's accessory language so it can't drift from every
            // other pinned widget's badge. "BET" was retired: it reads as an
            // instruction from the app, and it collided with the model-signal
            // badges the same card already carries.
            accessory: .verdict(text: Self.verdictWord(verdict), tintHex: Self.verdictTint(verdict)),
            contentKey: "\(c.gameId)-\(c.sideAgents)-\(c.marketAgents)-\(c.agreementPercent)-\(verdict.rawValue)-\(c.runnerUpAgents ?? -1)-\(c.slateRank ?? -1)"
        ) {
            VStack(alignment: .leading, spacing: 12) {
                Text(c.headline)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Color.appTextPrimary)
                    .fixedSize(horizontal: false, vertical: true)

                // Web puts this in the WidgetCard shell's `subtitle` slot; the
                // iOS collapsing shell has no such slot, so it rides under the
                // headline.
                Text("Independent picks from the public AI agents on this game.")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)

                sideRow(c)

                Divider().overlay(Color.appBorder.opacity(0.4))

                agreementBar(c)
            }
        }
    }

    // MARK: - The pick (largest thing in the card)

    @ViewBuilder
    private func sideRow(_ c: GameAgentConsensus) -> some View {
        let dir = Self.sideDirection(c.side)
        HStack(alignment: .top, spacing: 12) {
            // Overflow counts against the WINNING side, not the whole game —
            // the stack is claiming "these agents are on this side".
            avatarStack(c, overflow: c.sideAgents - min(c.avatars.count, Self.maxVisible))

            VStack(alignment: .leading, spacing: 2) {
                eyebrow(c.mostBackedLabel)
                HStack(alignment: .top, spacing: 4) {
                    if let dir {
                        Image(systemName: dir == .over ? "arrow.up" : "arrow.down")
                            .font(.system(size: 15, weight: .bold))
                            .padding(.top, 4)
                    }
                    // Verbatim `pick_selection`, which can be long ("Kansas City
                    // Royals +160"). It is the card's primary fact, so let it
                    // wrap while the fixed-size percentage keeps its own column.
                    Text(c.side)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(Self.sideTint(dir))
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .layoutPriority(1)

            // Suppressed on `.tooFew`: "50%" off a 2-agent market is theatre,
            // and the headline already says how few bet it.
            if c.verdict != .tooFew {
                VStack(alignment: .trailing, spacing: 2) {
                    Text("\(c.agreementPercent)%")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(Color.appTextPrimary)
                    // "agree" alone never said agree with WHOM, or over which
                    // population — the denominator is the agents who bet this
                    // market, not everyone who bet the game.
                    eyebrow(c.sharePopulationLabel)
                }
                .fixedSize()
            }
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

    /// The market split as ONE divided bar: leader · runner-up · everyone else.
    /// The old single fill drew the other 49% as an unlabelled grey remainder,
    /// which made a coin flip read as a lean.
    ///
    /// Segments are in agent counts over `marketAgents`. A selection belongs to
    /// one market; whole-game participation pools unrelated moneyline/spread/
    /// total bets and makes agreement shrink as more markets receive picks (the
    /// old 5/17 versus correct 5/6 bug).
    @ViewBuilder
    private func agreementBar(_ c: GameAgentConsensus) -> some View {
        let total = Double(max(c.marketAgents, 1))
        let leader = min(1, Double(c.sideAgents) / total)
        let runnerUp = min(1 - leader, Double(c.runnerUpAgents ?? 0) / total)
        let other = max(0, min(1 - leader - runnerUp, Double(c.otherAgents) / total))

        VStack(alignment: .leading, spacing: 6) {
            GeometryReader { geo in
                HStack(spacing: 1.5) {
                    segment(width: geo.size.width * leader,
                            color: c.flagged ? Self.emerald : Color.appTextPrimary.opacity(0.55))
                    if runnerUp > 0 {
                        segment(width: geo.size.width * runnerUp,
                                color: Color.appTextMuted.opacity(0.45))
                    }
                    if other > 0 {
                        segment(width: geo.size.width * other,
                                color: Color.appTextMuted.opacity(0.2))
                    }
                    Spacer(minLength: 0)
                }
                .background(Capsule().fill(Color.appTextMuted.opacity(0.15)))
            }
            .frame(height: 10)

            HStack(spacing: 4) {
                // Named counts, so "51%" has a visible numerator AND a visible
                // denominator instead of one bar and a bare percentage.
                Text(c.barLegend.joined(separator: " · "))
                    .lineLimit(1)
                    .truncationMode(.tail)
                Spacer(minLength: 8)
                if let rank = c.slateRankLabel {
                    // Replaces "flag needs N". Reading 51% against today's board
                    // is the comparison that makes it mean anything; the gate
                    // that produced the verdict is deliberately not shown.
                    Text(rank).fixedSize()
                }
            }
            .font(.system(size: 10, weight: .medium))
            .foregroundStyle(Color.appTextSecondary)
        }
    }

    private func segment(width: CGFloat, color: Color) -> some View {
        Capsule().fill(color).frame(width: max(0, width))
    }
}

#Preview {
    let avatars = [
        ConsensusAvatar(avatarId: "1", name: "Sharp Sam", spriteIndexOverride: 7, color: "#6366f1"),
        ConsensusAvatar(avatarId: "2", name: "Chalk Carl", spriteIndexOverride: 3, color: "gradient:#f97316,#facc15"),
        ConsensusAvatar(avatarId: "3", name: "Fade Fiona", spriteIndexOverride: nil, color: "#ec4899"),
        ConsensusAvatar(avatarId: "4", name: "Model Max", spriteIndexOverride: nil, color: nil),
    ]
    // One row per verdict, plus the legacy shape, because the four render
    // materially different copy and the last one is what a client sees when it
    // is deployed ahead of the runner-up/rank migration.
    let store = AgentConsensusStore().debugSet(sport: .mlb, rows: [
        "consensus": GameAgentConsensus(
            gameId: "consensus", gameDate: "2026-07-26", agents: 44, side: "Over 7.5",
            sideAgents: 31, marketAgents: 35, marketLabel: "total", agreement: 0.8857,
            threshold: 12, flagged: true,
            runnerUpSide: "Under 7.5", runnerUpAgents: 3, slateRank: 1, slateGames: 14,
            avatars: avatars
        ),
        "split": GameAgentConsensus(
            gameId: "split", gameDate: "2026-07-26", agents: 41, side: "TCU -6.5",
            sideAgents: 18, marketAgents: 35, marketLabel: "spread", agreement: 0.5143,
            threshold: 13, flagged: false,
            runnerUpSide: "Baylor +6.5", runnerUpAgents: 15, slateRank: 3, slateGames: 14,
            avatars: avatars
        ),
        "lean": GameAgentConsensus(
            gameId: "lean", gameDate: "2026-07-26", agents: 17,
            side: "Pittsburgh Pirates F5 -0.5", sideAgents: 5,
            marketAgents: 6, marketLabel: "F5 run line", agreement: 0.8333,
            threshold: 12, flagged: false,
            runnerUpSide: "Milwaukee Brewers F5 +0.5", runnerUpAgents: 1,
            slateRank: 6, slateGames: 14, avatars: avatars
        ),
        // No market_agents / market_label / runner_up / rank — the pre-migration
        // RPC shape that prod was still serving on 2026-08-15.
        "legacy": GameAgentConsensus(
            gameId: "legacy", gameDate: "2026-07-26", agents: 30,
            side: "Chicago White Sox ML", sideAgents: 13, agreement: 0.4333,
            threshold: 13, flagged: false, avatars: avatars
        ),
    ])
    return ScrollView {
        VStack(spacing: 16) {
            AgentConsensusSection(sport: .mlb, gameId: "consensus", gameDate: "2026-07-26")
            AgentConsensusSection(sport: .mlb, gameId: "split", gameDate: "2026-07-26")
            AgentConsensusSection(sport: .mlb, gameId: "lean", gameDate: "2026-07-26")
            AgentConsensusSection(sport: .mlb, gameId: "legacy", gameDate: "2026-07-26")
        }
        .padding(.vertical, 16)
    }
    .background(Color.appSurface)
    .environment(store)
}

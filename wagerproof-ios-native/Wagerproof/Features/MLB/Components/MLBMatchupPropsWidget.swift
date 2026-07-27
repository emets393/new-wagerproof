import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// "Player Props" insight widget for the MLB game-detail sheet. Renders the
/// `MLBPropsInsight` digest (verdict line + ≤5 slot-ordered player rows:
/// starters' K props → extreme L10 bats → top-of-the-order fill) instead of
/// the old full team-grouped list — which now lives in
/// `MatchupPropsDetailSheet` behind the expand affordance. Rows stay direct
/// entity links: tapping a player zoom-pushes their `PlayerPropDetailView`.
struct MLBMatchupPropsWidget: View {
    /// Passed in rather than looked up here — the parent already resolves it
    /// for the expand action, and doing the lookup twice per body pass was
    /// pure waste.
    let matchup: MLBPropMatchup
    /// Shared zoom namespace owned by the carousel; rows are the
    /// `matchedTransitionSource` and the pushed detail is the `.zoom` target.
    let namespace: Namespace.ID
    let onSelect: (PlayerPropSelection) -> Void
    let onExpand: () -> Void

    @Environment(PropsStore.self) private var propsStore

    var body: some View {
        // Both halves of the props pipeline are memoized against the store's
        // slate version; recomputing them inline ran the full analytics walk
        // (every player × every prop × their season log) on every body pass.
        if let summary = propsStore.propsInsightSummary(forGamePk: matchup.gamePk) {
            let itemsById = PlayerPropFeedCache.itemsById(for: matchup,
                                                          version: propsStore.matchupsVersion)
            InsightWidgetSection(
                title: "Player Props",
                systemImage: "figure.baseball",
                iconTint: Color.appPrimary,
                badge: summary.badge,
                expandLabel: "All \(summary.totalProps) props",
                onExpand: onExpand
            ) {
                VStack(alignment: .leading, spacing: 12) {
                    InsightVerdictLine(verdicts: [summary.verdict], accent: Color.appPrimary)
                    VStack(spacing: 0) {
                        ForEach(Array(summary.signals.enumerated()), id: \.element.id) { idx, signal in
                            if idx > 0 {
                                Divider().background(Color.appBorder.opacity(0.4))
                            }
                            if let item = itemsById[signal.playerId] {
                                PropSignalRow(signal: signal, item: item) {
                                    onSelect(item.selection)
                                }
                                .matchedTransitionSource(id: item.selection.transitionID, in: namespace)
                            }
                        }
                    }
                }
            }
        }
    }
}

/// One digest row: headshot with team-color ring · name + L10 hit strip ·
/// market/line + pct badge. Tap pushes the player's prop detail page.
struct PropSignalRow: View {
    let signal: PropSignal
    let item: PlayerPropFeedItem
    let onTap: () -> Void

    init(signal: PropSignal, item: PlayerPropFeedItem, onTap: @escaping () -> Void) {
        self.signal = signal
        self.item = item
        self.onTap = onTap
    }

    private var computed: MLBPropComputedAtLine { signal.headline.computed }
    private var lowConfidence: Bool { computed.l10.lowConfidence }

    /// Props pct color rule — ≥70 green, 55–69.9 yellow, ≤30 red, else gray.
    /// Low-confidence samples always read gray so a hot 3/3 can't shout.
    private var pctColor: Color {
        guard !lowConfidence, let pct = computed.l10.pct else { return Color.appTextSecondary }
        if pct >= 70 { return Color(hex: 0x22C55E) }
        if pct >= 55 { return Color(hex: 0xEAB308) }
        if pct <= 30 { return Color(hex: 0xEF4444) }
        return Color.appTextSecondary
    }

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 10) {
                PlayerHeadshot(playerId: signal.playerId, size: 28)
                    .frame(width: 28, height: 28)
                    .overlay(
                        Circle().stroke(Color(hex: Int(item.teamPrimaryHex)).opacity(0.8), lineWidth: 1.5)
                    )
                VStack(alignment: .leading, spacing: 3) {
                    Text(signal.playerName)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.appTextPrimary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                    if computed.miniStrip.isEmpty {
                        Text(signal.isPitcher ? "SP" : (signal.battingOrder.map { "#\($0)" } ?? ""))
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(Color.appTextMuted)
                    } else {
                        MiniHitStrip(strip: computed.miniStrip)
                    }
                    if lowConfidence {
                        Text("small sample")
                            .font(.system(size: 9, weight: .medium))
                            .foregroundStyle(Color.appTextMuted)
                    }
                }
                Spacer(minLength: 8)
                VStack(alignment: .trailing, spacing: 3) {
                    Text("\(MLBPropsInsight.marketShort(signal.headline.row.market)) \(MLBPlayerProps.formatLine(computed.line))")
                        .font(.system(size: 12, weight: .semibold, design: .monospaced))
                        .foregroundStyle(Color.appTextPrimary)
                        .lineLimit(1)
                    Text(computed.l10.pctLabel)
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(pctColor)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 1)
                        .background(pctColor.opacity(0.13), in: Capsule())
                }
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Color.appTextMuted)
            }
            .padding(.vertical, 8)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.impact(weight: .light), trigger: item.selection.id)
    }
}

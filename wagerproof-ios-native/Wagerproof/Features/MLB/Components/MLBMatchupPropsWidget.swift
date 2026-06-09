import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// "Player Props" widget for the MLB game-detail screen. Pulls the player-prop
/// selections for THIS matchup out of the shared `PropsStore` slate (matched by
/// `gamePk`), grouped by team, and links each player to their existing
/// `PlayerPropDetailView` page (with the same zoom transition the Props tab
/// uses). Renders nothing until props for the game are loaded — it triggers a
/// (cached) `PropsStore.refresh()` so opening MLB detail without visiting the
/// Props tab still populates it.
struct MLBMatchupPropsWidget: View {
    let game: MLBGame
    /// Shared zoom namespace owned by the carousel; the row is the
    /// `matchedTransitionSource` and the pushed detail is the `.zoom` target.
    let namespace: Namespace.ID
    let onSelect: (PlayerPropSelection) -> Void

    @Environment(PropsStore.self) private var propsStore

    private var matchup: MLBPropMatchup? {
        propsStore.matchups.first { $0.gamePk == game.gamePk }
    }

    private var items: [PlayerPropFeedItem] {
        guard let matchup else { return [] }
        return PlayerPropFeed.items(from: [matchup])
    }

    private var awayItems: [PlayerPropFeedItem] {
        items.filter { $0.selection.teamAbbr == game.awayAbbr }
    }
    private var homeItems: [PlayerPropFeedItem] {
        items.filter { $0.selection.teamAbbr == game.homeAbbr }
    }

    var body: some View {
        Group {
            if !awayItems.isEmpty || !homeItems.isEmpty {
                WidgetCollapsingSection(title: "Player Props", systemImage: "figure.baseball", iconTint: Color.appPrimary) {
                    VStack(spacing: 0) {
                        teamGroup(abbr: game.awayAbbr, logo: game.awayLogoUrl, items: awayItems)
                        teamGroup(abbr: game.homeAbbr, logo: game.homeLogoUrl, items: homeItems)
                    }
                }
            }
        }
        // Always-present so the loader fires even before any props exist; the
        // store dedupes/caches so this is a no-op once loaded (or after the
        // Props tab loaded it).
        .task(id: game.gamePk) { await propsStore.refresh() }
    }

    @ViewBuilder
    private func teamGroup(abbr: String, logo: String?, items: [PlayerPropFeedItem]) -> some View {
        if !items.isEmpty {
            VStack(spacing: 0) {
                HStack(spacing: 6) {
                    if let logo, let url = URL(string: logo) {
                        AsyncImage(url: url) { phase in
                            if case .success(let img) = phase { img.resizable().scaledToFit() } else { Color.clear }
                        }
                        .frame(width: 16, height: 16)
                    }
                    Text(abbr.uppercased())
                        .font(.system(size: 11, weight: .bold))
                        .tracking(0.6)
                        .foregroundStyle(Color.appTextSecondary)
                    Spacer()
                    Text("\(items.count)")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Color.appTextMuted)
                }
                .padding(.top, 10)
                .padding(.bottom, 6)

                ForEach(Array(items.enumerated()), id: \.element.id) { idx, item in
                    if idx > 0 {
                        Divider().background(Color.appBorder.opacity(0.4))
                    }
                    MatchupPropRow(item: item, namespace: namespace, onSelect: onSelect)
                }
            }
        }
    }
}

/// Compact tappable player row — headshot, name, role/opponent, best-market
/// line, and L10 hit-rate — that pushes `PlayerPropDetailView`.
private struct MatchupPropRow: View {
    let item: PlayerPropFeedItem
    let namespace: Namespace.ID
    let onSelect: (PlayerPropSelection) -> Void

    private var sel: PlayerPropSelection { item.selection }
    private var computed: MLBPropComputedAtLine { item.headline.computed }
    private var row: MLBPlayerPropRow { item.headline.row }

    private var roleLabel: String {
        if let pos = sel.position, !pos.isEmpty { return pos }
        return sel.isPitcher ? "SP" : ""
    }

    private var hitColor: Color {
        guard let pct = computed.l10.pct else { return Color.appTextMuted }
        if pct >= 70 { return Color.appPrimary }
        if pct >= 55 { return Color(hex: 0xEAB308) }
        return Color.appTextSecondary
    }

    var body: some View {
        Button {
            onSelect(sel)
        } label: {
            HStack(spacing: 10) {
                PlayerHeadshot(playerId: sel.playerId, size: 32)
                    .frame(width: 32, height: 32)
                VStack(alignment: .leading, spacing: 2) {
                    Text(sel.playerName)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.appTextPrimary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                    Text(subtitle)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Color.appTextSecondary)
                        .lineLimit(1)
                }
                Spacer(minLength: 8)
                VStack(alignment: .trailing, spacing: 2) {
                    Text("\(MLBPlayerProps.marketLabel(row.market)) \(MLBPlayerProps.formatLine(computed.line))")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Color.appTextPrimary)
                        .lineLimit(1)
                    Text("L10 \(computed.l10.pctLabel)")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(hitColor)
                }
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.appTextMuted)
            }
            .padding(.vertical, 9)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .matchedTransitionSource(id: sel.transitionID, in: namespace)
        .sensoryFeedback(.impact(weight: .light), trigger: sel.id)
    }

    private var subtitle: String {
        let opp = sel.opponentAbbr.isEmpty ? "" : "vs \(sel.opponentAbbr)"
        if roleLabel.isEmpty { return opp }
        return opp.isEmpty ? roleLabel : "\(roleLabel) · \(opp)"
    }
}

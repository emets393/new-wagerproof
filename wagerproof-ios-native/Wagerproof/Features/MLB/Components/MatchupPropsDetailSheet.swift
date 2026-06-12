import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Full team-grouped player-prop list for one matchup — the expand target of
/// the game sheet's `MLBMatchupPropsWidget` digest. The list body is the old
/// widget body relocated verbatim (away group / home group, 16pt logo headers
/// + counts, divider rows); reusable so Search's props destination can host it
/// inside its own NavigationStack too.
struct MatchupPropsListBody: View {
    let matchup: MLBPropMatchup
    /// When the host's push destination declares a zoom transition, rows
    /// register as matched sources here; nil hosts get plain pushes.
    var zoomNamespace: Namespace.ID? = nil
    let onSelect: (PlayerPropSelection) -> Void

    private var items: [PlayerPropFeedItem] {
        PlayerPropFeed.items(from: [matchup])
    }
    private var awayItems: [PlayerPropFeedItem] {
        items.filter { $0.selection.teamAbbr == matchup.awayAbbr }
    }
    private var homeItems: [PlayerPropFeedItem] {
        items.filter { $0.selection.teamAbbr == matchup.homeAbbr }
    }
    // Extra (bench/pinch-hit) batters get teamAbbr "" from PlayerPropFeed, so
    // they'd vanish from both team groups while the widget footer's
    // totalProps count still advertises them — render them in a third group.
    private var extraItems: [PlayerPropFeedItem] {
        items.filter {
            $0.selection.teamAbbr != matchup.awayAbbr && $0.selection.teamAbbr != matchup.homeAbbr
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            teamGroup(abbr: matchup.awayAbbr, logo: matchup.awayLogoUrl, items: awayItems)
            teamGroup(abbr: matchup.homeAbbr, logo: matchup.homeLogoUrl, items: homeItems)
            teamGroup(abbr: "More props", logo: nil, items: extraItems)
        }
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
                    if let ns = zoomNamespace {
                        MatchupPropListRow(item: item, onSelect: onSelect)
                            .matchedTransitionSource(id: item.selection.transitionID, in: ns)
                    } else {
                        MatchupPropListRow(item: item, onSelect: onSelect)
                    }
                }
            }
        }
    }
}

/// Modal expand target presented from the MLB game sheet. Owns its own
/// NavigationStack + zoom namespace so player rows can push the full
/// `PlayerPropDetailView` inside the sheet.
struct MatchupPropsDetailSheet: View {
    let matchup: MLBPropMatchup

    @State private var selectedProp: PlayerPropSelection?
    @Namespace private var propNS

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 8) {
                    header
                    MatchupPropsListBody(matchup: matchup, zoomNamespace: propNS) { selectedProp = $0 }
                        .padding(.horizontal, 16)
                }
                .padding(.bottom, 32)
            }
            .background(Color.appSurface)
            .navigationDestination(item: $selectedProp) { selection in
                PlayerPropDetailView(selection: selection)
                    .navigationTransition(.zoom(sourceID: selection.transitionID, in: propNS))
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("\(matchup.awayAbbr) @ \(matchup.homeAbbr) · Player Props")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)
            Text("\(MLBFormatting.dateLabel(matchup.officialDate)) · \(MLBFormatting.gameTime(matchup.gameTimeEt))")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
        }
        .padding(.horizontal, 16)
        .padding(.top, 20)
    }
}

/// Compact tappable player row — headshot, name, role/opponent, best-market
/// line, and L10 hit-rate. Relocated from the old widget body; the host body
/// registers each row as a zoom source when it has a namespace.
private struct MatchupPropListRow: View {
    let item: PlayerPropFeedItem
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
        .sensoryFeedback(.impact(weight: .light), trigger: sel.id)
    }

    private var subtitle: String {
        let opp = sel.opponentAbbr.isEmpty ? "" : "vs \(sel.opponentAbbr)"
        if roleLabel.isEmpty { return opp }
        return opp.isEmpty ? roleLabel : "\(roleLabel) · \(opp)"
    }
}

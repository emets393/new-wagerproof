import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Full team-grouped player-prop list for one NFL matchup — expand target of
/// `NFLMatchupPropsWidget`. Owns its own NavigationStack so rows can push
/// `NFLPropDetailView` inside the sheet.
struct NFLMatchupPropsDetailSheet: View {
    let awayTeam: String
    let homeTeam: String

    @Environment(PropsStore.self) private var propsStore
    @State private var selectedProp: NFLPlayerPropSelection?
    @Namespace private var propNS

    private var awayAbbr: String { NFLTeams.abbr(for: awayTeam) }
    private var homeAbbr: String { NFLTeams.abbr(for: homeTeam) }

    private var items: [NFLPropFeedItem] {
        NFLPropFeed.items(from: propsStore.nflPlayers(matchingAway: awayTeam, home: homeTeam))
    }

    private var awayItems: [NFLPropFeedItem] {
        items.filter { NFLTeams.matches($0.player.team ?? "", awayTeam) }
    }

    private var homeItems: [NFLPropFeedItem] {
        items.filter { NFLTeams.matches($0.player.team ?? "", homeTeam) }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 8) {
                    header
                    VStack(spacing: 0) {
                        teamGroup(abbr: awayAbbr, items: awayItems)
                        teamGroup(abbr: homeAbbr, items: homeItems)
                    }
                    .padding(.horizontal, 16)
                }
                .padding(.bottom, 32)
            }
            .background(Color.appSurface)
            .navigationDestination(item: $selectedProp) { selection in
                NFLPropDetailView(selection: selection)
                    .navigationTransition(.zoom(sourceID: selection.transitionID, in: propNS))
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("\(awayAbbr) @ \(homeAbbr) · Player Props")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)
            Text("\(items.count) players")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
        }
        .padding(.horizontal, 16)
        .padding(.top, 20)
    }

    @ViewBuilder
    private func teamGroup(abbr: String, items: [NFLPropFeedItem]) -> some View {
        if !items.isEmpty {
            VStack(spacing: 0) {
                HStack(spacing: 6) {
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
                    NFLMatchupPropListRow(item: item) { selectedProp = $0 }
                        .matchedTransitionSource(id: item.selection.transitionID, in: propNS)
                }
            }
        }
    }
}

private struct NFLMatchupPropListRow: View {
    let item: NFLPropFeedItem
    let onSelect: (NFLPlayerPropSelection) -> Void

    @Environment(\.colorScheme) private var colorScheme

    private var market: NFLPropMarket { item.displayMarket }
    private var tint: Color {
        guard let rate = market.l10HitRate, market.l10Hits.n >= InsightThresholds.propSampleMin else {
            return Color.appTextSecondary
        }
        let pct = rate * 100
        if pct >= InsightThresholds.propHot { return Color.appWin }
        if pct <= InsightThresholds.propCold { return Color.appAccentBlue }
        if pct >= 55 { return Color.appAccentAmber }
        return Color.appTextSecondary
    }

    var body: some View {
        Button { onSelect(item.selection) } label: {
            HStack(spacing: 10) {
                NFLPlayerHeadshot(
                    playerName: item.player.playerName,
                    playerId: item.player.playerId,
                    headshotUrl: item.player.headshotUrl,
                    size: 32
                )
                .frame(width: 32, height: 32)
                .overlay(
                    Circle().stroke(
                        NFLTeamColors.colors(for: item.player.team ?? "").primary
                            .teamVisible(in: colorScheme).opacity(0.8),
                        lineWidth: 1.5
                    )
                )

                VStack(alignment: .leading, spacing: 2) {
                    Text(item.player.playerName)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Color.appTextPrimary)
                        .lineLimit(1)
                    Text(subtitle)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Color.appTextSecondary)
                        .lineLimit(1)
                }

                Spacer(minLength: 6)

                VStack(alignment: .trailing, spacing: 0) {
                    Text(pctLabel)
                        .font(.system(size: 16, weight: .heavy, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(tint)
                    Text(fractionLabel)
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(Color.appTextMuted)
                }

                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Color.appTextMuted)
            }
            .padding(.vertical, 10)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private var subtitle: String {
        if market.isYesNo {
            return "\(market.label) · Yes \(NFLPlayerProps.formatOdds(market.overPrice))"
        }
        return "\(market.label) · Over \(NFLPlayerProps.formatLine(market.closeLine))"
    }

    private var pctLabel: String {
        guard let rate = market.l10HitRate else { return "—" }
        return "\(Int((rate * 100).rounded()))%"
    }

    private var fractionLabel: String {
        let (hits, n) = market.l10Hits
        guard n > 0 else { return "—" }
        return "\(hits)/\(n) L10"
    }
}

import SwiftUI
import Charts
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Player-props digest for the NFL game-detail sheet.
///
/// Live 2026 path: `nfl_prop_player_pages` + trend game logs. The strongest
/// qualified L10 signal gets a values-vs-line chart; remaining signals stay
/// compact and tappable. Full team-grouped depth is `NFLMatchupPropsDetailSheet`.
struct NFLMatchupPropsWidget: View {
    let awayTeam: String
    let homeTeam: String
    let namespace: Namespace.ID
    let onSelect: (NFLPlayerPropSelection) -> Void
    let onExpand: () -> Void

    @Environment(PropsStore.self) private var propsStore

    var body: some View {
        if let summary = propsStore.nflPropsInsight(matchingAway: awayTeam, home: homeTeam) {
            let itemsById = itemsByPlayerId
            InsightWidgetSection(
                title: "Player Props",
                systemImage: "figure.american.football",
                iconTint: Color.appPrimary,
                badge: summary.badge,
                expandLabel: "All \(summary.totalProps) props",
                onExpand: onExpand
            ) {
                VStack(alignment: .leading, spacing: 16) {
                    Text(summary.headline)
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(Color.appTextPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityLabel("Player props summary: \(summary.headline)")

                    Label(summary.explainer, systemImage: "chart.bar.fill")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)

                    if let featuredId = summary.featuredPlayerId,
                       let signal = summary.signals.first(where: { $0.playerId == featuredId }),
                       let item = itemsById[featuredId] {
                        FeaturedNFLPropSignalCard(signal: signal, item: item) {
                            onSelect(selection(for: item, market: signal.market.market))
                        }
                        .matchedTransitionSource(id: item.selection.transitionID, in: namespace)
                    }

                    let secondary = summary.signals.filter { $0.playerId != summary.featuredPlayerId }
                    if !secondary.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(summary.featuredPlayerId == nil ? "POSTED PROP SIGNALS" : "OTHER POSTED PROP SIGNALS")
                                .font(.system(size: 9, weight: .bold))
                                .tracking(0.7)
                                .foregroundStyle(Color.appTextMuted)

                            VStack(spacing: 8) {
                                ForEach(secondary) { signal in
                                    if let item = itemsById[signal.playerId] {
                                        NFLPropSignalRow(signal: signal, item: item) {
                                            onSelect(selection(for: item, market: signal.market.market))
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
    }

    private var itemsByPlayerId: [String: NFLPropFeedItem] {
        let players = propsStore.nflPlayers(matchingAway: awayTeam, home: homeTeam)
        return Dictionary(
            NFLPropFeed.items(from: players).map { item in
                (item.player.playerId ?? item.player.playerName, item)
            },
            uniquingKeysWith: { first, _ in first }
        )
    }

    private func selection(for item: NFLPropFeedItem, market: String) -> NFLPlayerPropSelection {
        NFLPlayerPropSelection(
            player: item.player,
            preferredMarket: market,
            transitionID: item.selection.transitionID
        )
    }
}

// MARK: - Featured signal

private struct FeaturedNFLPropSignalCard: View {
    let signal: NFLPropSignal
    let item: NFLPropFeedItem
    let onTap: () -> Void

    @Environment(\.colorScheme) private var colorScheme

    private var market: NFLPropMarket { signal.market }
    private var tint: Color { nflPropRateTint(market) }
    private var teamColors: NFLTeamColors.Pair {
        NFLTeamColors.colors(for: signal.teamAbbr)
    }

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 10) {
                    NFLPlayerHeadshot(
                        playerName: signal.playerName,
                        playerId: signal.playerId,
                        headshotUrl: signal.headshotUrl,
                        size: 40
                    )
                    .frame(width: 40, height: 40)
                    .overlay(
                        Circle().stroke(teamColors.primary.teamVisible(in: colorScheme).opacity(0.85), lineWidth: 1.5)
                    )

                    VStack(alignment: .leading, spacing: 2) {
                        Text(signal.playerName)
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(Color.appTextPrimary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                        Text(playerContext)
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(Color.appTextSecondary)
                    }

                    Spacer(minLength: 8)

                    VStack(alignment: .trailing, spacing: 0) {
                        Text(pctLabel)
                            .font(.system(size: 24, weight: .heavy, design: .rounded))
                            .monospacedDigit()
                            .foregroundStyle(tint)
                        Text("\(fractionLabel) over")
                            .font(.system(size: 9, weight: .semibold))
                            .foregroundStyle(Color.appTextMuted)
                    }

                    Image(systemName: "chevron.right")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Color.appTextMuted)
                }

                HStack(spacing: 7) {
                    Text(market.label)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Color.appTextPrimary)
                        .lineLimit(1)

                    Text(sidePill)
                        .font(.system(size: 9, weight: .heavy, design: .rounded))
                        .tracking(0.35)
                        .foregroundStyle(tint)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(tint.opacity(0.13), in: Capsule())

                    Spacer(minLength: 4)

                    let odds = NFLPlayerProps.formatOdds(market.overPrice)
                    if odds != "-" {
                        Text(odds)
                            .font(.system(size: 10, weight: .bold, design: .monospaced))
                            .foregroundStyle(Color.appTextSecondary)
                    }
                }

                NFLPropEvidenceChart(
                    games: Array(market.recentGames.suffix(10)),
                    line: market.closeLine ?? (market.isYesNo ? 0.5 : market.clearThreshold),
                    isYesNo: market.isYesNo
                )

                HStack(spacing: 18) {
                    nflPropStat(label: "RECENT", value: pctLabel, tint: tint)
                    nflPropStat(label: "L10", value: fractionLabel, tint: Color.appTextPrimary)
                    Spacer(minLength: 0)
                    chartLegend
                }
            }
            .padding(12)
            .background(
                Color.appSurfaceMuted.opacity(0.30),
                in: RoundedRectangle(cornerRadius: 14, style: .continuous)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(Color.appBorder.opacity(0.50), lineWidth: 0.75)
            )
            .contentShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.impact(weight: .light), trigger: item.selection.id)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
            "\(signal.playerName), \(market.label), \(sidePill), \(fractionLabel) recent games over, \(pctLabel)"
        )
        .accessibilityHint("Opens this player's prop details")
    }

    private var playerContext: String {
        let opp = signal.opponent.map { opponent in
            let prefix = signal.isHome == true ? "vs" : "@"
            return "\(prefix) \(NFLTeams.abbr(for: opponent))"
        }
        return [signal.teamAbbr, signal.position, opp]
            .compactMap { $0 }
            .filter { !$0.isEmpty }
            .joined(separator: " · ")
    }

    private var pctLabel: String {
        guard let rate = market.l10HitRate else { return "—" }
        return "\(Int((rate * 100).rounded()))%"
    }

    private var fractionLabel: String {
        let (hits, n) = market.l10Hits
        guard n > 0 else { return "—" }
        return "\(hits)/\(n)"
    }

    private var sidePill: String {
        if market.isYesNo {
            return "YES \(NFLPlayerProps.formatOdds(market.overPrice))"
        }
        return "OVER \(NFLPlayerProps.formatLine(market.closeLine))"
    }

    private var chartLegend: some View {
        HStack(spacing: 9) {
            legendItem("Above", color: .appWin)
            legendItem("At/below", color: .appAccentBlue)
        }
    }

    private func legendItem(_ text: String, color: Color) -> some View {
        HStack(spacing: 3) {
            RoundedRectangle(cornerRadius: 2, style: .continuous)
                .fill(color)
                .frame(width: 7, height: 7)
            Text(text)
                .font(.system(size: 8, weight: .semibold))
                .foregroundStyle(Color.appTextMuted)
        }
    }
}

private func nflPropStat(label: String, value: String, tint: Color) -> some View {
    VStack(alignment: .leading, spacing: 1) {
        Text(label)
            .font(.system(size: 8, weight: .bold))
            .tracking(0.6)
            .foregroundStyle(Color.appTextMuted)
        Text(value)
            .font(.system(size: 12, weight: .bold, design: .rounded))
            .monospacedDigit()
            .foregroundStyle(tint)
    }
}

private struct NFLPropEvidenceChart: View {
    let games: [NFLPropRecentGame]
    let line: Double
    let isYesNo: Bool

    private struct Bar: Identifiable {
        let id: Int
        let opp: String
        let value: Double
        let cleared: Bool
    }

    private var bars: [Bar] {
        games.enumerated().compactMap { index, game in
            guard let value = game.actual else { return nil }
            return Bar(
                id: index,
                opp: game.opp ?? "W\(game.week ?? 0)",
                value: value,
                cleared: value > line
            )
        }
    }

    private var maxValue: Double {
        max(line * 1.5, bars.map(\.value).max() ?? 0, line + 1, 1)
    }

    private var labelIds: [Int] {
        guard !bars.isEmpty else { return [] }
        return Array(Set([0, bars.count / 2, bars.count - 1])).sorted()
    }

    var body: some View {
        if bars.isEmpty {
            Text("No recent game results")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Color.appTextMuted)
                .frame(maxWidth: .infinity, minHeight: 96)
        } else {
            Chart {
                ForEach(bars) { bar in
                    BarMark(
                        x: .value("Game", String(bar.id)),
                        y: .value("Result", bar.value),
                        width: .ratio(0.56)
                    )
                    .cornerRadius(3)
                    .foregroundStyle(bar.cleared ? Color.appWin : Color.appAccentBlue.opacity(0.72))
                    .annotation(position: .top, spacing: 2) {
                        Text(formatBar(bar.value))
                            .font(.system(size: 7, weight: .bold, design: .rounded))
                            .monospacedDigit()
                            .foregroundStyle(bar.cleared ? Color.appWin : Color.appAccentBlue)
                    }
                }

                RuleMark(y: .value("Posted line", line))
                    .lineStyle(StrokeStyle(lineWidth: 1.25, dash: [4, 3]))
                    .foregroundStyle(Color.appAccentAmber)
                    .annotation(position: .top, alignment: .trailing, spacing: 2) {
                        Text(isYesNo ? "TD" : "LINE \(NFLPlayerProps.formatLine(line))")
                            .font(.system(size: 7, weight: .heavy, design: .rounded))
                            .tracking(0.35)
                            .foregroundStyle(Color.appAccentAmber)
                    }
            }
            .chartXScale(domain: bars.map { String($0.id) })
            .chartYScale(domain: 0...maxValue)
            .chartYAxis(.hidden)
            .chartXAxis {
                AxisMarks(values: labelIds.map(String.init)) { value in
                    AxisTick().foregroundStyle(Color.appBorder.opacity(0.4))
                    AxisValueLabel {
                        if let idString = value.as(String.self),
                           let id = Int(idString),
                           let bar = bars.first(where: { $0.id == id }) {
                            Text(bar.opp)
                                .font(.system(size: 8, weight: .medium))
                                .foregroundStyle(Color.appTextMuted)
                        }
                    }
                }
            }
            .chartPlotStyle { plot in
                plot
                    .background(Color.appSurface.opacity(0.28))
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            }
            .frame(height: 112)
            .accessibilityHidden(true)
        }
    }

    private func formatBar(_ value: Double) -> String {
        if isYesNo { return value >= 1 ? "Y" : "N" }
        return value == value.rounded() ? String(Int(value)) : String(format: "%.1f", value)
    }
}

// MARK: - Secondary signals

private struct NFLPropSignalRow: View {
    let signal: NFLPropSignal
    let item: NFLPropFeedItem
    let onTap: () -> Void

    @Environment(\.colorScheme) private var colorScheme

    private var market: NFLPropMarket { signal.market }
    private var tint: Color { nflPropRateTint(market) }
    private var teamColors: NFLTeamColors.Pair {
        NFLTeamColors.colors(for: signal.teamAbbr)
    }

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 8) {
                HStack(spacing: 10) {
                    NFLPlayerHeadshot(
                        playerName: signal.playerName,
                        playerId: signal.playerId,
                        headshotUrl: signal.headshotUrl,
                        size: 30
                    )
                    .frame(width: 30, height: 30)
                    .overlay(
                        Circle().stroke(teamColors.primary.teamVisible(in: colorScheme).opacity(0.8), lineWidth: 1.5)
                    )

                    VStack(alignment: .leading, spacing: 2) {
                        Text(signal.playerName)
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(Color.appTextPrimary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                        Text(subtitle)
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(Color.appTextSecondary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.75)
                    }

                    Spacer(minLength: 6)

                    VStack(alignment: .trailing, spacing: 0) {
                        Text(pctLabel)
                            .font(.system(size: 17, weight: .heavy, design: .rounded))
                            .monospacedDigit()
                            .foregroundStyle(tint)
                        Text("\(fractionLabel) over")
                            .font(.system(size: 8, weight: .semibold))
                            .foregroundStyle(Color.appTextMuted)
                    }

                    Image(systemName: "chevron.right")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(Color.appTextMuted)
                }

                NFLPropRecentOutcomeTrack(strip: market.miniStrip)
            }
            .padding(10)
            .background(
                Color.appSurfaceMuted.opacity(0.24),
                in: RoundedRectangle(cornerRadius: 12, style: .continuous)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(Color.appBorder.opacity(0.42), lineWidth: 0.75)
            )
            .contentShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.impact(weight: .light), trigger: item.selection.id)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
            "\(signal.playerName), \(market.label), \(subtitle), \(fractionLabel) recent games over, \(pctLabel)"
        )
        .accessibilityHint("Opens this player's prop details")
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
        return "\(hits)/\(n)"
    }
}

private struct NFLPropRecentOutcomeTrack: View {
    let strip: [(cleared: Bool, value: Double)]

    var body: some View {
        GeometryReader { geometry in
            let count = max(strip.count, 1)
            let gap: CGFloat = 3
            let width = max(2, (geometry.size.width - gap * CGFloat(count - 1)) / CGFloat(count))

            HStack(spacing: gap) {
                ForEach(Array(strip.enumerated()), id: \.offset) { _, result in
                    RoundedRectangle(cornerRadius: 3, style: .continuous)
                        .fill(result.cleared ? Color.appWin : Color.appAccentBlue.opacity(0.66))
                        .frame(width: width)
                }
            }
            .frame(width: geometry.size.width, height: geometry.size.height)
        }
        .frame(height: 7)
        .accessibilityHidden(true)
    }
}

private func nflPropRateTint(_ market: NFLPropMarket) -> Color {
    let (hits, n) = market.l10Hits
    guard n >= InsightThresholds.propSampleMin, let rate = market.l10HitRate else {
        return Color.appTextSecondary
    }
    let pct = rate * 100
    if pct >= InsightThresholds.propHot { return Color.appWin }
    if pct <= InsightThresholds.propCold { return Color.appAccentBlue }
    if pct >= 55 { return Color.appAccentAmber }
    _ = hits
    return Color.appTextSecondary
}

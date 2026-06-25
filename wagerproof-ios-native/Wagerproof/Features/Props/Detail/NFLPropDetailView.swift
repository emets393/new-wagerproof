import SwiftUI
import Charts
import WagerproofModels
import WagerproofDesign

/// Full-page NFL player-prop detail, styled like the MLB prop detail
/// (`PlayerPropDetailView`): a `CollapsingWidgetScroll` hero over a
/// `TeamAuraBackground`, one collapsing `WidgetCollapsingSection` per market.
///
/// The dry-run contract carries a season game log + consensus close per
/// market, so each market widget is a trend board: recent-games bar chart
/// against the close line, season splits, defense matchup index, and the
/// open→close line move. The pinned segmented picker jumps between markets.
struct NFLPropDetailView: View {
    let selection: NFLPlayerPropSelection

    @State private var activeMarket: String
    @State private var selectedSignal: NFLPropSignalDefinition?

    private var player: NFLPropPlayer { selection.player }
    private var markets: [NFLPropMarket] { player.markets }

    // Sized to fit the hero content snugly (top row + identity + picker),
    // matching the MLB detail's proportions.
    private let heroMax: CGFloat = 134
    private let heroMin: CGFloat = 116

    init(selection: NFLPlayerPropSelection) {
        self.selection = selection
        let preferred = selection.preferredMarket
        let initial = preferred.flatMap { m in
            selection.player.markets.first { $0.market == m }?.market
        }
        ?? selection.player.markets.first { !$0.flags.isEmpty }?.market
        ?? selection.player.markets.first?.market
        ?? ""
        _activeMarket = State(initialValue: initial)
    }

    private var teamColor: Color {
        NFLTeamColors.colors(for: player.team ?? "").primary
    }
    private var oppColor: Color {
        NFLTeamColors.colors(for: player.opponent ?? "").primary
    }

    var body: some View {
        GeometryReader { root in
            ScrollViewReader { proxy in
                CollapsingWidgetScroll(heroMaxHeight: heroMax, heroMinHeight: heroMin) { progress in
                    TeamAuraBackground(awayColor: teamColor, homeColor: oppColor, progress: progress)
                } hero: { progress in
                    heroView(progress: progress, proxy: proxy, viewportHeight: root.size.height)
                } content: {
                    // Eager VStack — a player only carries a handful of markets,
                    // and LazyVStack + scrollTo on open skipped off-screen widgets
                    // so the page looked like a single-market detail sheet.
                    VStack(spacing: 0) {
                        ForEach(markets) { market in
                            marketWidget(market)
                        }
                        footnote
                    }
                    .task(id: selection.id) {
                        await scrollToPreferredMarket(proxy, viewportHeight: root.size.height)
                    }
                }
            }
        }
        .toolbarBackground(.hidden, for: .navigationBar)
        // Name lives permanently in the hero — keep the nav title empty.
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $selectedSignal) { signal in
            NFLPropSignalDetailSheet(signal: signal)
        }
    }

    // MARK: - Collapsing hero

    @ViewBuilder
    private func heroView(progress p: CGFloat, proxy: ScrollViewProxy, viewportHeight: CGFloat) -> some View {
        let headSize = lerp(50, 32, p)
        let detail = Double(max(0, 1 - p * 1.9))

        VStack(spacing: lerp(8, 6, p)) {
            heroTopRow
            HStack(alignment: .center, spacing: 12) {
                NFLPlayerHeadshot(playerName: player.playerName, playerId: player.playerId, headshotUrl: player.headshotUrl, size: headSize)
                    .padding(4)
                    .teamGlassDisc(primary: teamColor, secondary: oppColor)
                    .shadow(color: teamColor.opacity(0.35), radius: 8)
                VStack(alignment: .leading, spacing: 2) {
                    Text(player.playerName)
                        .font(.system(size: lerp(19, 16, p), weight: .heavy))
                        .foregroundStyle(Color.appTextPrimary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                    if detail > 0.04 {
                        Text(subtitle)
                            .font(.system(size: 11))
                            .foregroundStyle(Color.appTextSecondary)
                            .lineLimit(1)
                            .opacity(detail)
                    }
                }
                Spacer(minLength: 0)
                priceBadge(detail: detail, progress: p)
            }
            if markets.count > 1 {
                marketPicker(proxy: proxy, viewportHeight: viewportHeight)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .frame(maxWidth: .infinity, alignment: .top)
    }

    private var heroTopRow: some View {
        HStack(spacing: 8) {
            if let week = player.week {
                Text("Week \(week)")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Color.appTextSecondary)
            }
            if !player.opponentLabel.isEmpty {
                Text(player.opponentLabel)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Color.appTextSecondary)
            }
            Spacer()
            Text(heroDateLabel)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
        }
    }

    private var heroDateLabel: String {
        let date = MLBFormatting.dateLabel(player.gameDate)
        if let slot = player.slotLabel { return "\(date) · \(slot)" }
        return date
    }

    /// Hero stat slot (MLB shows L10 hit rate here): the active market's
    /// consensus over price, rolling as the picker/scroll changes markets.
    @ViewBuilder
    private func priceBadge(detail: Double, progress: CGFloat) -> some View {
        let market = markets.first { $0.market == activeMarket } ?? markets.first
        VStack(alignment: .trailing, spacing: 1) {
            Text(NFLPlayerProps.formatOdds(market?.overPrice))
                .font(.system(size: lerp(24, 19, progress), weight: .heavy, design: .monospaced))
                .foregroundStyle(Color.appPrimary)
                .contentTransition(.numericText())
                .animation(.snappy(duration: 0.28), value: activeMarket)
            if detail > 0.04, let market {
                Text(market.isYesNo
                     ? "Anytime TD · \(NFLPlayerProps.formatPct(market.closeYesProb)) implied"
                     : "Over \(NFLPlayerProps.formatLine(market.closeLine)) · \(market.nBooks ?? 0) books")
                    .font(.system(size: 10))
                    .foregroundStyle(Color.appTextSecondary)
                    .opacity(detail)
            }
        }
    }

    private func marketPicker(proxy: ScrollViewProxy, viewportHeight: CGFloat) -> some View {
        Picker("Market", selection: pickerBinding(proxy: proxy, viewportHeight: viewportHeight)) {
            ForEach(markets) { market in
                Text(market.label).tag(market.market)
            }
        }
        .pickerStyle(.segmented)
        .sensoryFeedback(.selection, trigger: activeMarket)
    }

    private func pickerBinding(proxy: ScrollViewProxy, viewportHeight: CGFloat) -> Binding<String> {
        Binding(
            get: { activeMarket },
            set: { market in
                activeMarket = market
                scrollToMarket(market, proxy: proxy, viewportHeight: viewportHeight)
            }
        )
    }

    /// Y anchor that lands the widget header flush under the collapsed hero.
    private func scrollAnchorY(viewportHeight: CGFloat) -> CGFloat {
        min(0.4, max(0.05, heroMin / max(viewportHeight, 1)))
    }

    /// Land on the feed card's headline market when the detail page opens.
    private func scrollToPreferredMarket(_ proxy: ScrollViewProxy, viewportHeight: CGFloat) async {
        guard markets.count > 1, !activeMarket.isEmpty else { return }
        // Let the zoom transition finish and LazyVStack materialize off-screen widgets.
        try? await Task.sleep(for: .milliseconds(380))
        scrollToMarket(
            activeMarket,
            proxy: proxy,
            viewportHeight: viewportHeight,
            animated: true
        )
    }

    private func scrollToMarket(
        _ market: String,
        proxy: ScrollViewProxy,
        viewportHeight: CGFloat,
        animated: Bool = true
    ) {
        guard markets.contains(where: { $0.market == market }) else { return }
        let anchor = UnitPoint(x: 0.5, y: scrollAnchorY(viewportHeight: viewportHeight))
        if animated {
            withAnimation(.smooth(duration: 0.45)) {
                proxy.scrollTo(market, anchor: anchor)
            }
        } else {
            proxy.scrollTo(market, anchor: anchor)
        }
    }

    private var subtitle: String {
        var parts: [String] = []
        if let pos = player.position, !pos.isEmpty { parts.append(pos) }
        if let team = player.team { parts.append(team) }
        if let status = player.reportStatus, !status.isEmpty { parts.append(status) }
        return parts.joined(separator: " · ")
    }

    // MARK: - Per-market collapsing widget (trend board)

    @ViewBuilder
    private func marketWidget(_ market: NFLPropMarket) -> some View {
        VStack(spacing: 0) {
            // Scroll target — pins the card title flush under the collapsed hero.
            Color.clear
                .frame(height: 1)
                .id(market.market)
            WidgetCollapsingSection(title: market.label, systemImage: "chart.bar.fill") {
                VStack(alignment: .leading, spacing: 12) {
                    lineSummary(market)
                    if !market.flags.isEmpty {
                        NFLPropSignalGroup(flags: market.flags) { selectedSignal = $0 }
                    }
                    NFLPropTrendChart(games: market.recentGames, line: market.clearThreshold, isYesNo: market.isYesNo)
                    statTiles(market)
                    lineMovementRow(market)
                }
            }
        }
    }

    private func lineSummary(_ market: NFLPropMarket) -> some View {
        Group {
            if market.isYesNo {
                Text("Anytime TD pays \(NFLPlayerProps.formatOdds(market.overPrice)) — \(NFLPlayerProps.formatPct(market.closeYesProb)) implied at close across \(market.nBooks ?? 0) books.")
            } else {
                Text("Consensus close \(NFLPlayerProps.formatLine(market.closeLine)) across \(market.nBooks ?? 0) books — Over \(NFLPlayerProps.formatOdds(market.overPrice)) / Under \(NFLPlayerProps.formatOdds(market.underPrice)).")
            }
        }
        .font(.system(size: 13))
        .lineSpacing(3)
        .foregroundStyle(Color.appTextPrimary)
    }

    // MARK: Stat tiles

    private func statTiles(_ market: NFLPropMarket) -> some View {
        let columns = [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())]
        return LazyVGrid(columns: columns, spacing: 8) {
            statTile("LAST", statValue(market.lastGame))
            statTile("L3 AVG", statValue(market.l3Avg))
            statTile("L5 AVG", statValue(market.l5Avg))
            statTile("SZN AVG", statValue(market.sznAvg))
            statTile("SZN HIGH", statValue(market.sznMax))
            statTile("MATCHUP", matchupValue(market.defMatchupIdx), color: matchupColor(market.defMatchupIdx))
        }
    }

    private func statValue(_ v: Double?) -> String {
        guard let v, v.isFinite else { return "-" }
        return v == v.rounded() ? String(Int(v)) : String(format: "%.1f", v)
    }

    /// Defense matchup index: >1 = the opponent allows more than league
    /// average to this position (softer matchup).
    private func matchupValue(_ idx: Double?) -> String {
        guard let idx, idx.isFinite else { return "-" }
        let pct = (idx - 1) * 100
        return String(format: "%+.0f%% vs lg", pct)
    }

    private func matchupColor(_ idx: Double?) -> Color {
        guard let idx else { return Color.appTextPrimary }
        if idx >= 1.08 { return Color.appPrimary }
        if idx <= 0.92 { return Color.appLoss }
        return Color.appTextPrimary
    }

    private func statTile(_ label: String, _ value: String, color: Color = Color.appTextPrimary) -> some View {
        VStack(spacing: 3) {
            Text(label)
                .font(.system(size: 9, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(Color.appTextMuted)
            Text(value)
                .font(.system(size: 15, weight: .bold, design: .monospaced))
                .foregroundStyle(color)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .background(Color.appSurfaceMuted.opacity(0.35), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(Color.appBorder.opacity(0.5), lineWidth: 0.5)
        )
    }

    // MARK: Line movement

    @ViewBuilder
    private func lineMovementRow(_ market: NFLPropMarket) -> some View {
        if market.isYesNo {
            if let open = market.openYesProb, let close = market.closeYesProb {
                movementText("Implied probability moved \(NFLPlayerProps.formatPct(open)) → \(NFLPlayerProps.formatPct(close)) from open to close.")
            }
        } else if let open = market.openLine, let close = market.closeLine {
            let delta = market.lineDelta ?? (close - open)
            let deltaText = delta == 0
                ? "held steady from open"
                : String(format: "moved %+.1f from the open", delta)
            let range = market.lineRange.map { r in
                r > 0 ? " Books were spread across a \(NFLPlayerProps.formatLine(r))-point range." : ""
            } ?? ""
            movementText("Line \(NFLPlayerProps.formatLine(open)) → \(NFLPlayerProps.formatLine(close)) — \(deltaText).\(range)")
        }
    }

    private func movementText(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 12))
            .foregroundStyle(Color.appTextSecondary)
    }

    private var footnote: some View {
        Text("Lines are the consensus close (median across books). Trends are point-in-time season game logs.")
            .font(.system(size: 10))
            .italic()
            .foregroundStyle(Color.appTextMuted)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 20)
            .padding(.vertical, 14)
    }

    private func lerp(_ a: CGFloat, _ b: CGFloat, _ t: CGFloat) -> CGFloat {
        a + (b - a) * t
    }
}

// MARK: - Trend chart

/// Season game-log bar chart against the consensus close line. The NFL analog
/// of the MLB `RecentPropBarChart`, with week-number x-labels instead of
/// dates and no line scrubber (the dry-run publishes one close line, not an
/// alt-line ladder).
struct NFLPropTrendChart: View {
    let games: [NFLPropRecentGame]
    let line: Double
    let isYesNo: Bool

    private struct Bar: Identifiable {
        let id: Int
        let week: Int?
        let opp: String?
        let value: Double
        var cleared: Bool = false
    }

    private var bars: [Bar] {
        games.enumerated().compactMap { i, g in
            guard let v = g.actual else { return nil }
            return Bar(id: i, week: g.week, opp: g.opp, value: v, cleared: v > line)
        }
    }

    private var maxVal: Double {
        let vals = bars.map(\.value)
        return max(line * 1.5, vals.max() ?? 0, line + 1, 1)
    }

    var body: some View {
        if bars.isEmpty {
            Text("No prior games this season")
                .font(.system(size: 13))
                .italic()
                .foregroundStyle(Color.appTextMuted)
                .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            VStack(spacing: 4) {
                chart
                    .frame(height: 168)
                Text("Season game log · oldest left → most recent right")
                    .font(.system(size: 10))
                    .foregroundStyle(Color.appTextMuted)
                    .frame(maxWidth: .infinity)
                    .multilineTextAlignment(.center)
            }
        }
    }

    private var chart: some View {
        Chart {
            ForEach(bars) { bar in
                BarMark(
                    x: .value("Game", String(bar.id)),
                    y: .value("Value", bar.value),
                    width: .ratio(0.62)
                )
                .cornerRadius(2)
                .foregroundStyle(bar.cleared ? Color.appPrimary : Color.appLoss.opacity(0.7))
                .annotation(position: .top, spacing: 2) {
                    Text(barLabel(bar.value))
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(bar.cleared ? Color.appPrimary : Color.appLoss)
                }
            }

            // Dashed threshold: the close line, or the scored-a-TD bar (0.5)
            // for yes/no markets.
            RuleMark(y: .value("Line", line))
                .lineStyle(StrokeStyle(lineWidth: 1.2, dash: [4, 3]))
                .foregroundStyle(Color.appPrimary.opacity(0.85))
                .annotation(position: .top, alignment: .trailing, spacing: 1) {
                    Text(isYesNo ? "TD" : "Line \(NFLPlayerProps.formatLine(line))")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(Color.appPrimary)
                }
        }
        // Fixed domain (oldest→newest) so bars keep game-log order.
        .chartXScale(domain: bars.map { String($0.id) })
        .chartYScale(domain: 0...maxVal)
        .chartYAxis(.hidden)
        .chartXAxis {
            AxisMarks(values: bars.map { String($0.id) }) { value in
                AxisValueLabel(orientation: .vertical) {
                    if let label = value.as(String.self),
                       let id = Int(label),
                       let bar = bars.first(where: { $0.id == id }) {
                        Text(bar.week.map { "W\($0)" } ?? bar.opp ?? "")
                            .font(.system(size: 8))
                            .foregroundStyle(Color.appTextMuted)
                    }
                }
            }
        }
    }

    private func barLabel(_ v: Double) -> String {
        v == v.rounded() ? String(Int(v)) : String(format: "%.1f", v)
    }
}

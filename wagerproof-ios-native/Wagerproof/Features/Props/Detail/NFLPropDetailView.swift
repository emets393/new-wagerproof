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
/// open→close line move. Markets stack vertically — no hero picker.
struct NFLPropDetailView: View {
    let selection: NFLPlayerPropSelection

    @State private var selectedSignal: NFLPropSignalDefinition?
    @State private var metricHelp: NFLPropMetricHelp?

    private var player: NFLPropPlayer { selection.player }
    private var markets: [NFLPropMarket] { player.markets }

    /// Hero price badge — the market the user tapped on the feed, else the
    /// first flagged market, else the first posted market.
    private var headlineMarket: NFLPropMarket? {
        if let preferred = selection.preferredMarket,
           let hit = markets.first(where: { $0.market == preferred }) {
            return hit
        }
        return markets.first { !$0.flags.isEmpty } ?? markets.first
    }

    /// Hero without the market picker — identity row only.
    private let heroMax: CGFloat = 88
    private let heroMin: CGFloat = 72

    init(selection: NFLPlayerPropSelection) {
        self.selection = selection
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
        .sheet(item: $metricHelp) { help in
            NFLPropMetricHelpSheet(help: help)
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

    /// Y anchor that lands the widget header flush under the collapsed hero.
    private func scrollAnchorY(viewportHeight: CGFloat) -> CGFloat {
        min(0.4, max(0.05, heroMin / max(viewportHeight, 1)))
    }

    /// Land on the feed card's headline market when the detail page opens.
    private func scrollToPreferredMarket(_ proxy: ScrollViewProxy, viewportHeight: CGFloat) async {
        guard let target = headlineMarket?.market else { return }
        guard markets.count > 1 else { return }
        try? await Task.sleep(for: .milliseconds(380))
        scrollToMarket(target, proxy: proxy, viewportHeight: viewportHeight, animated: true)
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
                VStack(alignment: .leading, spacing: 20) {
                    propSectionBlock("Posted Line", helpKey: "posted_line", showsDivider: false) {
                        lineSummary(market)
                        if !market.flags.isEmpty {
                            NFLPropSignalGroup(flags: market.flags) { selectedSignal = $0 }
                        }
                    }
                    propSectionBlock("Game Log", helpKey: "game_log") {
                        NFLPropTrendChart(games: market.recentGames, line: market.clearThreshold, isYesNo: market.isYesNo)
                    }
                    if market.hasBestBooks {
                        propSectionBlock("Best Lines", helpKey: "book_odds") {
                            bestBooksSection(market)
                        }
                    }
                    propSectionBlock("Season Stats", helpKey: "season_stats") {
                        statTiles(market)
                    }
                    if hasLineMovement(market) {
                        propSectionBlock("Line Movement", helpKey: "line_movement") {
                            lineMovementRow(market)
                        }
                    }
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

    // MARK: Best books

    private func bestBooksSection(_ market: NFLPropMarket) -> some View {
        VStack(spacing: 8) {
            if market.isYesNo {
                if !market.bestOver.isEmpty {
                    bestBookRow(
                        sideLabel: "Yes",
                        quote: market.bestOver,
                        showLine: false
                    )
                }
            } else {
                if !market.bestOver.isEmpty {
                    bestBookRow(
                        sideLabel: "Over",
                        quote: market.bestOver,
                        showLine: true
                    )
                }
                if !market.bestUnder.isEmpty {
                    bestBookRow(
                        sideLabel: "Under",
                        quote: market.bestUnder,
                        showLine: true
                    )
                }
            }
        }
    }

    private func bestBookRow(sideLabel: String, quote: NFLPropBestQuote, showLine: Bool) -> some View {
        HStack(spacing: 10) {
            HStack(spacing: 6) {
                Text(sideLabel)
                    .font(.system(size: 14, weight: .heavy))
                    .foregroundStyle(Color.appTextPrimary)
                Text(bestBookLineValue(quote: quote, showLine: showLine))
                    .font(.system(size: 14, weight: .heavy, design: .monospaced))
                    .foregroundStyle(Color.appPrimary)
            }

            Spacer(minLength: 8)

            HStack(spacing: 4) {
                Text("@")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.appTextMuted)
                SportsbookLogoView(
                    logoURL: quote.bookLogoUrl,
                    bookKey: quote.bookKey,
                    bookName: quote.bookName,
                    style: .compact
                )
                Text(quote.bookName ?? quote.bookKey ?? "Book")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Color.appTextSecondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Color.appSurfaceMuted.opacity(0.35), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(Color.appBorder.opacity(0.45), lineWidth: 0.5)
        )
    }

    private func bestBookLineValue(quote: NFLPropBestQuote, showLine: Bool) -> String {
        let odds = NFLPlayerProps.formatOdds(quote.price)
        guard showLine, let line = quote.line else { return odds }
        return "\(NFLPlayerProps.formatLine(line)) \(odds)"
    }

    // MARK: Stat tiles

    @ViewBuilder
    private func propSectionBlock<Content: View>(
        _ title: String,
        helpKey: String,
        showsDivider: Bool = true,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            propSectionHeader(title, helpKey: helpKey, showsDivider: showsDivider)
            content()
        }
    }

    private func propSectionHeader(_ title: String, helpKey: String, showsDivider: Bool = true) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            if showsDivider {
                Divider()
                    .overlay(Color.appBorder.opacity(0.55))
            }
            HStack(spacing: 6) {
                Text(title.uppercased())
                    .font(.system(size: 12, weight: .heavy))
                    .tracking(0.6)
                    .foregroundStyle(Color.appTextPrimary)
                Button {
                    metricHelp = NFLPropMetricHelp.all[helpKey]
                } label: {
                    Image(systemName: "info.circle")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Color.appTextSecondary)
                        .frame(width: 22, height: 22)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                Spacer(minLength: 0)
            }
        }
    }

    private func hasLineMovement(_ market: NFLPropMarket) -> Bool {
        if market.isYesNo {
            return market.openYesProb != nil && market.closeYesProb != nil
        }
        return market.openLine != nil && market.closeLine != nil
    }

    private func statTiles(_ market: NFLPropMarket) -> some View {
        let columns = [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())]
        return LazyVGrid(columns: columns, spacing: 8) {
            statTile(helpKey: "last_game", title: "Last Game", value: statValue(market.lastGame))
            statTile(helpKey: "l3_avg", title: "L3 Avg", value: statValue(market.l3Avg))
            statTile(helpKey: "l5_avg", title: "L5 Avg", value: statValue(market.l5Avg))
            statTile(helpKey: "szn_avg", title: "Season Avg", value: statValue(market.sznAvg))
            statTile(helpKey: "szn_high", title: "Season High", value: statValue(market.sznMax))
            statTile(
                helpKey: "opp_defense",
                title: "Opp Defense",
                value: matchupValue(market.defMatchupIdx, opponent: player.opponent),
                color: matchupColor(market.defMatchupIdx)
            )
        }
    }

    private func statValue(_ v: Double?) -> String {
        guard let v, v.isFinite else { return "-" }
        return v == v.rounded() ? String(Int(v)) : String(format: "%.1f", v)
    }

    /// How much this opponent allows to the player's position for this prop
    /// stat, vs league average entering the week.
    private func matchupValue(_ idx: Double?, opponent: String?) -> String {
        guard let idx, idx.isFinite else { return "—" }
        let pct = (idx - 1) * 100
        if let opponent, !opponent.isEmpty {
            let abbr = NFLTeamAssets.abbr(for: opponent)
            return String(format: "%@ %+.0f%%", abbr, pct)
        }
        return String(format: "%+.0f%% vs avg", pct)
    }

    private func matchupColor(_ idx: Double?) -> Color {
        guard let idx else { return Color.appTextPrimary }
        if idx >= 1.08 { return Color.appPrimary }
        if idx <= 0.92 { return Color.appLoss }
        return Color.appTextPrimary
    }

    private func statTile(
        helpKey: String,
        title: String,
        value: String,
        color: Color = Color.appTextPrimary
    ) -> some View {
        Button {
            metricHelp = NFLPropMetricHelp.all[helpKey]
        } label: {
            VStack(spacing: 4) {
                HStack(spacing: 3) {
                    Text(title.uppercased())
                        .font(.system(size: 9, weight: .bold))
                        .tracking(0.4)
                        .foregroundStyle(Color.appTextMuted)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                    Image(systemName: "info.circle")
                        .font(.system(size: 8, weight: .semibold))
                        .foregroundStyle(Color.appTextSecondary.opacity(0.85))
                }
                Text(value)
                    .font(.system(size: 14, weight: .bold, design: .monospaced))
                    .foregroundStyle(color)
                    .lineLimit(2)
                    .minimumScaleFactor(0.65)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .padding(.horizontal, 4)
            .background(Color.appSurfaceMuted.opacity(0.35), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(Color.appBorder.opacity(0.5), lineWidth: 0.5)
            )
        }
        .buttonStyle(.plain)
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
            VStack(spacing: 6) {
                chart
                    .frame(height: 176)
                logoRow
                Text("Season game log · oldest left → most recent right")
                    .font(.system(size: 10))
                    .foregroundStyle(Color.appTextMuted)
                    .frame(maxWidth: .infinity)
                    .multilineTextAlignment(.center)
            }
        }
    }

    /// Logos + week labels sit below the plot so bars never overlap them.
    private var logoRow: some View {
        HStack(spacing: 0) {
            ForEach(bars) { bar in
                NFLPropTrendChartAxisLabel(opp: bar.opp, week: bar.week)
                    .frame(maxWidth: .infinity)
            }
        }
        .frame(height: 40)
        .padding(.horizontal, 2)
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
                .annotation(position: .top, alignment: .leading, spacing: 2) {
                    Text(isYesNo ? "TD" : "Line \(NFLPlayerProps.formatLine(line))")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(Color.appPrimary)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.appSurface.opacity(0.92), in: Capsule())
                        .overlay(Capsule().stroke(Color.appPrimary.opacity(0.35), lineWidth: 0.6))
                }
        }
        // Fixed domain (oldest→newest) so bars keep game-log order.
        .chartXScale(domain: bars.map { String($0.id) })
        .chartYScale(domain: 0...maxVal)
        .chartPlotStyle { plot in
            plot.padding(.top, 16)
        }
        .chartYAxis(.hidden)
        .chartXAxis(.hidden)
    }

    private func barLabel(_ v: Double) -> String {
        v == v.rounded() ? String(Int(v)) : String(format: "%.1f", v)
    }
}

/// Compact opponent logo + week label under each bar in the season game log.
private struct NFLPropTrendChartAxisLabel: View {
    let opp: String?
    let week: Int?

    var body: some View {
        VStack(spacing: 3) {
            if let opp, !opp.isEmpty {
                GameCardTeamAvatar(
                    teamName: NFLTeamAssets.abbr(for: opp),
                    sport: "nfl",
                    size: 20,
                    colors: NFLTeamColors.colorPair(for: opp)
                )
            } else {
                Circle()
                    .fill(Color.appSurfaceElevated)
                    .frame(width: 20, height: 20)
            }
            Text(week.map { "W\($0)" } ?? "—")
                .font(.system(size: 8, weight: .semibold, design: .rounded))
                .foregroundStyle(Color.appTextMuted)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
    }
}

// MARK: - Metric help

struct NFLPropMetricHelp: Identifiable, Hashable {
    let id: String
    let title: String
    let body: String

    static let all: [String: NFLPropMetricHelp] = {
        let entries: [(String, String, String)] = [
            ("posted_line", "Posted Line",
             "The consensus closing line and prices across sportsbooks for this prop market. For anytime TD, the price is the yes-side implied probability — there is no yardage line."),
            ("game_log", "Game Log",
             "Each bar is one prior game this season (oldest left, most recent right). Green cleared the posted line; red missed. The dashed line is today's consensus close. Opponent logos and week numbers sit below each bar."),
            ("book_odds", "Best Lines",
             "The best-shop over and under at the actionable close (T-60 before kickoff), precomputed in the props loader using the same logic as game picks and Outliers. For anytime TD, only the best yes price is shown."),
            ("season_stats", "Season Stats",
             "Point-in-time season form through last week — stats and averages before this game. Tap any tile's info icon for what that specific number means."),
            ("last_game", "Last Game",
             "The player's actual stat total in his most recent game before this week."),
            ("l3_avg", "Last 3 Average",
             "Average stat over the player's prior three games this season."),
            ("l5_avg", "Last 5 Average",
             "Average stat over the player's prior five games this season."),
            ("szn_avg", "Season Average",
             "Average stat across every game the player played this season before this week."),
            ("szn_high", "Season High",
             "The player's single-game high for this stat this season before this week."),
            ("opp_defense", "Opponent Defense",
             "How much this week's opponent allows to players at this position for this prop stat, compared to league average entering the week. Positive (green) = softer matchup (defense allows more than average). Negative (red) = tough matchup."),
            ("line_movement", "Line Movement",
             "How the consensus line moved from the open to the close across books. A rising line often means money came in on the over; a drop often means the under. The cross-book range shows how far apart the tightest and loosest books were at the close."),
        ]
        return Dictionary(uniqueKeysWithValues: entries.map {
            ($0.0, NFLPropMetricHelp(id: $0.0, title: $0.1, body: $0.2))
        })
    }()
}

struct NFLPropMetricHelpSheet: View {
    let help: NFLPropMetricHelp
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    Text(help.title)
                        .font(.system(size: 22, weight: .black))
                        .foregroundStyle(Color.appTextPrimary)
                    Text(help.body)
                        .font(.system(size: 15))
                        .lineSpacing(4)
                        .foregroundStyle(Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(20)
            }
            .background(Color.appSurface)
            .navigationTitle("About This Metric")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .tint(Color.appPrimary)
                }
            }
        }
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
    }
}

import SwiftUI
import WagerproofModels
import WagerproofDesign
import WagerproofServices

/// Full-page NFL player-analysis detail, styled like the MLB prop detail
/// (`PlayerPropDetailView`): a `CollapsingWidgetScroll` hero whose identity
/// row docks into the toolbar while the market picker stays pinned under it.
///
/// Content is the web player-analysis page (`src/features/propBreakdown/`),
/// stacked for every player market like the MLB prop detail. The pinned market
/// strip scrolls to a section on tap and follows along as the user scrolls.
/// Each market renders six sections: WagerProof Projection, Recent Games,
/// Matchup vs the opponent's look, Head-to-Head, Situations, Best Lines.
///
/// The hero renders instantly from the feed selection; the page + trends rows
/// load per player through `NFLPropPageService` and degrade independently.
struct NFLPropDetailView: View {
    let selection: NFLPlayerPropSelection

    @State private var detail: NFLPropPlayerDetailBundle?
    @State private var isLoadingDetail = true
    @State private var bookOddsByMarket: [String: SportsbookPropMarketOdds] = [:]
    @State private var activeMarket: String
    @State private var metricHelp: NFLPropMetricHelp?
    @State private var selectedSignal: SelectedPropSignal?
    @State private var propPerfByKey: [String: SignalPerformance] = [:]
    @State private var heroBottom: CGFloat = 0
    @State private var suppressSpy = false
    @State private var spy = SpyStore()

    private final class SpyStore { var tops: [String: CGFloat] = [:] }

    private var player: NFLPropPlayer { selection.player }

    private let pickerBand: CGFloat = 40
    /// Identity only — the picker is a pin-accessory, not part of the hero.
    private let heroMax: CGFloat = 96
    private let heroMin: CGFloat = 54

    init(selection: NFLPlayerPropSelection) {
        self.selection = selection
        let preferred = selection.preferredMarket
        let first = preferred.flatMap { m in selection.player.markets.first { $0.market == m } }
            ?? selection.player.markets.first { !$0.flags.isEmpty }
            ?? selection.player.markets.first
        _activeMarket = State(initialValue: first?.market ?? "")
    }

    // MARK: - Display markets (page order wins; feed rows are the fallback)

    /// One pickable market: the served page market (posted/pending, line,
    /// prices) joined with the props-feed row (best books, game log fallback).
    /// Key sets can differ between the two tables — union by page order.
    private struct DisplayMarket: Identifiable {
        let key: String
        let label: String
        let pageMarket: NFLPropPageMarket?
        let feedMarket: NFLPropMarket?
        var id: String { key }
        var isYesNo: Bool { key == "player_anytime_td" }
    }

    private var displayMarkets: [DisplayMarket] {
        let feedByKey = Dictionary(
            selection.player.markets.map { ($0.market, $0) },
            uniquingKeysWith: { first, _ in first }
        )
        if let pageMarkets = detail?.page?.markets, !pageMarkets.isEmpty {
            return pageMarkets.map { pm in
                DisplayMarket(key: pm.key, label: pm.label, pageMarket: pm, feedMarket: feedByKey[pm.key])
            }
        }
        return selection.player.markets.map { fm in
            DisplayMarket(key: fm.market, label: fm.label, pageMarket: nil, feedMarket: fm)
        }
    }

    private var activeDisplayMarket: DisplayMarket? {
        let markets = displayMarkets
        return markets.first { $0.key == activeMarket } ?? markets.first
    }

    private var hasPicker: Bool { displayMarkets.count > 1 }

    private var teamColor: Color {
        NFLTeamColors.colors(for: player.team ?? "").primary
    }
    private var oppColor: Color {
        NFLTeamColors.colors(for: player.opponent ?? "").primary
    }

    var body: some View {
        GeometryReader { root in
            let chrome = PropDetailChrome(safeTop: root.safeAreaInsets.top, safeBottom: root.safeAreaInsets.bottom)
            ScrollViewReader { proxy in
                CollapsingWidgetScroll(
                    heroMaxHeight: heroMax,
                    heroMinHeight: heroMin,
                    heroTopInset: chrome.expandedTop,
                    usesLiquidGlass: false,
                    pinAccessoryHeight: hasPicker ? pickerBand : 0,
                    heroBottom: $heroBottom,
                    dockedTopInsetOverride: chrome.dockedTop
                ) { progress in
                    TeamAuraBackground(awayColor: teamColor, homeColor: oppColor, progress: progress)
                } hero: { progress in
                    heroView(progress: progress)
                } content: {
                    LazyVStack(spacing: 0) {
                        ForEach(displayMarkets) { market in
                            VStack(spacing: 0) {
                                marketStack(market)
                            }
                                .id(market.key)
                                .background(spyTracker(market: market.key, topInset: chrome.expandedTop))
                        }
                        footnote
                    }
                }
                .overlay(alignment: .top) {
                    if hasPicker {
                        marketPicker(proxy: proxy, viewportHeight: root.size.height)
                            .padding(.horizontal, 16)
                            .padding(.top, max(chrome.expandedTop, heroBottom))
                    }
                }
            }
        }
        .ignoresSafeArea()
        .toolbarBackground(.hidden, for: .navigationBar)
        // Name lives permanently in the hero — keep the nav title empty.
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: selection.id) {
            await loadDetail()
        }
        .sheet(item: $metricHelp) { help in
            NFLPropMetricHelpSheet(help: help)
        }
        .sheet(item: $selectedSignal) { selection in
            NFLPropSignalDetailSheet(
                signal: selection.signal,
                seasonRecord: selection.performanceKey.flatMap { propPerfByKey[$0] }
            )
        }
    }

    // MARK: - Data

    private func loadDetail() async {
        isLoadingDetail = true
        if let playerId = player.playerId, !playerId.isEmpty {
            detail = await NFLPropPageService.shared.detail(playerId: playerId)
        } else {
            detail = NFLPropPlayerDetailBundle(page: nil, trends: nil)
        }
        isLoadingDetail = false
        // The served market list can drop the market the feed preferred —
        // snap to the page's first market (web does exactly this).
        let markets = displayMarkets
        if !markets.isEmpty, !markets.contains(where: { $0.key == activeMarket }) {
            activeMarket = markets[0].key
        }
        await loadSportsbookOdds()
        await loadPropSignalPerformance()
    }

    private func loadPropSignalPerformance() async {
        let season = player.season ?? 2026
        propPerfByKey = await SignalPerformanceService.shared.performances(for: .nfl, season: season)
    }

    private func loadSportsbookOdds() async {
        guard let playerId = player.playerId, !playerId.isEmpty else {
            bookOddsByMarket = [:]
            return
        }
        // Union of feed + page market keys: the board is the chart-line
        // fallback for pending page markets and the live Best Lines source.
        var requested = Set(selection.player.markets.map(\.market))
        if let pageMarkets = detail?.page?.markets {
            requested.formUnion(pageMarkets.map(\.key))
        }
        var loaded: [String: SportsbookPropMarketOdds] = [:]
        await withTaskGroup(of: (String, SportsbookPropMarketOdds?).self) { group in
            for market in requested {
                group.addTask {
                    let odds = await SportsbookPropOddsService.shared.odds(
                        playerId: playerId,
                        market: market
                    )
                    return (market, odds)
                }
            }
            for await (market, odds) in group {
                if let odds { loaded[market] = odds }
            }
        }
        bookOddsByMarket = loaded
    }

    // MARK: - Per-market derived values (web PropBreakdownPage)

    /// Today's grading threshold: the page's posted line, else the props-feed
    /// close, else the best over-board line, else 0.5 for ATD.
    private func chartLine(for market: DisplayMarket) -> Double? {
        if let line = market.pageMarket?.line { return line }
        if let line = market.feedMarket?.closeLine { return line }
        if let boardLine = bookOddsByMarket[market.key]?.over.quotes.first(where: { $0.line != nil })?.line {
            return boardLine
        }
        return market.isYesNo ? 0.5 : nil
    }

    /// Best over price for the Vegas marker / ATD implied probability.
    private func bestOverOdds(for market: DisplayMarket) -> Double? {
        if let price = bookOddsByMarket[market.key]?.over.quotes.first?.price { return Double(price) }
        if let price = market.pageMarket?.overPrice { return Double(price) }
        if let price = market.feedMarket?.overPrice { return Double(price) }
        return nil
    }

    /// Trends game log, falling back to the props-feed season log so the
    /// Recent Games chart still renders when the trends row is missing.
    private func trendGames(for marketKey: String) -> [NFLPropTrendGame] {
        if let log = detail?.trends?.recentGameLog, !log.isEmpty { return log }
        guard let feed = displayMarkets.first(where: { $0.key == marketKey })?.feedMarket else { return [] }
        // Feed log is oldest→newest; the trends contract is newest-first.
        return feed.recentGames.reversed().compactMap { game in
            guard let actual = game.actual else { return nil }
            return NFLPropTrendGame(
                season: player.season ?? 0,
                week: game.week ?? 0,
                opp: game.opp ?? "",
                actuals: [feed.market: actual]
            )
        }
    }

    /// Last-10 grading vs today's line — feeds the hero badge + headline.
    private func l10Grading(marketKey: String, line: Double?) -> (hits: Int, graded: Int) {
        guard let line else { return (0, 0) }
        let actuals = trendGames(for: marketKey).prefix(10).compactMap { $0.actuals[marketKey] }
        return (actuals.filter { $0 > line }.count, actuals.count)
    }

    // MARK: - Scroll-spy

    private func spyAnchor(topInset: CGFloat) -> CGFloat {
        max(topInset, heroBottom) + (hasPicker ? pickerBand : 0) + 8
    }

    private func spyTracker(market: String, topInset: CGFloat) -> some View {
        GeometryReader { geo in
            Color.clear
                .onChange(of: geo.frame(in: .global).minY, initial: true) { _, y in
                    updateTop(market, y, anchor: spyAnchor(topInset: topInset))
                }
        }
    }

    private func updateTop(_ market: String, _ y: CGFloat, anchor: CGFloat) {
        spy.tops[market] = y
        guard !suppressSpy else { return }
        let passed = displayMarkets.compactMap { item -> (String, CGFloat)? in
            guard let top = spy.tops[item.key], top <= anchor else { return nil }
            return (item.key, top)
        }
        let next = passed.max(by: { $0.1 < $1.1 })?.0 ?? displayMarkets.first?.key
        if let next, next != activeMarket { activeMarket = next }
    }

    // MARK: - Collapsing hero

    @ViewBuilder
    private func heroView(progress p: CGFloat) -> some View {
        let headSize = lerp(50, 36, p)
        let ringPad = lerp(4, 0, p)
        let detail = Double(max(0, 1 - p * 1.9))
        let dock = min(1, max(0, (p - 0.45) / 0.55))
        let leading = lerp(20, 90, dock)
        let grading = activeDisplayMarket.map { l10Grading(marketKey: $0.key, line: chartLine(for: $0)) }
        let pct: Int? = grading.flatMap { g in
            g.graded > 0 ? Int((Double(g.hits) / Double(g.graded) * 100).rounded()) : nil
        }

        VStack(spacing: lerp(8, 6, p)) {
            heroTopRow
                .opacity(detail)
                .frame(height: lerp(18, 0, min(1, p * 1.6)))
                .clipped()
            HStack(alignment: .center, spacing: lerp(16, 12, p)) {
                NFLPlayerHeadshot(playerName: player.playerName, playerId: player.playerId, headshotUrl: player.headshotUrl, size: headSize)
                    .padding(ringPad)
                    .teamGlassDisc(primary: teamColor, secondary: oppColor)
                    .shadow(color: teamColor.opacity(lerp(0.35, 0.18, p)), radius: lerp(8, 3, p))
                VStack(alignment: .leading, spacing: 2) {
                    Text(player.playerName)
                        .font(.system(size: lerp(19, 15, p), weight: .heavy))
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
                // MLB-style animated L10 hit-% badge for the active market.
                HStack(alignment: .firstTextBaseline, spacing: 0) {
                    Text(pct.map(String.init) ?? "—")
                        .font(.system(size: lerp(27, 17, p), weight: .heavy))
                        .foregroundStyle(Color.appPrimary)
                    if pct != nil {
                        Text("%")
                            .font(.system(size: lerp(16, 11, p), weight: .heavy))
                            .foregroundStyle(Color.appPrimary)
                    }
                }
                .contentTransition(.numericText())
                .animation(.snappy(duration: 0.28), value: pct)
            }
            .frame(height: lerp(58, 44, p), alignment: .center)
        }
        .padding(.leading, leading)
        .padding(.trailing, 16)
        .padding(.top, lerp(8, 0, p))
        .padding(.bottom, lerp(0, 10, p))
        .frame(maxWidth: .infinity, alignment: .top)
    }

    private var heroTopRow: some View {
        HStack(spacing: 8) {
            if let week = detail?.page?.week ?? player.week {
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
        if let kickoff = kickoffShort { return kickoff }
        let date = MLBFormatting.dateLabel(player.gameDate)
        if let slot = player.slotLabel { return "\(date) · \(slot)" }
        return date
    }

    /// "Sun, 1:00 PM" in ET from the page's kickoff ISO timestamp.
    private var kickoffShort: String? {
        guard let iso = detail?.page?.kickoff else { return nil }
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        guard let date = parser.date(from: iso) ?? plain.date(from: iso) else { return nil }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US")
        formatter.timeZone = TimeZone(identifier: "America/New_York")
        formatter.dateFormat = "E, h:mm a"
        return formatter.string(from: date)
    }

    private var subtitle: String {
        var parts: [String] = []
        if let pos = player.position, !pos.isEmpty { parts.append(pos) }
        if let team = player.team { parts.append(team) }
        if let status = player.reportStatus, !status.isEmpty { parts.append(status) }
        return parts.joined(separator: " · ")
    }

    // MARK: - Native market picker

    private func marketPicker(proxy: ScrollViewProxy, viewportHeight: CGFloat) -> some View {
        Picker("Market", selection: pickerBinding(proxy: proxy, viewportHeight: viewportHeight)) {
            ForEach(displayMarkets) { market in
                Text(NFLPlayerProps.marketAbbr(market.key)).tag(market.key)
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
                suppressSpy = true
                let anchorY = min(0.45, max(0.08, heroMin / max(viewportHeight, 1)))
                withAnimation(.snappy) {
                    proxy.scrollTo(market, anchor: UnitPoint(x: 0.5, y: anchorY))
                }
                Task { @MainActor in
                    try? await Task.sleep(for: .seconds(0.45))
                    suppressSpy = false
                }
            }
        )
    }

    // MARK: - The six sections (web widget stack per market)

    @ViewBuilder
    private func marketStack(_ market: DisplayMarket) -> some View {
        let line = chartLine(for: market)
        let odds = bestOverOdds(for: market)
        let page = detail?.page
        let trends = detail?.trends
        let grading = l10Grading(marketKey: market.key, line: line)
        let opponent = page?.scheme?.opponent ?? page?.opponent ?? player.opponent ?? ""
        let pageSignals = market.pageMarket?.signals ?? []
        let flags = !pageSignals.isEmpty
            ? pageSignals.map(\.key)
            : (market.feedMarket?.flags ?? [])
        let recordsByKey = Dictionary(
            pageSignals.compactMap { sig -> (String, String)? in
                guard let record = sig.record, !record.isEmpty else { return nil }
                return (sig.key, record)
            },
            uniquingKeysWith: { first, _ in first }
        )

        // 0. Fired prop signals for THIS market (web chips under market toggle).
        if !flags.isEmpty {
            WidgetCollapsingSection(
                title: widgetTitle("Prop Signals", market: market),
                systemImage: "bolt.fill",
                iconTint: Color(hex: 0xF97316),
                headline: flags.count == 1 ? "1 signal fired on this market." : "\(flags.count) signals fired on this market."
            ) {
                NFLPropSignalGroup(flags: flags, recordsByKey: recordsByKey) {
                    selectedSignal = SelectedPropSignal(signal: $0, marketKey: market.key)
                }
            }
        }

        // 1. WagerProof Projection.
        if isLoadingDetail {
            skeletonSection(title: widgetTitle("WagerProof Projection", market: market), systemImage: "scope")
        } else {
            WidgetCollapsingSection(
                title: widgetTitle("WagerProof Projection", market: market),
                systemImage: "scope",
                accessory: .tapHint(expanded: false),
                onHeaderTap: { metricHelp = NFLPropMetricHelp.all["projection"] },
                headline: NFLPropVerdicts.projectionHeadline(
                    projection: page?.projection[market.key],
                    marketKey: market.key,
                    marketLabel: market.label,
                    line: line,
                    vegasOdds: odds
                )
            ) {
                NFLProjectionStrip(
                    projection: page?.projection[market.key],
                    rookie: page?.rookie ?? false,
                    marketKey: market.key,
                    line: market.isYesNo ? nil : line,
                    vegasOdds: odds
                )
            }
        }

        // 2. Recent Games (renders from the feed log until trends arrive).
        WidgetCollapsingSection(
            title: widgetTitle("Recent Games", market: market),
            systemImage: "chart.bar.fill",
            accessory: .tapHint(expanded: false),
            onHeaderTap: { metricHelp = NFLPropMetricHelp.all["recent_games"] },
            headline: NFLPropVerdicts.recentGamesHeadline(
                hits: grading.hits,
                graded: grading.graded,
                isTd: market.isYesNo,
                hasLine: line != nil
            ),
            contentKey: isLoadingDetail ? "feed" : "trends"
        ) {
            NFLRecentGamesChart(
                games: trendGames(for: market.key),
                marketKey: market.key,
                line: line,
                lineLabel: market.isYesNo ? "TD" : nil
            )
        }

        // 3. Matchup vs the opponent's look — needs the page's scheme payload.
        if isLoadingDetail {
            skeletonSection(title: widgetTitle("Matchup", market: market), systemImage: "shield.lefthalf.filled")
        } else if let page, page.scheme != nil {
            WidgetCollapsingSection(
                title: widgetTitle(opponent.isEmpty ? "Matchup" : "Matchup vs \(opponent)", market: market),
                systemImage: "shield.lefthalf.filled",
                accessory: .tapHint(expanded: false),
                onHeaderTap: { metricHelp = NFLPropMetricHelp.all["matchup"] },
                headline: NFLPropVerdicts.matchupHeadline(
                    opponent: opponent,
                    identity: page.scheme?.defense?.identity
                )
            ) {
                NFLMatchupComparison(page: page, marketKey: market.key)
            }
        }

        // 4. Head-to-Head.
        if let trends {
            WidgetCollapsingSection(
                title: widgetTitle("Head-to-Head", market: market),
                systemImage: "person.2.fill",
                accessory: .tapHint(expanded: false),
                onHeaderTap: { metricHelp = NFLPropMetricHelp.all["h2h"] },
                headline: NFLPropVerdicts.headToHeadHeadline(
                    matchup: trends.matchups[opponent],
                    marketKey: market.key,
                    opponent: opponent
                )
            ) {
                NFLHeadToHeadBlock(
                    matchup: trends.matchups[opponent],
                    marketKey: market.key,
                    marketLabel: market.label,
                    opponent: opponent
                )
            }
        }

        // 5. Situations — only when this market has served splits (web parity).
        if let buckets = trends?.splits[market.key], !buckets.isEmpty {
            WidgetCollapsingSection(
                title: widgetTitle("Situations", market: market),
                systemImage: "calendar",
                accessory: .tapHint(expanded: false),
                onHeaderTap: { metricHelp = NFLPropMetricHelp.all["situations"] },
                headline: NFLPropVerdicts.situationsHeadline(
                    overall: buckets["overall"].flatMap(NFLPropTrendsDetail.preferredWindow),
                    marketKey: market.key
                )
            ) {
                NFLSituationsGrid(buckets: buckets, marketKey: market.key)
            }
        }

        // 6. Best Lines — live board or the loader's precomputed best shops.
        if let feedMarket = market.feedMarket,
           feedMarket.hasBestBooks || bookOddsByMarket[market.key] != nil {
            WidgetCollapsingSection(
                title: widgetTitle("Best Lines", market: market),
                systemImage: "dollarsign.circle.fill",
                accessory: .tapHint(expanded: false),
                onHeaderTap: { metricHelp = NFLPropMetricHelp.all["book_odds"] }
            ) {
                NFLBestLinesBlock(market: feedMarket, live: bookOddsByMarket[market.key])
            }
        }
    }

    /// Keep every stacked widget self-identifying even when its market chip is
    /// outside the visible part of the horizontal picker.
    private func widgetTitle(_ title: String, market: DisplayMarket) -> String {
        "\(title) · \(market.label)"
    }

    private func skeletonSection(title: String, systemImage: String) -> some View {
        WidgetCollapsingSection(title: title, systemImage: systemImage) {
            VStack(alignment: .leading, spacing: 10) {
                SkeletonBlock(width: 220, height: 14)
                SkeletonBlock(height: 96, cornerRadius: 12)
                SkeletonBlock(width: 140, height: 10)
            }
            .shimmering()
        }
    }

    private var footnote: some View {
        Text("Projections and matchup splits update weekly. Book boards are point-in-time snapshots — confirm at the book before betting.")
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

// MARK: - Metric help

struct NFLPropMetricHelp: Identifiable, Hashable {
    let id: String
    let title: String
    let body: String

    static let all: [String: NFLPropMetricHelp] = {
        let entries: [(String, String, String)] = [
            ("projection", "WagerProof Projection",
             "Our projected stat total for this market, placed against the Vegas line. \"Model\" means the live projection model produced the number; \"Preview\" means it comes from the player's recent game-by-game distribution until the model takes over. For anytime TD we project a probability to score and translate it into fair odds you can compare against the posted price."),
            ("recent_games", "Recent Games",
             "Each bar is the player's actual stat total in one of his last 10 games (oldest left, most recent right). Green cleared TODAY's line; red missed it. The dashed line is today's threshold — historical results are graded against the current number, not the line posted at the time."),
            ("matchup", "Matchup",
             "The player's career production against the defensive look this week's opponent plays most — yards per target for receivers, EPA per dropback for QBs, EPA per rush for backs — compared with his career average. Below it: his per-game averages against similar defenses, how often he cleared this market's line against them, and how often the opponent actually uses each look (with the league percentile)."),
            ("h2h", "Head-to-Head",
             "The player's career record for this market against this week's opponent. Needs at least 2 career meetings and 2 graded lines before it renders — otherwise the sample is noise."),
            ("situations", "Situations",
             "The player's recent record for this market by game setting — home, away, division, primetime, and so on — over his last few graded games in each spot. Green is above 75%, amber above 60%."),
            ("book_odds", "Best Lines",
             "The best available over and under across sportsbooks. Live boards come from hourly snapshots of each book's posted prop; when no live board exists, the precomputed best shop from the props loader is shown. Confirm at the book before betting."),
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
            .navigationTitle("About This Section")
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

/// Tap target for a prop-signal detail sheet — carries the catalog definition
/// plus the season `signal_performance` lookup key for this flag.
private struct SelectedPropSignal: Identifiable {
    let signal: NFLPropSignalDefinition
    let performanceKey: String?

    init(signal: NFLPropSignalDefinition, marketKey _: String) {
        self.signal = signal
        self.performanceKey = SelectedPropSignal.performanceKey(for: signal)
    }

    var id: String { "\(signal.id)|\(performanceKey ?? "")" }

    private static func performanceKey(for signal: NFLPropSignalDefinition) -> String? {
        switch signal.id.uppercased() {
        case "P1": return "P1_pass_yds_form_over"
        case "P2": return "P2_pass_yds_form_under"
        case "P3": return "P3_pass_tds_form_over"
        case "P4": return "P4_no_history_qb_under"
        case "P5": return "P5_atd_drift_yes"
        case "P6": return nil
        case "P7": return "P7_rush_yds_tough_d_under"
        case "P9": return "P9_pass_tds_regression_over"
        case "P10": return "P10_receptions_raised_under"
        case "P12": return "P12_featured_wr_over"
        case "P13": return "P13_featured_rb_over"
        case "P14": return "P14_attempts_model_under"
        case "P15": return "P15_attempts_steam_under"
        case "P16": return "P16_attempts_confluence"
        case "P17": return "P17_rush_yds_model_under"
        case "P18": return "P18_pass_tds_model_over"
        default: return nil
        }
    }
}

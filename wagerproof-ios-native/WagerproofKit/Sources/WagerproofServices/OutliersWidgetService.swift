import Foundation
import WagerproofModels

/// Builds the shared payload used by the configurable Top Outliers widget.
/// Network and CPU-heavy trend engines stay in the main app; the extension
/// only decodes this compact projection from the App Group.
public enum OutliersWidgetService {
    public struct Snapshot: Sendable {
        /// Nil means the legacy alert fetch failed and last-known-good data
        /// should be preserved. An empty array means it succeeded with no hits.
        public let alerts: [OutlierAlertForWidget]?
        /// Nil means every trends source failed. Each successful source may
        /// legitimately contribute zero current market groups.
        public let markets: [OutliersWidgetMarketData]?
    }

    private struct TrendMarketSource: Sendable {
        let sport: OutliersTrendsSport
        let sections: [OutliersTrendsMarketSection]
        let mlbBundle: MLBTrendsSlateBundle?
        let succeeded: Bool
    }

    private struct PropsSource: Sendable {
        let matchups: [MLBPropMatchup]
        let succeeded: Bool
    }

    private struct MarketAccumulator {
        let id: String
        let title: String
        let symbolName: String
        var items: [OutliersWidgetItem]
        var totalCount: Int
    }

    private static let maxLegacyAlerts = 6
    private static let maxPayloadItemsPerMarket = 12

    // MARK: - Public API

    @discardableResult
    public static func sync() async -> [OutlierAlertForWidget] {
        let snapshot = await fetchSnapshot()
        guard snapshot.alerts != nil || snapshot.markets != nil else { return [] }

        var existing = TopAgentsWidgetService.readPayload() ?? WidgetDataPayload.empty()
        if let alerts = snapshot.alerts { existing.topOutliers = alerts }
        if let markets = snapshot.markets { existing.outlierMarkets = markets }
        existing.lastUpdated = Self.nowISO()
        try? TopAgentsWidgetService.writePayload(existing)
        return snapshot.alerts ?? existing.topOutliers
    }

    /// Fetches the legacy value/fade projection and the new configurable
    /// market groups independently. One source failing never erases the other.
    public static func fetchSnapshot() async -> Snapshot {
        async let alertsTask = optionalLegacyAlerts()
        async let marketsTask = optionalMarketGroups()
        return await Snapshot(alerts: alertsTask, markets: marketsTask)
    }

    // MARK: - Legacy alerts

    private static func optionalLegacyAlerts() async -> [OutlierAlertForWidget]? {
        do { return try await fetchLegacyAlerts() }
        catch { return nil }
    }

    private static func fetchLegacyAlerts() async throws -> [OutlierAlertForWidget] {
        let games = try await OutliersService.shared.fetchWeekGames()
        guard !games.isEmpty else { return [] }

        async let valuesTask = OutliersService.shared.fetchValueAlerts(weekGames: games)
        async let fadesTask = OutliersService.shared.fetchFadeAlerts(weekGames: games)
        let (values, fades) = await (valuesTask, fadesTask)
        return Array(
            (values.map(Self.toWidget) + fades.map(Self.toWidget))
                .sorted { $0.confidence > $1.confidence }
                .prefix(maxLegacyAlerts)
        )
    }

    private static func toWidget(_ alert: OutlierValueAlert) -> OutlierAlertForWidget {
        OutlierAlertForWidget(
            id: "value-\(alert.id)",
            kind: .value,
            sport: alert.sport.rawValue,
            awayTeam: alert.awayTeam,
            homeTeam: alert.homeTeam,
            marketType: alert.marketType.rawValue,
            side: alert.side,
            confidence: Int(alert.percentage.rounded()),
            gameTime: alert.game.gameTime
        )
    }

    private static func toWidget(_ alert: OutlierFadeAlert) -> OutlierAlertForWidget {
        OutlierAlertForWidget(
            id: "fade-\(alert.id)",
            kind: .fade,
            sport: alert.sport.rawValue,
            awayTeam: alert.awayTeam,
            homeTeam: alert.homeTeam,
            marketType: alert.pickType.rawValue,
            side: alert.predictedTeam,
            confidence: alert.confidence,
            gameTime: alert.game.gameTime
        )
    }

    // MARK: - Configurable market groups

    private static func optionalMarketGroups() async -> [OutliersWidgetMarketData]? {
        do { return try await fetchMarketGroups() }
        catch { return nil }
    }

    private static func fetchMarketGroups() async throws -> [OutliersWidgetMarketData] {
        async let mlbTask = fetchMLBSource()
        async let nflTask = fetchPrecomputedSource(sport: .nfl)
        async let ncaafTask = fetchPrecomputedSource(sport: .ncaaf)
        async let propsTask = fetchPropsSource()

        let (mlb, nfl, ncaaf, props) = await (mlbTask, nflTask, ncaafTask, propsTask)
        guard mlb.succeeded || nfl.succeeded || ncaaf.succeeded || props.succeeded else {
            throw NSError(
                domain: "Wagerproof.OutliersWidget",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "No Outliers market source was available"]
            )
        }

        var groups: [String: MarketAccumulator] = [:]
        var order: [String] = []

        // Parlay God is the first header on the in-app page, so it is also the
        // default widget market whenever qualifying tickets exist.
        let teamLegs = mlb.mlbBundle.map { ParlayGodEngine.teamLegs(bundle: $0) } ?? []
        let propLegs = ParlayGodEngine.propLegs(matchups: props.matchups)
        let tickets = ParlayGodEngine.slateTickets(from: teamLegs + propLegs)
        let parlayItems = tickets.compactMap(Self.parlayWidgetItem)
        if !parlayItems.isEmpty {
            let id = "parlay-god"
            groups[id] = MarketAccumulator(
                id: id,
                title: "Parlay God",
                symbolName: "bolt.fill",
                items: parlayItems,
                totalCount: tickets.count
            )
            order.append(id)
        }

        for source in [nfl, ncaaf, mlb] where source.succeeded {
            for section in source.sections {
                let identity = canonicalMarketIdentity(for: section)
                let mapped = section.cards.compactMap { trendWidgetItem($0, sport: source.sport) }
                guard !mapped.isEmpty else { continue }

                if var existing = groups[identity.id] {
                    existing.items.append(contentsOf: mapped)
                    existing.totalCount += mapped.count
                    groups[identity.id] = existing
                } else {
                    groups[identity.id] = MarketAccumulator(
                        id: identity.id,
                        title: identity.title,
                        symbolName: identity.symbol,
                        items: mapped,
                        totalCount: mapped.count
                    )
                    order.append(identity.id)
                }
            }
        }

        return order.compactMap { id in
            guard var group = groups[id] else { return nil }
            group.items.sort(by: strongerTrendFirst)
            return OutliersWidgetMarketData(
                id: group.id,
                title: group.title,
                symbolName: group.symbolName,
                items: Array(group.items.prefix(maxPayloadItemsPerMarket)),
                totalCount: group.totalCount
            )
        }
    }

    private static func fetchMLBSource() async -> TrendMarketSource {
        do {
            let bundle = try await OutliersTrendsService.shared.fetchMLBBundle()
            let cards = MLBTrendsEngine.buildCards(
                bundle: bundle,
                gameFilter: .allGames,
                subject: .teams,
                gameMarket: .all,
                visibleLimit: Int.max
            )
            return TrendMarketSource(
                sport: .mlb,
                sections: OutliersTrendsMarketSection.sections(from: cards, cap: Int.max),
                mlbBundle: bundle,
                succeeded: true
            )
        } catch {
            return TrendMarketSource(sport: .mlb, sections: [], mlbBundle: nil, succeeded: false)
        }
    }

    private static func fetchPrecomputedSource(sport: OutliersTrendsSport) async -> TrendMarketSource {
        do {
            let games = try await OutliersTrendsService.shared.fetchSlateGames(sport: sport)
            guard let first = games.first else {
                return TrendMarketSource(sport: sport, sections: [], mlbBundle: nil, succeeded: true)
            }
            let precomputed = try await OutliersTrendsService.shared.fetchPrecomputedCards(
                sport: sport,
                season: first.season,
                week: first.week
            )
            let cards = NFLTrendsEngine.filterPrecomputedCards(
                precomputed,
                games: games,
                sport: sport,
                gameFilter: .allGames,
                subject: .all,
                gameMarket: .all,
                propMarket: .all,
                includeAllPlayers: true,
                visibleLimit: Int.max
            )
            return TrendMarketSource(
                sport: sport,
                sections: OutliersTrendsMarketSection.sections(from: cards, cap: Int.max),
                mlbBundle: nil,
                succeeded: true
            )
        } catch {
            return TrendMarketSource(sport: sport, sections: [], mlbBundle: nil, succeeded: false)
        }
    }

    private static func fetchPropsSource() async -> PropsSource {
        do {
            return PropsSource(
                matchups: try await MLBPlayerPropsService.shared.fetchMatchups(),
                succeeded: true
            )
        } catch {
            return PropsSource(matchups: [], succeeded: false)
        }
    }

    private static func trendWidgetItem(
        _ card: OutliersTrendsCard,
        sport: OutliersTrendsSport
    ) -> OutliersWidgetItem? {
        guard let strongest = card.rows.max(by: { lhs, rhs in
            if lhs.dominantPct != rhs.dominantPct { return lhs.dominantPct < rhs.dominantPct }
            return lhs.sampleN < rhs.sampleN
        }), strongest.sampleN > 0 else { return nil }

        let line = card.bettingLines.first(where: { line in
            guard let team = card.teamAbbr else { return false }
            return line.teamAbbr == team
        }) ?? card.bettingLines.first
        let selection = line?.lineText ?? card.lineContext ?? card.betTypeLabel
        let hits = min(
            strongest.sampleN,
            max(0, Int((strongest.dominantPct * Double(strongest.sampleN)).rounded()))
        )

        return OutliersWidgetItem(
            id: "\(sport.rawValue)-\(card.id)",
            sport: sport.rawValue,
            matchup: card.matchupLabel,
            subject: card.subjectName,
            selection: selection,
            oddsText: line?.oddsText,
            hitCount: hits,
            sampleSize: strongest.sampleN,
            additionalTrendCount: max(0, card.rows.count - 1)
        )
    }

    private static func parlayWidgetItem(_ ticket: ParlayTicket) -> OutliersWidgetItem? {
        guard let topLeg = ticket.legs.max(by: { $0.streakN < $1.streakN }) else { return nil }
        return OutliersWidgetItem(
            id: "parlay-\(ticket.id)",
            sport: "mlb",
            matchup: topLeg.matchupLabel,
            subject: ticket.category.title,
            selection: "\(topLeg.subject) \(topLeg.betText)",
            oddsText: ticket.combinedOddsText,
            hitCount: topLeg.streakN,
            sampleSize: topLeg.streakN,
            additionalTrendCount: max(0, ticket.legs.count - 1)
        )
    }

    private static func strongerTrendFirst(_ lhs: OutliersWidgetItem, _ rhs: OutliersWidgetItem) -> Bool {
        let lhsRate = Double(lhs.hitCount) / Double(max(1, lhs.sampleSize))
        let rhsRate = Double(rhs.hitCount) / Double(max(1, rhs.sampleSize))
        if lhsRate != rhsRate { return lhsRate > rhsRate }
        if lhs.sampleSize != rhs.sampleSize { return lhs.sampleSize > rhs.sampleSize }
        return lhs.subject.localizedCaseInsensitiveCompare(rhs.subject) == .orderedAscending
    }

    private static func canonicalMarketIdentity(
        for section: OutliersTrendsMarketSection
    ) -> (id: String, title: String, symbol: String) {
        switch section.marketKey {
        case "moneyline", "ml": return ("moneyline", "Moneyline", "dollarsign.circle.fill")
        case "spread": return ("spread", "Spread", "arrow.left.and.right")
        case "rl": return ("run-line", "Run Line", "arrow.left.and.right")
        case "total", "ou": return ("total", "Total", "sum")
        case "team_total": return ("team-total", "Team Total", "person.2.fill")
        case "h1_spread": return ("first-half-spread", "1H Spread", "clock.fill")
        case "h1_total": return ("first-half-total", "1H Total", "clock.badge.checkmark")
        case "f5_ml": return ("first-five-moneyline", "1st 5 Moneyline", "5.circle.fill")
        case "f5_rl": return ("first-five-run-line", "1st 5 Run Line", "5.circle.fill")
        case "f5_ou": return ("first-five-total", "1st 5 Total", "5.circle.fill")
        case "player_pass_yds": return ("passing-yards", "Passing Yards", "paperplane.fill")
        case "player_pass_tds": return ("passing-tds", "Passing TDs", "trophy.fill")
        case "player_pass_attempts": return ("pass-attempts", "Pass Attempts", "paperplane")
        case "player_pass_completions": return ("completions", "Completions", "checkmark.circle.fill")
        case "player_rush_yds": return ("rushing-yards", "Rushing Yards", "figure.run")
        case "player_rush_attempts": return ("rush-attempts", "Rush Attempts", "figure.run")
        case "player_reception_yds": return ("receiving-yards", "Receiving Yards", "arrow.down.right.circle.fill")
        case "player_receptions": return ("receptions", "Receptions", "hand.raised.fill")
        case "player_anytime_td": return ("anytime-td", "Anytime TD", "figure.run.circle.fill")
        default:
            return (slug(section.marketKey), section.title, "chart.line.uptrend.xyaxis")
        }
    }

    private static func slug(_ value: String) -> String {
        let allowed = CharacterSet.alphanumerics
        let scalars = value.lowercased().unicodeScalars.map { allowed.contains($0) ? Character(String($0)) : "-" }
        return String(scalars).split(separator: "-").joined(separator: "-")
    }

    private static func nowISO() -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: Date())
    }
}

import Foundation
import WagerproofModels

/// Client-side MLB Outliers trend cards from `mlb_team_trends` splits + matchups.
public enum MLBTrendsEngine {
    public static let allGamesPreviewCap = 50

    private static let teamMarkets = ["ml", "rl", "ou", "f5_ml", "f5_rl", "f5_ou"]

    /// Slate / mapping abbr → `mlb_team_trends.team_abbr` (legacy short keys in the table).
    private static let appToTrendsAbbr: [String: String] = [
        "ARI": "AZ",
        "OAK": "ATH",
        "SFG": "SF",
        "SDP": "SD",
    ]

    public static func trendsAbbr(for appAbbr: String) -> String {
        let upper = appAbbr.uppercased()
        return appToTrendsAbbr[upper] ?? upper
    }

    public static func appAbbr(forTrendsAbbr abbr: String) -> String {
        let upper = abbr.uppercased()
        for (app, trends) in appToTrendsAbbr where trends == upper {
            return app
        }
        return upper
    }

    public static func remapTeamRecord(_ record: MLBTeamTrendRecord, preferredAppAbbr: String?) -> MLBTeamTrendRecord {
        let resolvedAbbr = preferredAppAbbr ?? appAbbr(forTrendsAbbr: record.teamAbbr)
        var normalizedMatchups: [String: NFLTrendMatchupRecord] = [:]
        for (opp, value) in record.matchups {
            normalizedMatchups[appAbbr(forTrendsAbbr: opp)] = value
        }
        return MLBTeamTrendRecord(
            teamAbbr: resolvedAbbr,
            teamName: record.teamName,
            season: record.season,
            throughDate: record.throughDate,
            splits: record.splits,
            matchups: normalizedMatchups
        )
    }

    private static func matchupRecord(
        _ matchups: [String: NFLTrendMatchupRecord],
        opponent: String
    ) -> NFLTrendMatchupRecord? {
        let candidates = Set([
            opponent.uppercased(),
            trendsAbbr(for: opponent),
            appAbbr(forTrendsAbbr: opponent),
        ])
        for key in candidates {
            if let record = matchups[key] { return record }
        }
        return nil
    }

    private static let divisions: [[String]] = [
        ["BAL", "BOS", "NYY", "TBR", "TOR"],
        ["CWS", "CLE", "DET", "KC", "MIN"],
        ["HOU", "LAA", "ATH", "SEA", "TEX"],
        ["ATL", "MIA", "NYM", "PHI", "WSH"],
        ["CHC", "CIN", "MIL", "PIT", "STL"],
        ["ARI", "COL", "LAD", "SDP", "SFG"],
    ]

    public struct GameContext: Sendable {
        public let homeFavDog: String?
        public let awayFavDog: String?
        public let divisionScope: String
        public let dayNightScope: String
        public let seriesDimension: String?
    }

    public static func isDivisionGame(home: String, away: String) -> Bool {
        let homeKey = trendsAbbr(for: home)
        let awayKey = trendsAbbr(for: away)
        let normalizedDivisions: [[String]] = divisions.map { div in
            div.map { trendsAbbr(for: $0) }
        }
        return normalizedDivisions.contains { $0.contains(homeKey) && $0.contains(awayKey) }
    }

    public static func gameContext(for game: OutliersTrendsGame) -> GameContext {
        let ctx = game.mlbContext
        let homeMl = ctx?.homeMl
        let awayMl = ctx?.awayMl

        let homeFav: String?
        let awayFav: String?
        if let homeMl, let awayMl, homeMl != awayMl {
            if homeMl < awayMl {
                homeFav = "favorite"
                awayFav = "underdog"
            } else {
                homeFav = "underdog"
                awayFav = "favorite"
            }
        } else {
            homeFav = nil
            awayFav = nil
        }

        let divisionScope = (ctx?.isDivisional ?? isDivisionGame(home: game.homeAb, away: game.awayAb))
            ? "division" : "non_division"
        let dayNightScope = (ctx?.isDayGame ?? isDayGame(kickoff: game.kickoff)) ? "day" : "night"
        let seriesDimension: String?
        if let n = ctx?.seriesGameNumber, (1 ... 4).contains(n) {
            seriesDimension = "series_game_\(n)"
        } else {
            seriesDimension = nil
        }

        return GameContext(
            homeFavDog: homeFav,
            awayFavDog: awayFav,
            divisionScope: divisionScope,
            dayNightScope: dayNightScope,
            seriesDimension: seriesDimension
        )
    }

    public static func isDayGame(kickoff: String?) -> Bool {
        guard let kickoff, !kickoff.isEmpty else { return false }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var date = iso.date(from: kickoff)
        if date == nil {
            iso.formatOptions = [.withInternetDateTime]
            date = iso.date(from: kickoff)
        }
        if let date {
            var cal = Calendar(identifier: .gregorian)
            cal.timeZone = TimeZone(identifier: "America/New_York") ?? .current
            return cal.component(.hour, from: date) < 17
        }
        if let hourPart = kickoff.split(separator: "T").last?.split(separator: ":").first,
           let hour = Int(hourPart) {
            return hour < 17
        }
        return false
    }

    public static func buildCards(
        bundle: MLBTrendsSlateBundle,
        gameFilter: OutliersTrendsMatchupFilter,
        subject: OutliersTrendsSubject,
        gameMarket: OutliersTrendsGameMarket,
        visibleLimit: Int
    ) -> [OutliersTrendsCard] {
        guard subject == .all || subject == .teams else { return [] }
        let games = filteredGames(bundle.games, filter: gameFilter)
        let teamByAbbr = Dictionary(uniqueKeysWithValues: bundle.teams.map { ($0.teamAbbr, $0) })
        var cards: [OutliersTrendsCard] = []

        for game in games {
            let ctx = gameContext(for: game)
            let matchupLabel = game.label
            for (abbr, side, opp, favDog) in [
                (game.homeAb, "home", game.awayAb, ctx.homeFavDog),
                (game.awayAb, "away", game.homeAb, ctx.awayFavDog),
            ] {
                guard let team = teamByAbbr[abbr] else { continue }
                for market in teamMarkets {
                    if let gm = gameMarket.dbKey, gm != market { continue }
                    if let card = buildTeamCard(
                        team: team,
                        game: game,
                        ctx: ctx,
                        side: side,
                        opponent: opp,
                        favDog: favDog,
                        matchupLabel: matchupLabel,
                        market: market
                    ) {
                        cards.append(card)
                    }
                }
            }
        }

        cards.sort { lhs, rhs in
            if lhs.trendValue != rhs.trendValue { return lhs.trendValue > rhs.trendValue }
            return lhs.trendSampleN > rhs.trendSampleN
        }

        if case .allGames = gameFilter {
            return Array(cards.prefix(visibleLimit))
        }
        return cards
    }

    // MARK: - Card assembly

    private static func buildTeamCard(
        team: MLBTeamTrendRecord,
        game: OutliersTrendsGame,
        ctx: GameContext,
        side: String,
        opponent: String,
        favDog: String?,
        matchupLabel: String,
        market: String
    ) -> OutliersTrendsCard? {
        let dims = teamDimensionSpecs(side: side, favDog: favDog, ctx: ctx)
        var extraRows: [OutliersTrendsCardRow] = []
        if let h2h = headToHeadRow(team: team, opponent: opponent, market: market) {
            extraRows.append(h2h)
        }
        let lines = bettingLines(for: market, game: game, teamAbbr: team.teamAbbr)
        return buildSplitCard(
            idPrefix: "team-\(team.teamAbbr)-\(game.id)-\(market)",
            gameId: game.id,
            matchupLabel: matchupLabel,
            subjectName: team.teamName ?? team.teamAbbr,
            subjectDetail: team.teamAbbr,
            teamAbbr: team.teamAbbr,
            market: market,
            splits: team.splits,
            dimensions: dims,
            bettingLines: lines,
            extraRows: extraRows
        )
    }

    private static func headToHeadRow(
        team: MLBTeamTrendRecord,
        opponent: String,
        market: String
    ) -> OutliersTrendsCardRow? {
        guard let record = matchupRecord(team.matchups, opponent: opponent),
              let cell = record.markets[market] else { return nil }
        return h2hRow(cell: cell, market: market, opponent: opponent)
    }

    private struct TrendDimensionSpec: Sendable {
        let key: String
        let displayContext: String
    }

    private static func buildSplitCard(
        idPrefix: String,
        gameId: String,
        matchupLabel: String,
        subjectName: String,
        subjectDetail: String?,
        teamAbbr: String,
        market: String,
        splits: NFLTrendSplits,
        dimensions: [TrendDimensionSpec],
        bettingLines: [OutliersTrendsBettingLine],
        extraRows: [OutliersTrendsCardRow] = []
    ) -> OutliersTrendsCard? {
        var rows: [OutliersTrendsCardRow] = []
        for dim in dimensions {
            if let row = extremeSplitRow(
                splits: splits,
                market: market,
                dimension: dim.key,
                displayContext: dim.displayContext
            ) {
                rows.append(row)
            }
        }
        rows.append(contentsOf: extraRows)
        guard !rows.isEmpty else { return nil }
        let strongest = rows.max { a, b in
            if a.dominantPct != b.dominantPct { return a.dominantPct < b.dominantPct }
            return a.sampleN < b.sampleN
        }!
        return OutliersTrendsCard(
            id: idPrefix,
            gameId: gameId,
            matchupLabel: matchupLabel,
            subjectKind: .team,
            subjectName: subjectName,
            subjectDetail: subjectDetail,
            teamAbbr: teamAbbr,
            playerId: nil,
            marketKey: market,
            betTypeLabel: marketLabel(market),
            trendValue: strongest.dominantPct,
            trendSampleN: strongest.sampleN,
            lineContext: nil,
            bettingLines: bettingLines,
            rows: rows
        )
    }

    private static func teamDimensionSpecs(
        side: String,
        favDog: String?,
        ctx: GameContext
    ) -> [TrendDimensionSpec] {
        var dims: [TrendDimensionSpec] = [
            .init(key: "overall", displayContext: "games"),
            .init(
                key: side,
                displayContext: side == "home" ? "Home" : "Away"
            ),
        ]
        if let favDog {
            dims.append(.init(
                key: favDog,
                displayContext: favDog == "favorite" ? "As Favorite" : "As Underdog"
            ))
        }
        dims.append(.init(
            key: ctx.divisionScope,
            displayContext: ctx.divisionScope == "division" ? "Division" : "Non-Division"
        ))
        dims.append(.init(
            key: ctx.dayNightScope,
            displayContext: ctx.dayNightScope == "day" ? "Day Games" : "Night Games"
        ))
        if let series = ctx.seriesDimension {
            dims.append(.init(key: series, displayContext: seriesDisplayLabel(series)))
        }
        return dims
    }

    private static func seriesDisplayLabel(_ key: String) -> String {
        switch key {
        case "series_game_1": return "Series G1"
        case "series_game_2": return "Series G2"
        case "series_game_3": return "Series G3"
        case "series_game_4": return "Series G4"
        default: return key.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }

    // MARK: - Extreme stats

    private struct TrendRowMetrics {
        let count: Int
        let displayPct: Double
        let sortPct: Double
        let hitSide: Bool
        let verb: String
    }

    private static func isOverUnderMarket(_ market: String) -> Bool {
        market == "ou" || market == "f5_ou"
    }

    private static func isRunLineMarket(_ market: String) -> Bool {
        market == "rl" || market == "f5_rl"
    }

    private static func h2hCellMetrics(market: String, cell: NFLTrendH2HCell) -> TrendRowMetrics? {
        guard cell.n >= 1 else { return nil }
        let pct = cell.pct ?? (cell.n > 0 ? Double(cell.h) / Double(cell.n) : 0)
        let synthetic = NFLTrendSplitCell(h: cell.h, l: cell.l, p: 0, n: cell.n, pct: pct)
        return splitCellMetrics(market: market, cell: synthetic, minSample: 1)
    }

    private static func splitCellMetrics(
        market: String,
        cell: NFLTrendSplitCell,
        minSample: Int = 2
    ) -> TrendRowMetrics? {
        guard cell.n >= minSample else { return nil }
        if isOverUnderMarket(market) {
            let rate = cell.pct
            let hitSide = rate >= 0.5
            let count = hitSide ? cell.h : cell.l
            return TrendRowMetrics(
                count: count,
                displayPct: max(rate, 1 - rate),
                sortPct: max(rate, 1 - rate),
                hitSide: hitSide,
                verb: hitSide ? "Over" : "Under"
            )
        }
        let dominant = max(cell.pct, 1 - cell.pct)
        let hitSide = cell.pct >= 0.5
        let count = hitSide ? cell.h : cell.l
        let verb: String
        if isRunLineMarket(market) {
            verb = hitSide ? "Covered" : "Didn't cover"
        } else {
            verb = hitSide ? "Won" : "Lost"
        }
        return TrendRowMetrics(
            count: count,
            displayPct: dominant,
            sortPct: dominant,
            hitSide: hitSide,
            verb: verb
        )
    }

    private static func extremeSplitRow(
        splits: NFLTrendSplits,
        market: String,
        dimension: String,
        displayContext: String
    ) -> OutliersTrendsCardRow? {
        guard let dimBlock = splits[market]?[dimension] else { return nil }
        let windowKeys = dimBlock.keys.sorted { (Int($0) ?? 0) < (Int($1) ?? 0) }
        var best: (cell: NFLTrendSplitCell, window: String, metrics: TrendRowMetrics)?
        for window in windowKeys {
            guard let cell = dimBlock[window] else { continue }
            guard let metrics = splitCellMetrics(market: market, cell: cell) else { continue }
            if best == nil
                || metrics.sortPct > best!.metrics.sortPct
                || (metrics.sortPct == best!.metrics.sortPct && cell.n > best!.cell.n) {
                best = (cell, window, metrics)
            }
        }
        guard let best else { return nil }
        let pctText = Int((best.metrics.displayPct * 100).rounded())
        let text = "\(best.metrics.verb) \(best.metrics.count) of last \(best.cell.n) \(displayContext) (\(pctText)%)"
        return OutliersTrendsCardRow(
            id: "\(market)-\(dimension)-\(best.window)",
            text: text,
            coverageNote: nil,
            dominantPct: best.metrics.displayPct,
            sampleN: best.cell.n
        )
    }

    private static func h2hRow(
        cell: NFLTrendH2HCell,
        market: String,
        opponent: String
    ) -> OutliersTrendsCardRow? {
        guard let metrics = h2hCellMetrics(market: market, cell: cell) else { return nil }
        let pctText = Int((metrics.displayPct * 100).rounded())
        let oppLabel = opponent.uppercased()
        let text = "\(metrics.verb) \(metrics.count) of last \(cell.n) vs \(oppLabel) (\(pctText)%)"
        let note = cell.n < 3 ? "Small sample (\(cell.n) game\(cell.n == 1 ? "" : "s"))" : nil
        return OutliersTrendsCardRow(
            id: "\(market)-h2h-\(oppLabel)",
            text: text,
            coverageNote: note,
            dominantPct: metrics.displayPct,
            sampleN: cell.n
        )
    }

    private static func filteredGames(
        _ games: [OutliersTrendsGame],
        filter: OutliersTrendsMatchupFilter
    ) -> [OutliersTrendsGame] {
        switch filter {
        case .allGames: return games
        case .game(let id): return games.filter { $0.id == id }
        }
    }

    public static func marketLabel(_ market: String) -> String {
        switch market {
        case "ml": return "Moneyline"
        case "rl": return "Run Line"
        case "ou": return "Total"
        case "f5_ml": return "F5 Moneyline"
        case "f5_rl": return "F5 Run Line"
        case "f5_ou": return "F5 Total"
        default: return market.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }

    static func bettingLines(
        for market: String,
        game: OutliersTrendsGame,
        teamAbbr: String
    ) -> [OutliersTrendsBettingLine] {
        guard let ctx = game.mlbContext else { return [] }
        let isHome = teamAbbr.uppercased() == game.homeAb.uppercased()
        let prefix = "\(teamAbbr)-\(game.id)-\(market)"

        switch market {
        case "ml":
            guard let odds = isHome ? ctx.homeMl : ctx.awayMl else { return [] }
            return [
                OutliersTrendsBettingLine(
                    id: "\(prefix)-ml",
                    label: "Moneyline",
                    lineText: "ML",
                    oddsText: formatAmerican(odds),
                    teamAbbr: teamAbbr
                ),
            ]
        case "rl":
            let spread = isHome ? ctx.homeSpread : ctx.awaySpread
            let juice = isHome ? ctx.homeSpreadOdds : ctx.awaySpreadOdds
            guard let spread else { return [] }
            return [
                OutliersTrendsBettingLine(
                    id: "\(prefix)-rl",
                    label: "Run Line",
                    lineText: formatSpread(spread),
                    oddsText: juice.map(formatAmerican),
                    teamAbbr: teamAbbr
                ),
            ]
        case "ou":
            guard let total = ctx.totalLine else { return [] }
            let totalText = total.formattedLine()
            var lines: [OutliersTrendsBettingLine] = []
            if let overOdds = ctx.totalOverOdds {
                lines.append(OutliersTrendsBettingLine(
                    id: "\(prefix)-over",
                    label: "Over",
                    lineText: "Over \(totalText)",
                    oddsText: formatAmerican(overOdds)
                ))
            }
            if let underOdds = ctx.totalUnderOdds {
                lines.append(OutliersTrendsBettingLine(
                    id: "\(prefix)-under",
                    label: "Under",
                    lineText: "Under \(totalText)",
                    oddsText: formatAmerican(underOdds)
                ))
            }
            if lines.isEmpty {
                lines.append(OutliersTrendsBettingLine(
                    id: "\(prefix)-total",
                    label: "Total",
                    lineText: totalText,
                    oddsText: nil
                ))
            }
            return lines
        case "f5_ml":
            guard let odds = isHome ? ctx.f5HomeMl : ctx.f5AwayMl else { return [] }
            return [
                OutliersTrendsBettingLine(
                    id: "\(prefix)-f5-ml",
                    label: "F5 Moneyline",
                    lineText: "F5 ML",
                    oddsText: formatAmerican(odds),
                    teamAbbr: teamAbbr
                ),
            ]
        case "f5_rl":
            let spread = isHome ? ctx.f5HomeSpread : ctx.f5AwaySpread
            let juice = isHome ? ctx.f5HomeSpreadOdds : ctx.f5AwaySpreadOdds
            guard let spread else { return [] }
            return [
                OutliersTrendsBettingLine(
                    id: "\(prefix)-f5-rl",
                    label: "F5 Run Line",
                    lineText: formatSpread(spread),
                    oddsText: juice.map(formatAmerican),
                    teamAbbr: teamAbbr
                ),
            ]
        case "f5_ou":
            guard let total = ctx.f5TotalLine else { return [] }
            let totalText = total.formattedLine()
            var lines: [OutliersTrendsBettingLine] = []
            if let overOdds = ctx.f5TotalOverOdds {
                lines.append(OutliersTrendsBettingLine(
                    id: "\(prefix)-f5-over",
                    label: "Over",
                    lineText: "Over \(totalText)",
                    oddsText: formatAmerican(overOdds)
                ))
            }
            if let underOdds = ctx.f5TotalUnderOdds {
                lines.append(OutliersTrendsBettingLine(
                    id: "\(prefix)-f5-under",
                    label: "Under",
                    lineText: "Under \(totalText)",
                    oddsText: formatAmerican(underOdds)
                ))
            }
            if lines.isEmpty {
                lines.append(OutliersTrendsBettingLine(
                    id: "\(prefix)-f5-total",
                    label: "F5 Total",
                    lineText: totalText,
                    oddsText: nil
                ))
            }
            return lines
        default:
            return []
        }
    }

    private static func formatSpread(_ value: Double) -> String {
        if value == value.rounded() { return value > 0 ? "+\(Int(value))" : "\(Int(value))" }
        let body = String(format: "%.1f", value)
        return value > 0 ? "+\(body)" : body
    }

    private static func formatAmerican(_ value: Double) -> String {
        let iv = Int(value.rounded())
        return iv > 0 ? "+\(iv)" : "\(iv)"
    }
}

private extension Double {
    func formattedLine() -> String {
        if self == rounded() { return String(format: "%.0f", self) }
        return String(format: "%.1f", self)
    }
}

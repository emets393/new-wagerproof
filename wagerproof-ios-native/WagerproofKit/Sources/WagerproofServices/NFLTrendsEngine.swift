import Foundation
import WagerproofModels

/// Pure logic: game context, extreme-window stats, card assembly.
/// Ports `research/nfl-extreme-outcomes/CURSOR_OUTLIERS_TRENDS_PROMPT.md` §3–5.
public enum NFLTrendsEngine {
    public static let playerPreviewCap = 4
    public static let allGamesPreviewCap = 50

    private static let divisions: [[String]] = [
        ["BUF", "MIA", "NE", "NYJ"],
        ["BAL", "CIN", "CLE", "PIT"],
        ["HOU", "IND", "JAX", "TEN"],
        ["DEN", "KC", "LV", "LAC"],
        ["DAL", "NYG", "PHI", "WAS"],
        ["CHI", "DET", "GB", "MIN"],
        ["ATL", "CAR", "NO", "TB"],
        ["ARI", "LA", "SF", "SEA"],
    ]

    private static let teamMarkets = ["spread", "moneyline", "total", "team_total", "h1_spread", "h1_total"]
    private static let coachMarkets = teamMarkets
    private static let refereeMarkets = ["spread", "moneyline", "total", "h1_spread", "h1_total"]

    public static func isDivisionGame(home: String, away: String) -> Bool {
        divisions.contains { $0.contains(home) && $0.contains(away) }
    }

    public struct GameContext: Sendable {
        public let homeFavDog: String?
        public let awayFavDog: String?
        public let divisionScope: String
        public let primetimeScope: String
    }

    public static func gameContext(for game: OutliersTrendsGame) -> GameContext {
        let spread = game.fgSpreadClose ?? 0
        let homeFav: String?
        let awayFav: String?
        if spread == 0 {
            homeFav = nil
            awayFav = nil
        } else if spread < 0 {
            homeFav = "favorite"
            awayFav = "underdog"
        } else {
            homeFav = "underdog"
            awayFav = "favorite"
        }
        return GameContext(
            homeFavDog: homeFav,
            awayFavDog: awayFav,
            divisionScope: isDivisionGame(home: game.homeAb, away: game.awayAb) ? "division" : "non_division",
            primetimeScope: isPrimetime(kickoff: game.kickoff) ? "primetime" : "regular"
        )
    }

    public static func isPrimetime(kickoff: String?) -> Bool {
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
            return cal.component(.hour, from: date) >= 19
        }
        if let hourPart = kickoff.split(separator: "T").last?.split(separator: ":").first,
           let hour = Int(hourPart) {
            return hour >= 19
        }
        return false
    }

    /// Filters pre-rendered cards from outliers trend card tables (same rules as `buildCards`).
    public static func filterPrecomputedCards(
        _ cards: [OutliersTrendsCard],
        games: [OutliersTrendsGame],
        sport: OutliersTrendsSport,
        gameFilter: OutliersTrendsMatchupFilter,
        subject: OutliersTrendsSubject,
        gameMarket: OutliersTrendsGameMarket,
        propMarket: OutliersTrendsPropMarket,
        includeAllPlayers: Bool,
        visibleLimit: Int
    ) -> [OutliersTrendsCard] {
        let gamesById = Dictionary(uniqueKeysWithValues: games.map { ($0.id, $0) })
        var filtered = cards.filter { card in
            guard matchesSlateScope(card, gamesById: gamesById) else { return false }
            guard matchesSubjectFilter(card, subject: subject) else { return false }
            guard matchesMarketFilter(card, gameMarket: gameMarket, propMarket: propMarket) else { return false }
            guard hasDisplayableBettingLine(card, sport: sport) else { return false }
            switch gameFilter {
            case .allGames: return true
            case .game(let id): return card.gameId == id
            }
        }

        if sport == .nfl,
           case .game(let gameId) = gameFilter,
           let game = games.first(where: { $0.id == gameId }) {
            var nonPlayers = filtered.filter { $0.subjectKind != .player }
            var playerCards = filtered.filter { $0.subjectKind == .player && !$0.isPlayerOverflow }
            playerCards.sort { lhs, rhs in
                compareCardsForDisplay(lhs, rhs, subject: subject, propMarket: propMarket)
            }
            let home = capPlayers(
                playerCards.filter { $0.teamAbbr == game.homeAb },
                teamAb: game.homeAb, game: game, includeAll: includeAllPlayers
            )
            let away = capPlayers(
                playerCards.filter { $0.teamAbbr == game.awayAb },
                teamAb: game.awayAb, game: game, includeAll: includeAllPlayers
            )
            filtered = nonPlayers + home + away
        }

        filtered.sort { lhs, rhs in
            compareCardsForDisplay(lhs, rhs, subject: subject, propMarket: propMarket)
        }

        if case .allGames = gameFilter {
            return Array(filtered.prefix(visibleLimit))
        }
        return filtered
    }

    private static func hasDisplayableBettingLine(_ card: OutliersTrendsCard, sport: OutliersTrendsSport) -> Bool {
        if sport == .ncaaf { return true }
        if card.subjectKind == .player && !card.isPlayerOverflow {
            return !card.bettingLines.isEmpty
        }
        return true
    }

    private static func teamMatchesGame(_ teamKey: String, game: OutliersTrendsGame) -> Bool {
        teamKey == game.homeAb || teamKey == game.awayAb
            || teamKey == game.homeTeam || teamKey == game.awayTeam
    }

    /// Only subjects tied to the current slate week — assigned ref, teams in the game, etc.
    private static func matchesSlateScope(
        _ card: OutliersTrendsCard,
        gamesById: [String: OutliersTrendsGame]
    ) -> Bool {
        guard let game = gamesById[card.gameId] else { return false }
        switch card.subjectKind {
        case .referee:
            guard let assigned = game.assignedReferee, !assigned.isEmpty else { return false }
            return card.subjectName == assigned
        case .team, .coach, .player:
            guard let teamKey = card.teamAbbr else { return false }
            return teamMatchesGame(teamKey, game: game)
        }
    }

    /// Refs/coaches don't have every game market — ignore stale picks from another subject tab.
    public static func effectiveGameMarket(
        for subject: OutliersTrendsSubject,
        selected: OutliersTrendsGameMarket
    ) -> OutliersTrendsGameMarket {
        let allowed: [OutliersTrendsGameMarket]
        switch subject {
        case .refs:
            allowed = [.all, .spread, .moneyline, .total, .h1Spread, .h1Total]
        case .teams:
            allowed = [.all, .spread, .moneyline, .total, .teamTotal, .h1Spread, .h1Total]
        default:
            return selected
        }
        return allowed.contains(selected) ? selected : .all
    }

    private static func compareCardsForDisplay(
        _ lhs: OutliersTrendsCard,
        _ rhs: OutliersTrendsCard,
        subject: OutliersTrendsSubject,
        propMarket: OutliersTrendsPropMarket
    ) -> Bool {
        if lhs.trendValue != rhs.trendValue { return lhs.trendValue > rhs.trendValue }
        return lhs.trendSampleN > rhs.trendSampleN
    }

    private static func matchesSubjectFilter(_ card: OutliersTrendsCard, subject: OutliersTrendsSubject) -> Bool {
        switch subject {
        case .all: return true
        case .teams: return card.subjectKind == .team
        case .coaches: return card.subjectKind == .coach
        case .refs: return card.subjectKind == .referee
        case .players: return card.subjectKind == .player
        }
    }

    private static func matchesMarketFilter(
        _ card: OutliersTrendsCard,
        gameMarket: OutliersTrendsGameMarket,
        propMarket: OutliersTrendsPropMarket
    ) -> Bool {
        if card.subjectKind == .player {
            guard let key = propMarket.dbKey else { return true }
            return card.marketKey == key
        }
        guard let key = gameMarket.dbKey else { return true }
        return card.marketKey == key
    }

    public static func buildCards(
        bundle: NFLTrendsSlateBundle,
        gameFilter: OutliersTrendsMatchupFilter,
        subject: OutliersTrendsSubject,
        gameMarket: OutliersTrendsGameMarket,
        propMarket: OutliersTrendsPropMarket,
        includeAllPlayers: Bool,
        visibleLimit: Int
    ) -> [OutliersTrendsCard] {
        let games = filteredGames(bundle.games, filter: gameFilter)
        var cards: [OutliersTrendsCard] = []

        let teamByAbbr = Dictionary(uniqueKeysWithValues: bundle.teams.map { ($0.teamAbbr, $0) })
        let coachByTeam = activeCoachesByTeam(bundle.coaches)
        let refByName = Dictionary(uniqueKeysWithValues: bundle.referees.map { ($0.referee, $0) })
        let playersByTeam = Dictionary(grouping: bundle.players) { $0.currentTeam ?? "" }

        for game in games {
            let ctx = gameContext(for: game)
            let matchupLabel = game.label

            if subject == .all || subject == .teams {
                appendTeamCards(
                    &cards, game: game, ctx: ctx, matchupLabel: matchupLabel,
                    teamByAbbr: teamByAbbr, gameMarket: gameMarket
                )
            }

            if subject == .all || subject == .coaches {
                appendCoachCards(
                    &cards, game: game, ctx: ctx, matchupLabel: matchupLabel,
                    coachByTeam: coachByTeam, gameMarket: gameMarket
                )
            }

            if subject == .all || subject == .refs,
               let refName = game.assignedReferee, !refName.isEmpty,
               let ref = refByName[refName] {
                appendRefereeCards(
                    &cards, ref: ref, game: game, ctx: ctx,
                    matchupLabel: matchupLabel, gameMarket: gameMarket
                )
            }

            if subject == .all || subject == .players {
                appendPlayerCards(
                    &cards, game: game, ctx: ctx, matchupLabel: matchupLabel,
                    playersByTeam: playersByTeam, propMarket: propMarket,
                    gameFilter: gameFilter, includeAllPlayers: includeAllPlayers
                )
            }
        }

        cards.sort { lhs, rhs in
            compareCardsForDisplay(lhs, rhs, subject: subject, propMarket: propMarket)
        }

        if case .allGames = gameFilter {
            return Array(cards.prefix(visibleLimit))
        }
        return cards
    }

    // MARK: - Card assembly

    private static func appendTeamCards(
        _ cards: inout [OutliersTrendsCard],
        game: OutliersTrendsGame,
        ctx: GameContext,
        matchupLabel: String,
        teamByAbbr: [String: NFLTeamTrendRecord],
        gameMarket: OutliersTrendsGameMarket
    ) {
        for (abbr, side, opp, favDog) in [
            (game.homeAb, "home", game.awayAb, ctx.homeFavDog),
            (game.awayAb, "away", game.homeAb, ctx.awayFavDog),
        ] {
            guard let team = teamByAbbr[abbr] else { continue }
            let dims = teamDimensionSpecs(side: side, favDog: favDog, opponent: opp)
            for market in teamMarkets {
                if let gm = gameMarket.dbKey, gm != market { continue }
                if let card = buildSubjectCard(
                    idPrefix: "team-\(team.teamAbbr)-\(game.id)-\(market)",
                    gameId: game.id,
                    matchupLabel: matchupLabel,
                    kind: .team,
                    subjectName: team.teamName ?? team.teamAbbr,
                    subjectDetail: team.teamAbbr,
                    teamAbbr: team.teamAbbr,
                    playerId: nil,
                    market: market,
                    isReferee: false,
                    splits: team.splits,
                    h2h: team.matchups[opp],
                    dimensions: dims,
                    coverage: nil,
                    lineContext: lineContext(for: market, game: game, teamAbbr: abbr)
                ) {
                    cards.append(card)
                }
            }
        }
    }

    private static func appendCoachCards(
        _ cards: inout [OutliersTrendsCard],
        game: OutliersTrendsGame,
        ctx: GameContext,
        matchupLabel: String,
        coachByTeam: [String: NFLCoachTrendRecord],
        gameMarket: OutliersTrendsGameMarket
    ) {
        for (abbr, side, opp, favDog) in [
            (game.homeAb, "home", game.awayAb, ctx.homeFavDog),
            (game.awayAb, "away", game.homeAb, ctx.awayFavDog),
        ] {
            guard let coach = coachByTeam[abbr] else { continue }
            let dims = coachDimensionSpecs(side: side, favDog: favDog, ctx: ctx, opponent: opp)
            for market in coachMarkets {
                if let gm = gameMarket.dbKey, gm != market { continue }
                if let card = buildSubjectCard(
                    idPrefix: "coach-\(coach.coach)-\(game.id)-\(market)",
                    gameId: game.id,
                    matchupLabel: matchupLabel,
                    kind: .coach,
                    subjectName: coach.coach,
                    subjectDetail: coachDetail(coach),
                    teamAbbr: abbr,
                    playerId: nil,
                    market: market,
                    isReferee: false,
                    splits: coach.splits,
                    h2h: coach.matchups[opp],
                    dimensions: dims,
                    coverage: coach.marketCoverage?[market],
                    lineContext: lineContext(for: market, game: game, teamAbbr: abbr)
                ) {
                    cards.append(card)
                }
            }
        }
    }

    private static func appendRefereeCards(
        _ cards: inout [OutliersTrendsCard],
        ref: NFLRefereeTrendRecord,
        game: OutliersTrendsGame,
        ctx: GameContext,
        matchupLabel: String,
        gameMarket: OutliersTrendsGameMarket
    ) {
        let dims = refereeDimensionSpecs(ctx: ctx)
        for market in refereeMarkets {
            if let gm = gameMarket.dbKey, gm != market { continue }
            if let card = buildSubjectCard(
                idPrefix: "ref-\(ref.referee)-\(game.id)-\(market)",
                gameId: game.id,
                matchupLabel: matchupLabel,
                kind: .referee,
                subjectName: ref.referee,
                subjectDetail: ref.careerGames.map { "\($0) career games" },
                teamAbbr: nil,
                playerId: nil,
                market: market,
                isReferee: true,
                splits: ref.splits,
                h2h: nil,
                dimensions: dims,
                coverage: ref.marketCoverage?[market],
                lineContext: lineContext(for: market, game: game, teamAbbr: game.homeAb)
            ) {
                cards.append(card)
            }
        }
    }

    private static func appendPlayerCards(
        _ cards: inout [OutliersTrendsCard],
        game: OutliersTrendsGame,
        ctx: GameContext,
        matchupLabel: String,
        playersByTeam: [String: [NFLPlayerPropTrendRecord]],
        propMarket: OutliersTrendsPropMarket,
        gameFilter: OutliersTrendsMatchupFilter,
        includeAllPlayers: Bool
    ) {
        let allPlayers = (playersByTeam[game.homeAb] ?? []) + (playersByTeam[game.awayAb] ?? [])
        var playerCards: [OutliersTrendsCard] = []
        for player in allPlayers {
            let teamAb = player.currentTeam ?? ""
            let side = teamAb == game.homeAb ? "home" : "away"
            let opponent = teamAb == game.homeAb ? game.awayAb : game.homeAb
            let dims = playerDimensionSpecs(side: side, ctx: ctx, opponent: opponent)
            for market in playerMarkets(for: player) {
                if let pm = propMarket.dbKey, pm != market { continue }
                if let card = buildSubjectCard(
                    idPrefix: "player-\(player.playerId)-\(game.id)-\(market)",
                    gameId: game.id,
                    matchupLabel: matchupLabel,
                    kind: .player,
                    subjectName: player.playerName ?? "Player",
                    subjectDetail: playerDetail(player),
                    teamAbbr: player.currentTeam,
                    playerId: player.playerId,
                    market: market,
                    isReferee: false,
                    splits: player.splits,
                    h2h: playerMatchup(player, opponent: opponent),
                    dimensions: dims,
                    coverage: player.coverage,
                    lineContext: nil
                ) {
                    playerCards.append(card)
                }
            }
        }
        playerCards.sort { lhs, rhs in
            if lhs.trendValue != rhs.trendValue { return lhs.trendValue > rhs.trendValue }
            return lhs.trendSampleN > rhs.trendSampleN
        }

        if case .game = gameFilter {
            let home = capPlayers(playerCards.filter { $0.teamAbbr == game.homeAb }, teamAb: game.homeAb, game: game, includeAll: includeAllPlayers)
            let away = capPlayers(playerCards.filter { $0.teamAbbr == game.awayAb }, teamAb: game.awayAb, game: game, includeAll: includeAllPlayers)
            cards.append(contentsOf: home + away)
        } else {
            cards.append(contentsOf: playerCards)
        }
    }

    private struct TrendDimensionSpec: Sendable {
        let key: String
        let displayContext: String
        let isH2H: Bool
        let opponent: String?
    }

    private static func buildSubjectCard(
        idPrefix: String,
        gameId: String,
        matchupLabel: String,
        kind: OutliersTrendsSubjectKind,
        subjectName: String,
        subjectDetail: String?,
        teamAbbr: String?,
        playerId: String?,
        market: String,
        isReferee: Bool,
        splits: NFLTrendSplits,
        h2h: NFLTrendMatchupRecord?,
        dimensions: [TrendDimensionSpec],
        coverage: String?,
        lineContext: String?
    ) -> OutliersTrendsCard? {
        var rows: [OutliersTrendsCardRow] = []
        for dim in dimensions {
            if dim.isH2H {
                if let opp = dim.opponent,
                   let cell = h2h?.markets[market],
                   let row = extremeH2HRow(cell: cell, market: market, isReferee: isReferee, opponent: opp, coverage: coverage) {
                    rows.append(row)
                }
                continue
            }
            if let row = extremeSplitRow(
                splits: splits,
                market: market,
                dimension: dim.key,
                displayContext: dim.displayContext,
                isReferee: isReferee,
                coverage: coverage
            ) {
                rows.append(row)
            }
        }
        guard !rows.isEmpty else { return nil }
        let strongest = rows.max { a, b in
            if a.dominantPct != b.dominantPct { return a.dominantPct < b.dominantPct }
            return a.sampleN < b.sampleN
        }!
        return OutliersTrendsCard(
            id: idPrefix,
            gameId: gameId,
            matchupLabel: matchupLabel,
            subjectKind: kind,
            subjectName: subjectName,
            subjectDetail: subjectDetail,
            teamAbbr: teamAbbr,
            playerId: playerId,
            marketKey: market,
            betTypeLabel: marketLabel(market),
            trendValue: strongest.dominantPct,
            trendSampleN: strongest.sampleN,
            lineContext: lineContext,
            rows: rows
        )
    }

    // MARK: - Extreme stats

    private struct TrendRowMetrics {
        let count: Int
        let displayPct: Double
        let sortPct: Double
        let hitSide: Bool
        let verb: String
    }

    /// Anytime TD is always shown/sorted from the Yes (scored) perspective.
    private static func splitCellMetrics(
        market: String,
        cell: NFLTrendSplitCell,
        isReferee: Bool
    ) -> TrendRowMetrics? {
        guard cell.n >= 2 else { return nil }
        if market == "player_anytime_td" {
            let scored = cell.h
            let rate = cell.pct
            return TrendRowMetrics(
                count: scored,
                displayPct: rate,
                sortPct: rate,
                hitSide: true,
                verb: "Scored"
            )
        }
        let dominant = max(cell.pct, 1 - cell.pct)
        let hitSide = cell.pct >= 0.5
        let count = hitSide ? cell.h : cell.l
        return TrendRowMetrics(
            count: count,
            displayPct: dominant,
            sortPct: dominant,
            hitSide: hitSide,
            verb: verb(for: market, hitSide: hitSide, isReferee: isReferee)
        )
    }

    private static func h2hCellMetrics(
        market: String,
        cell: NFLTrendH2HCell,
        isReferee: Bool
    ) -> TrendRowMetrics? {
        guard cell.n >= 2 else { return nil }
        let pct = cell.pct ?? (cell.n > 0 ? Double(cell.h) / Double(cell.n) : 0)
        let synthetic = NFLTrendSplitCell(h: cell.h, l: cell.l, p: 0, n: cell.n, pct: pct)
        return splitCellMetrics(market: market, cell: synthetic, isReferee: isReferee)
    }

    private static func extremeSplitRow(
        splits: NFLTrendSplits,
        market: String,
        dimension: String,
        displayContext: String,
        isReferee: Bool,
        coverage: String?
    ) -> OutliersTrendsCardRow? {
        guard let dimBlock = splits[market]?[dimension] else { return nil }
        let windowKeys = dimBlock.keys.sorted { (Int($0) ?? 0) < (Int($1) ?? 0) }
        var best: (cell: NFLTrendSplitCell, window: String, metrics: TrendRowMetrics)?
        for window in windowKeys {
            guard let cell = dimBlock[window] else { continue }
            guard let metrics = splitCellMetrics(market: market, cell: cell, isReferee: isReferee) else { continue }
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
            coverageNote: coverageChip(coverage),
            dominantPct: best.metrics.displayPct,
            sampleN: best.cell.n
        )
    }

    private static func extremeH2HRow(
        cell: NFLTrendH2HCell,
        market: String,
        isReferee: Bool,
        opponent: String,
        coverage: String?
    ) -> OutliersTrendsCardRow? {
        guard let metrics = h2hCellMetrics(market: market, cell: cell, isReferee: isReferee) else { return nil }
        let pctText = Int((metrics.displayPct * 100).rounded())
        let text = "\(metrics.verb) \(metrics.count) of last \(cell.n) vs \(opponent) (\(pctText)%)"
        return OutliersTrendsCardRow(
            id: "\(market)-h2h-\(opponent)",
            text: text,
            coverageNote: coverageChip(coverage),
            dominantPct: metrics.displayPct,
            sampleN: cell.n
        )
    }

    // MARK: - Dimensions

    private static func teamDimensionSpecs(side: String, favDog: String?, opponent: String) -> [TrendDimensionSpec] {
        var dims: [TrendDimensionSpec] = [
            .init(key: "overall", displayContext: "games", isH2H: false, opponent: nil),
            .init(key: side, displayContext: side == "home" ? "home games" : "road games", isH2H: false, opponent: nil),
        ]
        if let favDog {
            dims.append(.init(
                key: favDog,
                displayContext: favDog == "favorite" ? "as a favorite" : "as an underdog",
                isH2H: false,
                opponent: nil
            ))
        }
        dims.append(.init(key: "h2h", displayContext: "vs \(opponent)", isH2H: true, opponent: opponent))
        return dims
    }

    private static func coachDimensionSpecs(side: String, favDog: String?, ctx: GameContext, opponent: String) -> [TrendDimensionSpec] {
        var dims = teamDimensionSpecs(side: side, favDog: favDog, opponent: opponent)
        dims.insert(.init(
            key: ctx.divisionScope,
            displayContext: ctx.divisionScope == "division" ? "division games" : "non-division games",
            isH2H: false,
            opponent: nil
        ), at: dims.count - 1)
        dims.insert(.init(
            key: ctx.primetimeScope,
            displayContext: ctx.primetimeScope == "primetime" ? "primetime games" : "non-primetime games",
            isH2H: false,
            opponent: nil
        ), at: dims.count - 1)
        return dims
    }

    private static func refereeDimensionSpecs(ctx: GameContext) -> [TrendDimensionSpec] {
        [
            .init(key: "overall", displayContext: "games", isH2H: false, opponent: nil),
            .init(key: ctx.divisionScope, displayContext: ctx.divisionScope == "division" ? "division games" : "non-division games", isH2H: false, opponent: nil),
            .init(key: ctx.primetimeScope, displayContext: ctx.primetimeScope == "primetime" ? "primetime games" : "non-primetime games", isH2H: false, opponent: nil),
        ]
    }

    private static func playerDimensionSpecs(side: String, ctx: GameContext, opponent: String) -> [TrendDimensionSpec] {
        [
            .init(key: "overall", displayContext: "games", isH2H: false, opponent: nil),
            .init(key: side, displayContext: side == "home" ? "home games" : "road games", isH2H: false, opponent: nil),
            .init(
                key: ctx.divisionScope,
                displayContext: ctx.divisionScope == "division" ? "division games" : "non-division games",
                isH2H: false,
                opponent: nil
            ),
            .init(
                key: ctx.primetimeScope,
                displayContext: ctx.primetimeScope == "primetime" ? "primetime games" : "non-primetime games",
                isH2H: false,
                opponent: nil
            ),
            .init(key: "h2h", displayContext: "vs \(opponent)", isH2H: true, opponent: opponent),
        ]
    }

    private static func playerMatchup(_ player: NFLPlayerPropTrendRecord, opponent: String) -> NFLTrendMatchupRecord? {
        if let hit = player.matchups[opponent] { return hit }
        let abbr = NFLTeams.abbr(for: opponent)
        return player.matchups[abbr]
    }

    // MARK: - Helpers

    private static func playerMarkets(for player: NFLPlayerPropTrendRecord) -> [String] {
        if player.markets.isEmpty {
            return ["player_pass_yds", "player_pass_tds", "player_receptions", "player_reception_yds", "player_rush_yds", "player_anytime_td"]
        }
        return player.markets
    }

    private static func activeCoachesByTeam(_ coaches: [NFLCoachTrendRecord]) -> [String: NFLCoachTrendRecord] {
        var best: [String: NFLCoachTrendRecord] = [:]
        for coach in coaches {
            guard let team = coach.currentTeam, !team.isEmpty else { continue }
            if let existing = best[team] {
                if (coach.lastSeason ?? 0) > (existing.lastSeason ?? 0) {
                    best[team] = coach
                }
            } else {
                best[team] = coach
            }
        }
        return best
    }

    private static func filteredGames(_ games: [OutliersTrendsGame], filter: OutliersTrendsMatchupFilter) -> [OutliersTrendsGame] {
        switch filter {
        case .allGames: return games
        case .game(let id): return games.filter { $0.id == id }
        }
    }

    private static func capPlayers(
        _ cards: [OutliersTrendsCard],
        teamAb: String,
        game: OutliersTrendsGame,
        includeAll: Bool
    ) -> [OutliersTrendsCard] {
        guard !includeAll, cards.count > playerPreviewCap else { return cards }
        let visible = Array(cards.prefix(playerPreviewCap))
        let hidden = cards.count - playerPreviewCap
        let overflow = OutliersTrendsCard(
            id: "player-overflow-\(teamAb)-\(game.id)",
            gameId: game.id,
            matchupLabel: game.label,
            subjectKind: .player,
            subjectName: "See all \(teamAb) players",
            subjectDetail: "+\(hidden) more player trends",
            teamAbbr: teamAb,
            playerId: nil,
            marketKey: "overflow",
            betTypeLabel: "Players",
            trendValue: cards[playerPreviewCap].trendValue,
            trendSampleN: 0,
            lineContext: nil,
            rows: [],
            isPlayerOverflow: true
        )
        return visible + [overflow]
    }

    private static func coachDetail(_ coach: NFLCoachTrendRecord) -> String? {
        var parts: [String] = []
        if let team = coach.currentTeam { parts.append(team) }
        if let games = coach.careerGames { parts.append("\(games) career games") }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    private static func playerDetail(_ player: NFLPlayerPropTrendRecord) -> String? {
        var parts: [String] = []
        if let pos = player.position { parts.append(pos) }
        if let team = player.currentTeam { parts.append(team) }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    private static func coverageChip(_ coverage: String?) -> String? {
        guard let coverage, coverage.lowercased() != "career" else { return nil }
        if coverage.contains("2023") { return "2023–25" }
        if coverage.contains("2024") { return "2024–25" }
        return coverage
    }

    public static func marketLabel(_ market: String) -> String {
        switch market {
        case "spread": return "Spread"
        case "moneyline": return "Moneyline"
        case "total": return "Total"
        case "team_total": return "Team Total"
        case "h1_spread": return "1H Spread"
        case "h1_total": return "1H Total"
        case "player_anytime_td": return "Anytime TD"
        case "player_rush_yds": return "Rushing Yards"
        case "player_reception_yds": return "Receiving Yards"
        case "player_receptions": return "Receptions"
        case "player_pass_yds": return "Passing Yards"
        case "player_pass_tds": return "Passing TDs"
        default: return market.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }

    private static func verb(for market: String, hitSide: Bool, isReferee: Bool) -> String {
        switch market {
        case "spread":
            if isReferee { return hitSide ? "Home covered" : "Away covered" }
            return hitSide ? "Covered" : "Failed to cover"
        case "moneyline":
            if isReferee { return hitSide ? "Home won" : "Away won" }
            return hitSide ? "Won" : "Lost"
        case "total", "team_total", "h1_total",
             "player_pass_yds", "player_pass_tds", "player_receptions",
             "player_reception_yds", "player_rush_yds":
            return hitSide ? "Over" : "Under"
        case "h1_spread":
            if isReferee { return hitSide ? "Home covered 1H" : "Away covered 1H" }
            return hitSide ? "Covered 1H" : "Failed to cover 1H"
        case "player_anytime_td":
            return hitSide ? "Scored" : "Didn't score"
        default:
            return hitSide ? "Hit" : "Missed"
        }
    }

    private static func lineContext(for market: String, game: OutliersTrendsGame, teamAbbr: String) -> String? {
        switch market {
        case "spread":
            guard let spread = game.fgSpreadClose else { return nil }
            let teamSpread = teamAbbr == game.homeAb ? spread : -spread
            return "Line \(formatSpread(teamSpread))"
        case "total":
            return game.fgTotalClose.map { "Total \($0.formattedLine())" }
        case "team_total":
            return "Team total on slate"
        case "moneyline":
            return "Moneyline on slate"
        case "h1_spread", "h1_total":
            return "1H line on slate"
        default:
            return nil
        }
    }

    private static func formatSpread(_ value: Double) -> String {
        if value == value.rounded() { return value > 0 ? "+\(Int(value))" : "\(Int(value))" }
        let body = String(format: "%.1f", value)
        return value > 0 ? "+\(body)" : body
    }
}

private extension Double {
    func formattedLine() -> String {
        if self == rounded() { return String(format: "%.0f", self) }
        return String(format: "%.1f", self)
    }
}

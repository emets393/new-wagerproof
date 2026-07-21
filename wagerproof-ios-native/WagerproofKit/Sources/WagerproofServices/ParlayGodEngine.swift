import Foundation
import WagerproofModels

/// Builds Parlay God legs + tickets from the MLB trends bundle and the
/// player-props slate. Pure functions — the store feeds it data and caches
/// the output. Rules validated against live data in .context/parlay_god_demo.py
/// before this port; keep the two in sync if tuning constants.
public enum ParlayGodEngine {
    // MARK: - Tuning

    /// A streak qualifies at N of N with N >= this.
    public static let minSample = 3
    /// Steepest juice allowed on a leg (american odds).
    public static let oddsFloor = -350
    /// Alternate-line legs need a deeper current streak than the base gate —
    /// otherwise every heavy alt line qualifies and the category is all chalk.
    public static let altLineMinStreak = 7
    /// Rail tickets aim for 5 legs; anything under this many doesn't render.
    public static let maxLegs = 5
    public static let minLegs = 3
    /// Same-game (matchup widget) tickets are smaller — one game rarely has
    /// five independent perfect streaks.
    public static let sameGameMaxLegs = 4
    /// Max legs per market per ticket, so a card isn't five "1+ Hits".
    public static let marketCap = 2

    // MARK: - Odds math

    public static func decimalOdds(_ american: Int) -> Double {
        american > 0 ? 1 + Double(american) / 100 : 1 + 100 / Double(-american)
    }

    public static func americanText(fromDecimal d: Double) -> String {
        guard d > 1 else { return "-" }
        if d >= 2 { return "+\(Int(((d - 1) * 100).rounded()))" }
        return "\(Int((-100 / (d - 1)).rounded()))"
    }

    public static func combinedOddsText(_ legs: [ParlayLeg]) -> String {
        americanText(fromDecimal: legs.reduce(1.0) { $0 * decimalOdds($1.odds) })
    }

    private static func oddsOk(_ odds: Int?) -> Bool {
        guard let odds else { return false }
        return odds >= oddsFloor
    }

    // MARK: - Team legs (mlb_team_trends splits + matchups via the Outliers bundle)

    public static func teamLegs(bundle: MLBTrendsSlateBundle) -> [ParlayLeg] {
        let teamByAbbr = Dictionary(uniqueKeysWithValues: bundle.teams.map { ($0.teamAbbr, $0) })
        var legs: [ParlayLeg] = []

        for game in bundle.games {
            let ctx = MLBTrendsEngine.gameContext(for: game)
            for (sideKey, abbr, oppAbbr, roleRaw) in [
                ("home", game.homeAb, game.awayAb, ctx.homeFavDog),
                ("away", game.awayAb, game.homeAb, ctx.awayFavDog),
            ] {
                guard let record = teamByAbbr[abbr] else { continue }

                // Dimension → category, only where today's game matches the context.
                var dims: [(dim: String, category: ParlayGodCategory, ctx: String)] = [
                    ("overall", .teamForm, "games"),
                    (sideKey, .homeAway, sideKey == "home" ? "at home" : "on the road"),
                    (ctx.dayNightScope, .dayNight, ctx.dayNightScope == "day" ? "day games" : "night games"),
                ]
                if let role = roleRaw {
                    dims.append((role, .favDog, role == "favorite" ? "as favorite" : "as underdog"))
                }

                for market in ["ml", "rl", "ou", "f5_ml", "f5_rl", "f5_ou"] {
                    guard let marketBlock = record.splits[market] else { continue }
                    for (dim, category, ctxText) in dims {
                        let isF5 = market.hasPrefix("f5_")
                        // F5 is its own category, anchored to overall form only.
                        if isF5 && dim != "overall" { continue }
                        let cat: ParlayGodCategory = isF5 ? .firstFive : category
                        guard let block = marketBlock[dim],
                              let (cell, hitSide) = bestPerfectCell(block) else { continue }
                        if let leg = makeTeamLeg(
                            game: game, sideKey: sideKey, abbr: abbr, oppAbbr: oppAbbr,
                            market: market, n: cell.n, hits: hitSide ? cell.h : cell.l,
                            hitSide: hitSide, contextText: ctxText, category: cat
                        ) {
                            legs.append(leg)
                        }
                    }
                }

                // H2H record vs today's opponent → Versus Opponent.
                if let h2h = matchupRecord(record.matchups, opponent: oppAbbr) {
                    for market in ["ml", "rl", "ou"] {
                        guard let cell = h2h.markets[market], cell.n >= minSample else { continue }
                        let pct = cell.pct ?? (cell.n > 0 ? Double(cell.h) / Double(cell.n) : 0)
                        let hitSide: Bool
                        if pct == 1.0 { hitSide = true } else if pct == 0.0 { hitSide = false } else { continue }
                        if let leg = makeTeamLeg(
                            game: game, sideKey: sideKey, abbr: abbr, oppAbbr: oppAbbr,
                            market: market, n: cell.n, hits: hitSide ? cell.h : cell.l,
                            hitSide: hitSide, contextText: "vs \(oppAbbr.uppercased())",
                            category: .versusOpponent
                        ) {
                            legs.append(leg)
                        }
                    }
                }
            }
        }
        return legs
    }

    /// Largest-sample window that went 100% one way (no pushes on the miss side).
    private static func bestPerfectCell(_ block: [String: NFLTrendSplitCell]) -> (NFLTrendSplitCell, Bool)? {
        var best: (NFLTrendSplitCell, Bool)?
        for cell in block.values {
            guard cell.n >= minSample else { continue }
            let side: Bool
            if cell.pct == 1.0 { side = true }
            else if cell.pct == 0.0 && (cell.p ?? 0) == 0 { side = false }
            else { continue }
            if best == nil || cell.n > best!.0.n { best = (cell, side) }
        }
        return best
    }

    private static func matchupRecord(
        _ matchups: [String: NFLTrendMatchupRecord],
        opponent: String
    ) -> NFLTrendMatchupRecord? {
        let keys = [opponent.uppercased(), MLBTrendsEngine.trendsAbbr(for: opponent)]
        for key in keys {
            if let record = matchups[key] { return record }
        }
        return nil
    }

    private static func makeTeamLeg(
        game: OutliersTrendsGame,
        sideKey: String,
        abbr: String,
        oppAbbr: String,
        market: String,
        n: Int,
        hits: Int,
        hitSide: Bool,
        contextText: String,
        category: ParlayGodCategory
    ) -> ParlayLeg? {
        guard let ctx = game.mlbContext else { return nil }
        let isHome = sideKey == "home"
        let isF5 = market.hasPrefix("f5_")
        let base = isF5 ? String(market.dropFirst(3)) : market
        let pfx = isF5 ? "F5 " : ""
        let teamNick = MLBTeams.nickname(for: isHome ? game.homeTeam : game.awayTeam)
        let oppNick = MLBTeams.nickname(for: isHome ? game.awayTeam : game.homeTeam)

        func build(subject: String, subjectAbbr: String, bet: String, odds: Double?,
                   evidence: String, backed: String?, totalsFam: String? = nil, totalsSide: String? = nil) -> ParlayLeg? {
            guard let odds, oddsOk(Int(odds.rounded())) else { return nil }
            return ParlayLeg(
                kind: .team, category: category, gameKey: game.id, matchupLabel: game.label,
                gameTimeEt: game.kickoff, subject: subject, teamAbbr: subjectAbbr, playerId: nil,
                betText: bet, odds: Int(odds.rounded()), evidence: evidence, streakN: n,
                marketKey: market, backedTeamAbbr: backed, totalsFamily: totalsFam, totalsSide: totalsSide
            )
        }

        switch base {
        case "ml":
            let teamOdds = isF5 ? (isHome ? ctx.f5HomeMl : ctx.f5AwayMl) : (isHome ? ctx.homeMl : ctx.awayMl)
            let oppOdds = isF5 ? (isHome ? ctx.f5AwayMl : ctx.f5HomeMl) : (isHome ? ctx.awayMl : ctx.homeMl)
            if hitSide {
                return build(subject: teamNick, subjectAbbr: abbr, bet: "\(pfx)\(abbr) ML", odds: teamOdds,
                             evidence: "Won \(hits) straight \(contextText)", backed: abbr)
            }
            // Perfect losing streak → back the opponent.
            return build(subject: oppNick, subjectAbbr: oppAbbr, bet: "\(pfx)\(oppAbbr) ML", odds: oppOdds,
                         evidence: "\(abbr) lost \(hits) straight \(contextText)", backed: oppAbbr)
        case "rl":
            if hitSide {
                let spread = isF5 ? (isHome ? ctx.f5HomeSpread : ctx.f5AwaySpread) : (isHome ? ctx.homeSpread : ctx.awaySpread)
                let juice = isF5 ? (isHome ? ctx.f5HomeSpreadOdds : ctx.f5AwaySpreadOdds) : (isHome ? ctx.homeSpreadOdds : ctx.awaySpreadOdds)
                guard let spread else { return nil }
                return build(subject: teamNick, subjectAbbr: abbr, bet: "\(pfx)\(abbr) \(spreadText(spread))", odds: juice,
                             evidence: "Covered \(hits) straight \(contextText)", backed: abbr)
            }
            let spread = isF5 ? (isHome ? ctx.f5AwaySpread : ctx.f5HomeSpread) : (isHome ? ctx.awaySpread : ctx.homeSpread)
            let juice = isF5 ? (isHome ? ctx.f5AwaySpreadOdds : ctx.f5HomeSpreadOdds) : (isHome ? ctx.awaySpreadOdds : ctx.homeSpreadOdds)
            guard let spread else { return nil }
            return build(subject: oppNick, subjectAbbr: oppAbbr, bet: "\(pfx)\(oppAbbr) \(spreadText(spread))", odds: juice,
                         evidence: "\(abbr) failed to cover \(hits) straight \(contextText)", backed: oppAbbr)
        case "ou":
            let total = isF5 ? ctx.f5TotalLine : ctx.totalLine
            guard let total else { return nil }
            let family = isF5 ? "f5_ou" : "ou"
            if hitSide {
                return build(subject: teamNick, subjectAbbr: abbr, bet: "\(pfx)Over \(lineText(total))",
                             odds: isF5 ? ctx.f5TotalOverOdds : ctx.totalOverOdds,
                             evidence: "Over hit \(hits) straight \(abbr) \(contextText)", backed: nil,
                             totalsFam: family, totalsSide: "over")
            }
            return build(subject: teamNick, subjectAbbr: abbr, bet: "\(pfx)Under \(lineText(total))",
                         odds: isF5 ? ctx.f5TotalUnderOdds : ctx.totalUnderOdds,
                         evidence: "Under hit \(hits) straight \(abbr) \(contextText)", backed: nil,
                         totalsFam: family, totalsSide: "under")
        default:
            return nil
        }
    }

    private static func spreadText(_ value: Double) -> String {
        let body = value == value.rounded() ? "\(Int(value))" : String(format: "%.1f", value)
        return value > 0 ? "+\(body)" : body
    }

    private static func lineText(_ value: Double) -> String {
        value == value.rounded() ? "\(Int(value))" : String(format: "%.1f", value)
    }

    // MARK: - NFL team legs (nfl_team_trends splits + matchups via the Outliers NFL bundle)

    /// FG spread/total juice isn't stored on `nfl_dryrun_games` — legs on those
    /// markets price at the book-standard -110. ML and all H1 markets use real closes.
    public static let nflDefaultJuice = -110.0

    /// Mirrors `teamLegs(bundle:)` for the NFL slate. Market keys differ from
    /// MLB's (moneyline/spread/total vs ml/rl/ou) and H1 replaces F5 as the
    /// partial-game category (anchored to overall form, like F5).
    public static func nflTeamLegs(bundle: NFLTrendsSlateBundle) -> [ParlayLeg] {
        let teamByAbbr = Dictionary(uniqueKeysWithValues: bundle.teams.map { ($0.teamAbbr.uppercased(), $0) })
        var legs: [ParlayLeg] = []

        for game in bundle.games {
            guard game.nflContext != nil else { continue }
            let homeRole = nflHomeRole(game)

            for (sideKey, abbr, oppAbbr) in [
                ("home", game.homeAb, game.awayAb),
                ("away", game.awayAb, game.homeAb),
            ] {
                guard let record = teamByAbbr[abbr.uppercased()] else { continue }
                let role = homeRole.map { home in
                    sideKey == "home" ? home : (home == "favorite" ? "underdog" : "favorite")
                }

                var dims: [(dim: String, category: ParlayGodCategory, ctx: String)] = [
                    ("overall", .teamForm, "games"),
                    (sideKey, .homeAway, sideKey == "home" ? "at home" : "on the road"),
                ]
                if let role {
                    dims.append((role, .favDog, role == "favorite" ? "as favorite" : "as underdog"))
                }

                for market in ["moneyline", "spread", "total", "h1_spread", "h1_total"] {
                    guard let marketBlock = record.splits[market] else { continue }
                    for (dim, category, ctxText) in dims {
                        let isH1 = market.hasPrefix("h1_")
                        // H1 is its own category, anchored to overall form only.
                        if isH1 && dim != "overall" { continue }
                        let cat: ParlayGodCategory = isH1 ? .firstHalf : category
                        guard let block = marketBlock[dim],
                              let (cell, hitSide) = bestPerfectCell(block) else { continue }
                        if let leg = makeNFLTeamLeg(
                            game: game, sideKey: sideKey, abbr: abbr, oppAbbr: oppAbbr,
                            market: market, n: cell.n, hits: hitSide ? cell.h : cell.l,
                            hitSide: hitSide, contextText: ctxText, category: cat
                        ) {
                            legs.append(leg)
                        }
                    }
                }

                // H2H record vs today's opponent → Versus Opponent.
                if let h2h = record.matchups[oppAbbr.uppercased()] {
                    for market in ["moneyline", "spread", "total"] {
                        guard let cell = h2h.markets[market], cell.n >= minSample else { continue }
                        let pct = cell.pct ?? (cell.n > 0 ? Double(cell.h) / Double(cell.n) : 0)
                        let hitSide: Bool
                        if pct == 1.0 { hitSide = true } else if pct == 0.0 { hitSide = false } else { continue }
                        if let leg = makeNFLTeamLeg(
                            game: game, sideKey: sideKey, abbr: abbr, oppAbbr: oppAbbr,
                            market: market, n: cell.n, hits: hitSide ? cell.h : cell.l,
                            hitSide: hitSide, contextText: "vs \(oppAbbr.uppercased())",
                            category: .versusOpponent
                        ) {
                            legs.append(leg)
                        }
                    }
                }
            }
        }
        return legs
    }

    /// Favorite/underdog from ML closes, falling back to the spread sign
    /// (fg_spread_close is home-relative: negative = home favored).
    private static func nflHomeRole(_ game: OutliersTrendsGame) -> String? {
        if let home = game.nflContext?.homeMl, let away = game.nflContext?.awayMl, home != away {
            return home < away ? "favorite" : "underdog"
        }
        if let spread = game.fgSpreadClose, spread != 0 {
            return spread < 0 ? "favorite" : "underdog"
        }
        return nil
    }

    private static func makeNFLTeamLeg(
        game: OutliersTrendsGame,
        sideKey: String,
        abbr: String,
        oppAbbr: String,
        market: String,
        n: Int,
        hits: Int,
        hitSide: Bool,
        contextText: String,
        category: ParlayGodCategory
    ) -> ParlayLeg? {
        guard let ctx = game.nflContext else { return nil }
        let isHome = sideKey == "home"
        let isH1 = market.hasPrefix("h1_")
        let pfx = isH1 ? "1H " : ""
        // NFLTeams (not NFLTeamAssets) — the engine runs off-main in a detached
        // task and NFLTeamAssets is @MainActor.
        let teamNick = NFLTeams.nickname(for: isHome ? game.homeTeam : game.awayTeam)
        let oppNick = NFLTeams.nickname(for: isHome ? game.awayTeam : game.homeTeam)

        func build(subject: String, subjectAbbr: String, bet: String, odds: Double?,
                   evidence: String, backed: String?, totalsFam: String? = nil, totalsSide: String? = nil) -> ParlayLeg? {
            guard let odds, oddsOk(Int(odds.rounded())) else { return nil }
            return ParlayLeg(
                kind: .team, sport: .nfl, category: category, gameKey: game.id, matchupLabel: game.label,
                gameTimeEt: game.kickoff, subject: subject, teamAbbr: subjectAbbr, playerId: nil,
                betText: bet, odds: Int(odds.rounded()), evidence: evidence, streakN: n,
                marketKey: market, backedTeamAbbr: backed, totalsFamily: totalsFam, totalsSide: totalsSide
            )
        }

        switch market {
        case "moneyline":
            let teamOdds = isHome ? ctx.homeMl : ctx.awayMl
            let oppOdds = isHome ? ctx.awayMl : ctx.homeMl
            if hitSide {
                return build(subject: teamNick, subjectAbbr: abbr, bet: "\(abbr) ML", odds: teamOdds,
                             evidence: "Won \(hits) straight \(contextText)", backed: abbr)
            }
            // Perfect losing streak → back the opponent.
            return build(subject: oppNick, subjectAbbr: oppAbbr, bet: "\(oppAbbr) ML", odds: oppOdds,
                         evidence: "\(abbr) lost \(hits) straight \(contextText)", backed: oppAbbr)
        case "spread", "h1_spread":
            // Close is home-relative; flip for the away side.
            guard let close = isH1 ? ctx.h1SpreadClose : game.fgSpreadClose else { return nil }
            if hitSide {
                let spread = isHome ? close : -close
                let juice = isH1 ? (isHome ? ctx.h1SpreadHomePrice : ctx.h1SpreadAwayPrice) : nflDefaultJuice
                return build(subject: teamNick, subjectAbbr: abbr, bet: "\(pfx)\(abbr) \(spreadText(spread))", odds: juice,
                             evidence: "Covered \(hits) straight \(contextText)", backed: abbr)
            }
            let spread = isHome ? -close : close
            let juice = isH1 ? (isHome ? ctx.h1SpreadAwayPrice : ctx.h1SpreadHomePrice) : nflDefaultJuice
            return build(subject: oppNick, subjectAbbr: oppAbbr, bet: "\(pfx)\(oppAbbr) \(spreadText(spread))", odds: juice,
                         evidence: "\(abbr) failed to cover \(hits) straight \(contextText)", backed: oppAbbr)
        case "total", "h1_total":
            guard let total = isH1 ? ctx.h1TotalClose : game.fgTotalClose else { return nil }
            let family = isH1 ? "h1_total" : "total"
            if hitSide {
                return build(subject: teamNick, subjectAbbr: abbr, bet: "\(pfx)Over \(lineText(total))",
                             odds: isH1 ? ctx.h1TotalOverPrice : nflDefaultJuice,
                             evidence: "Over hit \(hits) straight \(abbr) \(contextText)", backed: nil,
                             totalsFam: family, totalsSide: "over")
            }
            return build(subject: teamNick, subjectAbbr: abbr, bet: "\(pfx)Under \(lineText(total))",
                         odds: isH1 ? ctx.h1TotalUnderPrice : nflDefaultJuice,
                         evidence: "Under hit \(hits) straight \(abbr) \(contextText)", backed: nil,
                         totalsFam: family, totalsSide: "under")
        default:
            return nil
        }
    }

    // MARK: - Prop legs (props slate via get_mlb_player_props_l10)

    public static func propLegs(matchups: [MLBPropMatchup]) -> [ParlayLeg] {
        var legs: [ParlayLeg] = []
        for matchup in matchups {
            let gameKey = String(matchup.gamePk)
            let label = "\(matchup.awayAbbr) @ \(matchup.homeAbbr)"
            var teamByPlayer: [Int: String] = [:]
            for row in matchup.homeLineup { teamByPlayer[row.playerId] = matchup.homeAbbr }
            for row in matchup.awayLineup { teamByPlayer[row.playerId] = matchup.awayAbbr }
            teamByPlayer[matchup.homeStarter.pitcherId] = matchup.homeAbbr
            teamByPlayer[matchup.awayStarter.pitcherId] = matchup.awayAbbr

            for row in matchup.props {
                let name = shortName(row.playerName)
                let teamAbbr = teamByPlayer[row.playerId]

                func propLeg(category: ParlayGodCategory, line: Double, over: Bool,
                             odds: Int?, evidence: String, n: Int) -> ParlayLeg? {
                    guard let odds, oddsOk(odds) else { return nil }
                    return ParlayLeg(
                        kind: .prop, category: category, gameKey: gameKey, matchupLabel: label,
                        gameTimeEt: matchup.gameTimeEt, subject: name, teamAbbr: teamAbbr,
                        playerId: row.playerId, betText: propBetText(market: row.market, line: line, over: over),
                        odds: odds, evidence: evidence, streakN: n, marketKey: row.market
                    )
                }

                guard let defaultLine = MLBPlayerProps.defaultLine(row.lines),
                      let entry = row.lines.first(where: { $0.line == defaultLine }) else { continue }

                // Recent Form — every one of the last (up to) 10 on one side of the line.
                let recent = Array(row.games.prefix(10))
                if recent.count >= minSample {
                    if recent.allSatisfy({ $0.v > defaultLine }) {
                        if let leg = propLeg(category: .recentForm, line: defaultLine, over: true, odds: entry.over,
                                             evidence: "Hit in \(recent.count) straight games", n: recent.count) {
                            legs.append(leg)
                        }
                    } else if recent.allSatisfy({ $0.v < defaultLine }) {
                        if let leg = propLeg(category: .recentForm, line: defaultLine, over: false, odds: entry.under,
                                             evidence: "Stayed under in \(recent.count) straight", n: recent.count) {
                            legs.append(leg)
                        }
                    }
                }

                // Day/Night — perfect in today's slot.
                let dayFlag = row.gameIsDay ? 1 : 0
                let slotGames = Array(row.games.filter { $0.d == dayFlag }.prefix(10))
                if slotGames.count >= minSample, slotGames.allSatisfy({ $0.v > defaultLine }) {
                    let slot = row.gameIsDay ? "day" : "night"
                    if let leg = propLeg(category: .dayNight, line: defaultLine, over: true, odds: entry.over,
                                         evidence: "Hit in all \(slotGames.count) \(slot) games", n: slotGames.count) {
                        legs.append(leg)
                    }
                }

                // vs Arm Type — perfect against today's opposing-starter archetype.
                if !row.isPitcher, let arch = row.oppArchetypeToday {
                    let archGames = Array(row.games.filter { $0.a == arch }.prefix(10))
                    if archGames.count >= minSample, archGames.allSatisfy({ $0.v > defaultLine }) {
                        if let leg = propLeg(category: .armType, line: defaultLine, over: true, odds: entry.over,
                                             evidence: "Hit in all \(archGames.count) vs \(arch.lowercased()) arms",
                                             n: archGames.count) {
                            legs.append(leg)
                        }
                    }
                }

                // Alternate Lines — a non-default ladder line riding a deep live streak.
                for alt in row.lines where alt.line != defaultLine {
                    guard oddsOk(alt.over) else { continue }
                    var streak = 0
                    for g in row.games {
                        if g.v > alt.line { streak += 1 } else { break }
                    }
                    if streak >= altLineMinStreak {
                        if let leg = propLeg(category: .alternateLines, line: alt.line, over: true, odds: alt.over,
                                             evidence: "Hit in \(streak) straight games", n: streak) {
                            legs.append(leg)
                        }
                    }
                }
            }
        }
        return legs
    }

    // MARK: - NFL prop legs (nfl_dryrun_props via PropsStore)

    /// Legs for one NFL matchup's props. NFL legs are built per-game for the
    /// matchup widget only — the dry-run slate's dates would pollute the
    /// live cross-game rails until the in-season cutover.
    public static func nflPropLegs(players: [NFLPropPlayer]) -> [ParlayLeg] {
        var legs: [ParlayLeg] = []
        for player in players {
            guard let team = player.team, let opponent = player.opponent else { continue }
            let label = (player.isHome ?? false) ? "\(opponent) @ \(team)" : "\(team) @ \(opponent)"
            let name = shortName(player.playerName)

            for market in player.markets {
                guard let line = market.closeLine else { continue }   // ATD yes-markets have no line
                let games = market.recentGames.compactMap(\.actual)   // oldest → newest
                let recent = Array(games.suffix(10))
                let marketLabel = NFLPlayerProps.marketLabel(market.market)

                func nflLeg(category: ParlayGodCategory, over: Bool, odds: Int?, evidence: String, n: Int) -> ParlayLeg? {
                    guard let odds, oddsOk(odds) else { return nil }
                    return ParlayLeg(
                        kind: .prop, sport: .nfl, category: category, gameKey: player.gameId, matchupLabel: label,
                        gameTimeEt: player.gameDate.isEmpty ? nil : player.gameDate,
                        subject: name, teamAbbr: team, playerId: nil, headshotUrl: player.headshotUrl,
                        betText: "\(over ? "Over" : "Under") \(lineText(line)) \(marketLabel)",
                        odds: odds, evidence: evidence, streakN: n, marketKey: market.market
                    )
                }

                if recent.count >= minSample {
                    if recent.allSatisfy({ $0 > line }) {
                        if let leg = nflLeg(category: .recentForm, over: true, odds: market.overPrice,
                                            evidence: "Hit in \(recent.count) straight games", n: recent.count) {
                            legs.append(leg)
                        }
                    } else if recent.allSatisfy({ $0 < line }) {
                        if let leg = nflLeg(category: .recentForm, over: false, odds: market.underPrice,
                                            evidence: "Stayed under in \(recent.count) straight", n: recent.count) {
                            legs.append(leg)
                        }
                    }
                }

                let vsOpp = market.recentGames
                    .filter { $0.opp?.uppercased() == opponent.uppercased() }
                    .compactMap(\.actual)
                if vsOpp.count >= minSample, vsOpp.allSatisfy({ $0 > line }) {
                    if let leg = nflLeg(category: .versusOpponent, over: true, odds: market.overPrice,
                                        evidence: "Hit in all \(vsOpp.count) vs \(opponent.uppercased())", n: vsOpp.count) {
                        legs.append(leg)
                    }
                }
            }
        }
        return legs
    }

    static func shortName(_ full: String) -> String {
        let parts = full.split(separator: " ")
        guard parts.count > 1, let first = parts.first?.first else { return full }
        return "\(first). \(parts.dropFirst().joined(separator: " "))"
    }

    static func propBetText(market: String, line: Double, over: Bool) -> String {
        let label = MLBPlayerProps.marketLabel(market)
        if over {
            // ".5" lines read as thresholds: Over 0.5 Hits → "1+ Hits".
            if line != line.rounded() {
                return "\(Int(line) + 1)+ \(label)"
            }
            return "Over \(lineText(line)) \(label)"
        }
        return "Under \(lineText(line)) \(label)"
    }

    // MARK: - Assembly

    /// Greedy best-first fill honoring: unique subject, unique (game, subject, bet),
    /// optional one-leg-per-game, market diversity cap, and conflict rules
    /// (opposite totals sides, same-game legs backing different teams).
    /// `uniqueSubjects: false` for same-game tickets — a game only has two team
    /// subjects, and "NYY ML + F5 NYY ML + Over 8.5" is a legitimate SGP.
    public static func assemble(
        _ pool: [ParlayLeg],
        maxLegs: Int = maxLegs,
        onePerGame: Bool,
        uniqueSubjects: Bool = true,
        excluding: Set<String> = []
    ) -> [ParlayLeg] {
        let sorted = pool.sorted { lhs, rhs in
            if lhs.streakN != rhs.streakN { return lhs.streakN > rhs.streakN }
            if lhs.odds != rhs.odds { return lhs.odds > rhs.odds }
            return lhs.id < rhs.id
        }
        var chosen: [ParlayLeg] = []
        var subjects: Set<String> = []
        var gamesUsed: Set<String> = []
        var betsSeen: Set<String> = []
        var marketCounts: [String: Int] = [:]

        for leg in sorted {
            let betKey = "\(leg.gameKey)|\(leg.subject)|\(leg.betText)"
            if excluding.contains(betKey) { continue }
            if betsSeen.contains(betKey) { continue }
            if uniqueSubjects && subjects.contains(leg.subject) { continue }
            if onePerGame && gamesUsed.contains(leg.gameKey) { continue }
            if marketCounts[leg.marketKey, default: 0] >= marketCap { continue }
            if chosen.contains(where: { conflicts($0, leg) }) { continue }
            chosen.append(leg)
            subjects.insert(leg.subject)
            gamesUsed.insert(leg.gameKey)
            betsSeen.insert(betKey)
            marketCounts[leg.marketKey, default: 0] += 1
            if chosen.count == maxLegs { break }
        }
        return chosen
    }

    static func conflicts(_ a: ParlayLeg, _ b: ParlayLeg) -> Bool {
        guard a.gameKey == b.gameKey else { return false }
        if let fa = a.totalsFamily, fa == b.totalsFamily, a.totalsSide != b.totalsSide {
            return true
        }
        if let ta = a.backedTeamAbbr, let tb = b.backedTeamAbbr, ta != tb {
            return true
        }
        return false
    }

    static func exclusionKey(_ leg: ParlayLeg) -> String {
        "\(leg.gameKey)|\(leg.subject)|\(leg.betText)"
    }

    // MARK: - Ticket building

    /// One themed 5-leg ticket per category — cross-game, game markets ONLY:
    /// Parlay God mirrors the Outliers page's markets (MLB ML/RL/totals/F5,
    /// NFL ML/spread/totals/H1); player props are Props Cheats territory on
    /// the Props tab. Sports whose slates are concurrently LIVE merge into one
    /// cross-sport card per category (cross-sport parlays are placeable);
    /// stale slates — e.g. the NFL dry-run's past dates — keep their own
    /// per-sport card so a merged ticket is never a fictional bet. Categories
    /// that can't field `minLegs` today are dropped — thin days shrink the rail.
    public static func slateTickets(from pool: [ParlayLeg], now: Date = Date()) -> [ParlayTicket] {
        buildCategoryTickets(from: pool.filter { $0.kind == .team }, idPrefix: "slate", onePerGame: true, now: now)
    }

    /// Player-prop legs only — the "Props Cheats" rail.
    public static func propsTickets(from pool: [ParlayLeg], now: Date = Date()) -> [ParlayTicket] {
        buildCategoryTickets(from: pool.filter { $0.kind == .prop }, idPrefix: "props", onePerGame: false, now: now)
    }

    /// Sports that currently field at least one ticket — drives the rail
    /// header's "Supports" icon cluster.
    public static func sports(in tickets: [ParlayTicket]) -> [ParlaySport] {
        let present = Set(tickets.flatMap(\.sports))
        return ParlaySport.displayOrder.filter { present.contains($0) }
    }

    // MARK: - Slate liveness

    /// A sport's slate is live when any of its legs' games hasn't long started
    /// (6h grace keeps the day's slate merged through the last first pitch).
    /// Dry-run slates — entirely past dates — fail, as do legs with no
    /// parseable kickoff.
    static func liveSports(in pool: [ParlayLeg], now: Date) -> Set<ParlaySport> {
        let cutoff = now.addingTimeInterval(-6 * 3600)
        var live: Set<ParlaySport> = []
        for leg in pool where !live.contains(leg.sport) {
            if let start = kickoffDate(leg.gameTimeEt), start >= cutoff {
                live.insert(leg.sport)
            }
        }
        return live
    }

    static func kickoffDate(_ raw: String?) -> Date? {
        guard let raw, !raw.isEmpty else { return nil }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = iso.date(from: raw) { return date }
        iso.formatOptions = [.withInternetDateTime]
        if let date = iso.date(from: raw) { return date }
        // Date-only fallback ("2026-07-20") → noon ET that day.
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.timeZone = TimeZone(identifier: "America/New_York")
        fmt.dateFormat = "yyyy-MM-dd"
        return fmt.date(from: raw)?.addingTimeInterval(12 * 3600)
    }

    private static func buildCategoryTickets(
        from pool: [ParlayLeg],
        idPrefix: String,
        onePerGame: Bool,
        now: Date = Date()
    ) -> [ParlayTicket] {
        // Liveness is per sport over the WHOLE pool (not per category) so a
        // sport can't be merged in one card and separate in the next.
        let live = liveSports(in: pool, now: now)
        let byCategory = Dictionary(grouping: pool, by: \.category)
        var tickets: [ParlayTicket] = []
        for category in ParlayGodCategory.displayOrder {
            guard let categoryLegs = byCategory[category] else { continue }
            // Merged live pool first, then one pool per stale sport.
            var pools: [[ParlayLeg]] = []
            let liveLegs = categoryLegs.filter { live.contains($0.sport) }
            if !liveLegs.isEmpty { pools.append(liveLegs) }
            for sport in ParlaySport.displayOrder where !live.contains(sport) {
                let sportLegs = categoryLegs.filter { $0.sport == sport }
                if !sportLegs.isEmpty { pools.append(sportLegs) }
            }
            for legPool in pools {
                let chosen = assemble(legPool, maxLegs: maxLegs, onePerGame: onePerGame)
                guard chosen.count >= minLegs else { continue }
                let sports = ParlaySport.displayOrder.filter { sport in
                    chosen.contains { $0.sport == sport }
                }
                tickets.append(ParlayTicket(
                    id: "\(idPrefix)-\(sports.map(\.rawValue).joined(separator: "+"))-\(category.rawValue)",
                    sports: sports,
                    category: category,
                    legs: chosen,
                    combinedOddsText: combinedOddsText(chosen)
                ))
            }
        }
        return tickets
    }

    /// Up to `maxCards` same-game tickets for one matchup, mixing team +
    /// prop legs across categories. Later cards exclude earlier cards' bets.
    public static func gameTickets(
        from pool: [ParlayLeg],
        gameKey: String,
        maxCards: Int = 3
    ) -> [ParlayTicket] {
        let gamePool = pool.filter { $0.gameKey == gameKey }
        var used: Set<String> = []
        var tickets: [ParlayTicket] = []
        for index in 0..<maxCards {
            let chosen = assemble(gamePool, maxLegs: sameGameMaxLegs, onePerGame: false, uniqueSubjects: false, excluding: used)
            guard chosen.count >= minLegs else { break }
            tickets.append(ParlayTicket(
                id: "game-\(gameKey)-\(index)",
                sports: [chosen[0].sport],
                category: chosen[0].category,
                legs: chosen,
                combinedOddsText: combinedOddsText(chosen)
            ))
            used.formUnion(chosen.map(exclusionKey))
        }
        return tickets
    }
}

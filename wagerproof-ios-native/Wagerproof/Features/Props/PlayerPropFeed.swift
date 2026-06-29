import Foundation
import WagerproofModels

// MARK: - MLB feed filters (Props tab only)

/// MLB-only Props tab narrowing — game matchup and/or prop market.
struct MLBPropFeedFilters: Equatable {
    var gamePk: Int?
    var market: String?

    var isDefault: Bool { gamePk == nil && market == nil }

    /// Markets offered in the picker sheet (home runs excluded — not posted).
    private static let excludedSheetMarkets: Set<String> = ["batter_home_runs"]

    static var sheetPitcherMarkets: [String] {
        MLBPlayerPropMarket.allCases
            .map(\.rawValue)
            .filter { $0.hasPrefix("pitcher_") && !excludedSheetMarkets.contains($0) }
    }

    static var sheetBatterMarkets: [String] {
        MLBPlayerPropMarket.allCases
            .map(\.rawValue)
            .filter { $0.hasPrefix("batter_") && !excludedSheetMarkets.contains($0) }
    }

    static func marketLabel(_ market: String?) -> String {
        guard let market else { return "All Markets" }
        return MLBPlayerProps.marketLabel(market)
    }
}

/// One game tile in the horizontal matchup filter row.
struct MLBPropGameFilterOption: Identifiable, Hashable {
    let gamePk: Int?
    let awayAbbr: String
    let homeAbbr: String
    let awayName: String
    let homeName: String
    let awayLogoUrl: String?
    let homeLogoUrl: String?

    var id: String { gamePk.map(String.init) ?? "all" }

    var isAllGames: Bool { gamePk == nil }

    var accessibilityLabel: String {
        guard let _ = gamePk else { return "All games" }
        return "\(awayAbbr) at \(homeAbbr)"
    }
}

enum MLBPropGameFilterOptions {
    static func build(matchups: [MLBPropMatchup]) -> [MLBPropGameFilterOption] {
        let sorted = matchups.sorted { a, b in
            if a.officialDate != b.officialDate { return a.officialDate < b.officialDate }
            return (a.gameTimeEt ?? "") < (b.gameTimeEt ?? "")
        }
        var options: [MLBPropGameFilterOption] = [
            MLBPropGameFilterOption(
                gamePk: nil,
                awayAbbr: "", homeAbbr: "",
                awayName: "", homeName: "",
                awayLogoUrl: nil, homeLogoUrl: nil
            ),
        ]
        for m in sorted {
            options.append(MLBPropGameFilterOption(
                gamePk: m.gamePk,
                awayAbbr: m.awayAbbr,
                homeAbbr: m.homeAbbr,
                awayName: m.awayTeamName,
                homeName: m.homeTeamName,
                awayLogoUrl: m.awayLogoUrl,
                homeLogoUrl: m.homeLogoUrl
            ))
        }
        return options
    }
}

// MARK: - Feed items

/// One player-specific item in the Props feed. Carries the headline prop for
/// the card plus the full `PlayerPropSelection` for the detail push. The feed
/// is flat (one card per player), so the matchup's starters + lineups are
/// flattened into these items with each player's team/opponent resolved.
struct PlayerPropFeedItem: Identifiable {
    let selection: PlayerPropSelection
    let headline: MLBHeadlineProp
    /// Team palette for the headshot glow + hero aura.
    let teamPrimaryHex: UInt32
    let teamSecondaryHex: UInt32
    /// Batting order (nil for pitchers / unlisted batters) — shown as "1. Name".
    let lineOrder: Int?
    /// Bottom-row metric label — "BEST" on the default feed, market name when filtered.
    let metricLabel: String

    var id: String { selection.transitionID }

    // Sort keys.
    var sortDate: String { selection.officialDate }
    var sortTime: String { selection.gameTimeEt ?? "" }
    var hitRate: Double {
        let l10 = headline.computed.l10
        return l10.games > 0 ? Double(l10.over) / Double(l10.games) : -1
    }
}

enum PlayerPropFeed {
    /// Flatten a slate of matchups into per-player feed items. Pitchers come
    /// first (K-anchored), then each lineup batter, then posted-but-unlisted
    /// batters. Players without a headline prop for the active filter are dropped.
    static func items(
        from matchups: [MLBPropMatchup],
        filters: MLBPropFeedFilters = MLBPropFeedFilters()
    ) -> [PlayerPropFeedItem] {
        let scoped = filters.gamePk.map { pk in matchups.filter { $0.gamePk == pk } } ?? matchups
        let metricLabel = filters.market == nil
            ? "BEST"
            : MLBPlayerProps.marketLabel(filters.market!).uppercased()

        var out: [PlayerPropFeedItem] = []
        for m in scoped {
            out.append(contentsOf: starterItem(m, starter: m.awayStarter, isAway: true, filters: filters, metricLabel: metricLabel))
            out.append(contentsOf: starterItem(m, starter: m.homeStarter, isAway: false, filters: filters, metricLabel: metricLabel))

            for row in m.awayLineup {
                out.append(contentsOf: batterItem(m, row: row, isAway: true, filters: filters, metricLabel: metricLabel))
            }
            for row in m.homeLineup {
                out.append(contentsOf: batterItem(m, row: row, isAway: false, filters: filters, metricLabel: metricLabel))
            }

            for group in m.extraBatterGroups {
                guard let headline = resolveHeadline(group.props, filters: filters) else { continue }
                let name = group.props.first?.playerName ?? "Player"
                let sel = PlayerPropSelection(
                    playerId: group.playerId,
                    playerName: name,
                    isPitcher: false,
                    position: nil,
                    batSide: nil,
                    teamName: "",
                    teamAbbr: "",
                    teamLogoUrl: nil,
                    opponentName: "",
                    opponentAbbr: "",
                    opposingStarterName: "opposing starter",
                    opposingStarterHand: "R",
                    opposingArchetypeName: nil,
                    gameTimeEt: m.gameTimeEt,
                    officialDate: m.officialDate,
                    gamePk: m.gamePk,
                    preferredMarket: filters.market,
                    props: group.props,
                    transitionID: "prop-\(m.gamePk)-\(group.playerId)-batter"
                )
                let colors = MLBTeams.colors(for: "")
                out.append(PlayerPropFeedItem(
                    selection: sel, headline: headline,
                    teamPrimaryHex: colors.primary, teamSecondaryHex: colors.secondary,
                    lineOrder: nil, metricLabel: metricLabel
                ))
            }
        }
        return out
    }

    // MARK: - Headline resolution

    private static func resolveHeadline(
        _ props: [MLBPlayerPropRow],
        filters: MLBPropFeedFilters
    ) -> MLBHeadlineProp? {
        if let market = filters.market {
            return MLBPlayerProps.pickHeadlineProp(props, market: market)
        }
        let kProps = props.filter { $0.market == "pitcher_strikeouts" }
        return MLBPlayerProps.pickHeadlineProp(kProps.isEmpty ? props : kProps)
    }

    // MARK: - Per-player builders

    private static func starterItem(
        _ m: MLBPropMatchup,
        starter: MLBPropStarter,
        isAway: Bool,
        filters: MLBPropFeedFilters,
        metricLabel: String
    ) -> [PlayerPropFeedItem] {
        let myProps = m.pitcherProps(for: starter.pitcherId)
        guard let headline = resolveHeadline(myProps, filters: filters) else { return [] }
        let opp = isAway ? m.homeStarter : m.awayStarter
        let sel = PlayerPropSelection(
            playerId: starter.pitcherId,
            playerName: starter.name,
            isPitcher: true,
            position: "\(starter.hand)HP",
            batSide: nil,
            teamName: isAway ? m.awayTeamName : m.homeTeamName,
            teamAbbr: isAway ? m.awayAbbr : m.homeAbbr,
            teamLogoUrl: isAway ? m.awayLogoUrl : m.homeLogoUrl,
            opponentName: isAway ? m.homeTeamName : m.awayTeamName,
            opponentAbbr: isAway ? m.homeAbbr : m.awayAbbr,
            opposingStarterName: opp.name,
            opposingStarterHand: opp.hand,
            opposingArchetypeName: nil,
            gameTimeEt: m.gameTimeEt,
            officialDate: m.officialDate,
            gamePk: m.gamePk,
            preferredMarket: filters.market,
            props: myProps,
            transitionID: "prop-\(m.gamePk)-\(starter.pitcherId)-pitcher"
        )
        let colors = MLBTeams.colors(for: isAway ? m.awayTeamName : m.homeTeamName)
        return [PlayerPropFeedItem(
            selection: sel, headline: headline,
            teamPrimaryHex: colors.primary, teamSecondaryHex: colors.secondary,
            lineOrder: nil, metricLabel: metricLabel
        )]
    }

    private static func batterItem(
        _ m: MLBPropMatchup,
        row: MLBLineupRow,
        isAway: Bool,
        filters: MLBPropFeedFilters,
        metricLabel: String
    ) -> [PlayerPropFeedItem] {
        let myProps = m.batterProps(for: row.playerId)
        guard let headline = resolveHeadline(myProps, filters: filters) else { return [] }
        let opp = isAway ? m.homeStarter : m.awayStarter
        let sel = PlayerPropSelection(
            playerId: row.playerId,
            playerName: row.playerName,
            isPitcher: false,
            position: row.position,
            batSide: row.batSide,
            teamName: isAway ? m.awayTeamName : m.homeTeamName,
            teamAbbr: isAway ? m.awayAbbr : m.homeAbbr,
            teamLogoUrl: isAway ? m.awayLogoUrl : m.homeLogoUrl,
            opponentName: isAway ? m.homeTeamName : m.awayTeamName,
            opponentAbbr: isAway ? m.homeAbbr : m.awayAbbr,
            opposingStarterName: opp.name,
            opposingStarterHand: opp.hand,
            opposingArchetypeName: opp.archetype?.archetype,
            gameTimeEt: m.gameTimeEt,
            officialDate: m.officialDate,
            gamePk: m.gamePk,
            preferredMarket: filters.market,
            props: myProps,
            transitionID: "prop-\(m.gamePk)-\(row.playerId)-batter"
        )
        let colors = MLBTeams.colors(for: isAway ? m.awayTeamName : m.homeTeamName)
        return [PlayerPropFeedItem(
            selection: sel, headline: headline,
            teamPrimaryHex: colors.primary, teamSecondaryHex: colors.secondary,
            lineOrder: row.battingOrder, metricLabel: metricLabel
        )]
    }

    // MARK: - Best Picks Report → detail

    /// Resolve a Best Picks row to the same detail payload the main Props
    /// feed uses, preferring the pick's market on open.
    static func selection(
        for pick: MLBPlayerPropBestPick,
        in matchups: [MLBPropMatchup]
    ) -> PlayerPropSelection? {
        guard let matchup = matchups.first(where: { $0.gamePk == pick.gamePk }) else { return nil }
        return selection(for: pick, matchup: matchup)
    }

    static func selection(
        for pick: MLBPlayerPropBestPick,
        matchup: MLBPropMatchup
    ) -> PlayerPropSelection? {
        let filters = MLBPropFeedFilters(gamePk: matchup.gamePk, market: pick.market)

        if pick.kind == .pitcher {
            if matchup.awayStarter.pitcherId == pick.playerId {
                return starterItem(matchup, starter: matchup.awayStarter, isAway: true, filters: filters, metricLabel: "BEST").first?.selection
            }
            if matchup.homeStarter.pitcherId == pick.playerId {
                return starterItem(matchup, starter: matchup.homeStarter, isAway: false, filters: filters, metricLabel: "BEST").first?.selection
            }
            let props = matchup.pitcherProps(for: pick.playerId)
            guard !props.isEmpty else { return nil }
            return pitcherSelection(for: pick, matchup: matchup, props: props)
        }

        if let row = matchup.awayLineup.first(where: { $0.playerId == pick.playerId }) {
            return batterItem(matchup, row: row, isAway: true, filters: filters, metricLabel: "BEST").first?.selection
        }
        if let row = matchup.homeLineup.first(where: { $0.playerId == pick.playerId }) {
            return batterItem(matchup, row: row, isAway: false, filters: filters, metricLabel: "BEST").first?.selection
        }
        let props = matchup.batterProps(for: pick.playerId)
        guard !props.isEmpty else { return nil }
        return batterSelection(for: pick, matchup: matchup, props: props)
    }

    /// Last-resort builder when the matchup card isn't in the Props cache —
    /// props rows still carry the charts/game log the detail page renders.
    static func selection(
        for pick: MLBPlayerPropBestPick,
        props: [MLBPlayerPropRow],
        officialDate: String,
        gameTimeEt: String?
    ) -> PlayerPropSelection? {
        let isPitcher = pick.kind == .pitcher
        let myProps = props.filter { row in
            row.playerId == pick.playerId && row.isPitcher == isPitcher
        }
        guard !myProps.isEmpty else { return nil }

        let sides = parseGameLabel(pick.gameLabel)
        let teamName = pick.teamName ?? sides?.away ?? ""
        let isAway = sides.map { MLBTeams.normalize(teamName) == MLBTeams.normalize($0.away) } ?? true
        let opponentName = isAway ? (sides?.home ?? "Opponent") : (sides?.away ?? "Opponent")
        let teamInfo = MLBTeams.info(for: teamName)
        let oppInfo = MLBTeams.info(for: opponentName)

        return PlayerPropSelection(
            playerId: pick.playerId,
            playerName: pick.playerName,
            isPitcher: isPitcher,
            position: isPitcher ? "SP" : nil,
            batSide: nil,
            teamName: teamName,
            teamAbbr: teamInfo?.team ?? String(teamName.prefix(3)).uppercased(),
            teamLogoUrl: teamInfo?.logoUrl,
            opponentName: opponentName,
            opponentAbbr: oppInfo?.team ?? String(opponentName.prefix(3)).uppercased(),
            opposingStarterName: "Opposing starter",
            opposingStarterHand: "R",
            opposingArchetypeName: myProps.first?.oppArchetypeToday,
            gameTimeEt: gameTimeEt,
            officialDate: officialDate,
            gamePk: pick.gamePk,
            preferredMarket: pick.market,
            props: myProps,
            transitionID: "best-pick-\(pick.id)"
        )
    }

    private static func pitcherSelection(
        for pick: MLBPlayerPropBestPick,
        matchup: MLBPropMatchup,
        props: [MLBPlayerPropRow]
    ) -> PlayerPropSelection? {
        let isAway = teamMatches(pick.teamName, matchup.awayTeamName)
        let starter = isAway ? matchup.awayStarter : matchup.homeStarter
        let opp = isAway ? matchup.homeStarter : matchup.awayStarter
        return PlayerPropSelection(
            playerId: pick.playerId,
            playerName: pick.playerName,
            isPitcher: true,
            position: "\(starter.hand)HP",
            batSide: nil,
            teamName: isAway ? matchup.awayTeamName : matchup.homeTeamName,
            teamAbbr: isAway ? matchup.awayAbbr : matchup.homeAbbr,
            teamLogoUrl: isAway ? matchup.awayLogoUrl : matchup.homeLogoUrl,
            opponentName: isAway ? matchup.homeTeamName : matchup.awayTeamName,
            opponentAbbr: isAway ? matchup.homeAbbr : matchup.awayAbbr,
            opposingStarterName: opp.name,
            opposingStarterHand: opp.hand,
            opposingArchetypeName: nil,
            gameTimeEt: matchup.gameTimeEt,
            officialDate: matchup.officialDate,
            gamePk: matchup.gamePk,
            preferredMarket: pick.market,
            props: props,
            transitionID: "best-pick-\(pick.id)"
        )
    }

    private static func batterSelection(
        for pick: MLBPlayerPropBestPick,
        matchup: MLBPropMatchup,
        props: [MLBPlayerPropRow]
    ) -> PlayerPropSelection? {
        let isAway = teamMatches(pick.teamName, matchup.awayTeamName)
        let opp = isAway ? matchup.homeStarter : matchup.awayStarter
        return PlayerPropSelection(
            playerId: pick.playerId,
            playerName: pick.playerName,
            isPitcher: false,
            position: nil,
            batSide: nil,
            teamName: isAway ? matchup.awayTeamName : matchup.homeTeamName,
            teamAbbr: isAway ? matchup.awayAbbr : matchup.homeAbbr,
            teamLogoUrl: isAway ? matchup.awayLogoUrl : matchup.homeLogoUrl,
            opponentName: isAway ? matchup.homeTeamName : matchup.awayTeamName,
            opponentAbbr: isAway ? matchup.homeAbbr : matchup.awayAbbr,
            opposingStarterName: opp.name,
            opposingStarterHand: opp.hand,
            opposingArchetypeName: opp.archetype?.archetype,
            gameTimeEt: matchup.gameTimeEt,
            officialDate: matchup.officialDate,
            gamePk: matchup.gamePk,
            preferredMarket: pick.market,
            props: props,
            transitionID: "best-pick-\(pick.id)"
        )
    }

    private static func teamMatches(_ pickTeam: String?, _ matchupTeam: String) -> Bool {
        guard let pickTeam, !pickTeam.isEmpty else { return false }
        return MLBTeams.normalize(pickTeam) == MLBTeams.normalize(matchupTeam)
    }

    private static func parseGameLabel(_ label: String) -> (away: String, home: String)? {
        let separators = [" @ ", " at ", " vs ", " vs. "]
        for sep in separators {
            let parts = label.components(separatedBy: sep)
            if parts.count == 2 {
                let away = parts[0].trimmingCharacters(in: .whitespacesAndNewlines)
                let home = parts[1].trimmingCharacters(in: .whitespacesAndNewlines)
                if !away.isEmpty, !home.isEmpty { return (away, home) }
            }
        }
        return nil
    }
}

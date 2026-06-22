import Foundation
import WagerproofModels

// MARK: - NFL feed filters (Props tab only)

/// NFL-only Props tab narrowing — game matchup, prop market, and/or
/// signal-only feed.
struct NFLPropFeedFilters: Equatable {
    var gameId: String?
    var market: String?
    /// When true, only players with a P-flag on the displayed market are shown.
    var signalsOnly: Bool = false

    var isDefault: Bool { gameId == nil && market == nil && !signalsOnly }

    static let sheetPassingMarkets: [String] = [
        "player_pass_yds", "player_pass_tds", "player_pass_attempts",
        "player_pass_completions", "player_pass_interceptions",
    ]
    static let sheetRushingMarkets: [String] = [
        "player_rush_yds", "player_rush_attempts", "player_rush_tds",
    ]
    static let sheetReceivingMarkets: [String] = [
        "player_reception_yds", "player_receptions", "player_reception_tds",
    ]
    static let sheetOtherMarkets: [String] = [
        "player_anytime_td", "player_kicking_points", "player_field_goals",
        "player_sacks", "player_tackles_assists",
    ]

    private static let sheetMarketOrder: [String] =
        sheetPassingMarkets + sheetRushingMarkets + sheetReceivingMarkets + sheetOtherMarkets

    /// Markets grouped for the picker sheet — only keys present in `players`.
    struct SheetMarkets: Equatable {
        var passing: [String]
        var rushing: [String]
        var receiving: [String]
        var other: [String]

        var isEmpty: Bool {
            passing.isEmpty && rushing.isEmpty && receiving.isEmpty && other.isEmpty
        }

        var allKeys: Set<String> {
            Set(passing + rushing + receiving + other)
        }
    }

    static func sheetMarkets(from players: [NFLPropPlayer]) -> SheetMarkets {
        let available = Set(players.flatMap { $0.markets.map(\.market) })
        func filter(_ keys: [String]) -> [String] {
            keys.filter { available.contains($0) }
                .sorted { NFLPlayerProps.marketSortIndex($0) < NFLPlayerProps.marketSortIndex($1) }
        }
        var other = filter(sheetOtherMarkets)
        let categorized = Set(sheetMarketOrder)
        let uncategorized = available.subtracting(categorized)
            .sorted { NFLPlayerProps.marketSortIndex($0) < NFLPlayerProps.marketSortIndex($1) }
        other.append(contentsOf: uncategorized)
        return SheetMarkets(
            passing: filter(sheetPassingMarkets),
            rushing: filter(sheetRushingMarkets),
            receiving: filter(sheetReceivingMarkets),
            other: other
        )
    }

    static func marketLabel(_ market: String?) -> String {
        guard let market else { return "All Markets" }
        return NFLPlayerProps.marketLabel(market)
    }

    static func filterLabel(_ filters: NFLPropFeedFilters) -> String {
        if filters.signalsOnly { return "Prop Signals" }
        return marketLabel(filters.market)
    }

    /// Players with at least one flagged market (optionally scoped to a game).
    static func flaggedPlayerCount(from players: [NFLPropPlayer], gameId: String? = nil) -> Int {
        let scoped = gameId.map { gid in players.filter { $0.gameId == gid } } ?? players
        return scoped.filter { player in
            player.markets.contains { !$0.flags.isEmpty }
        }.count
    }

    static func hasFlaggedPlayers(in players: [NFLPropPlayer], gameId: String) -> Bool {
        players.contains { player in
            player.gameId == gameId && player.markets.contains { !$0.flags.isEmpty }
        }
    }

    /// Player pool for the horizontal game picker — never scoped by the active
    /// game filter so the full slate stays visible while narrowing the feed.
    static func gameOptionPlayers(
        from players: [NFLPropPlayer],
        signalsOnly: Bool
    ) -> [NFLPropPlayer] {
        guard signalsOnly else { return players }
        return players.filter { player in
            player.markets.contains { !$0.flags.isEmpty }
        }
    }
}

/// One game tile in the horizontal matchup filter row.
struct NFLPropGameFilterOption: Identifiable, Hashable {
    let gameId: String?
    let awayTeam: String
    let homeTeam: String
    let awayAbbr: String
    let homeAbbr: String
    let gameDate: String
    let slot: String?

    var id: String { gameId ?? "all" }

    var isAllGames: Bool { gameId == nil }

    var accessibilityLabel: String {
        guard gameId != nil else { return "All games" }
        return "\(awayAbbr) at \(homeAbbr)"
    }
}

enum NFLPropGameFilterOptions {
    @MainActor
    static func build(
        players: [NFLPropPlayer],
        signalsOnly: Bool = false
    ) -> [NFLPropGameFilterOption] {
        let pool = NFLPropFeedFilters.gameOptionPlayers(
            from: players,
            signalsOnly: signalsOnly
        )
        var byGame: [String: NFLPropPlayer] = [:]
        for p in pool {
            if byGame[p.gameId] == nil { byGame[p.gameId] = p }
        }
        let sorted = byGame.values.sorted { a, b in
            if a.gameDate != b.gameDate { return a.gameDate < b.gameDate }
            return NFLPlayerProps.slotOrder(a.slot) < NFLPlayerProps.slotOrder(b.slot)
        }
        var options: [NFLPropGameFilterOption] = [
            NFLPropGameFilterOption(
                gameId: nil, awayTeam: "", homeTeam: "",
                awayAbbr: "", homeAbbr: "",
                gameDate: "", slot: nil
            ),
        ]
        for p in sorted {
            let sides = awayHomeTeams(for: p)
            let awayAbbr = NFLTeamAssets.abbr(for: sides.away)
            let homeAbbr = NFLTeamAssets.abbr(for: sides.home)
            options.append(NFLPropGameFilterOption(
                gameId: p.gameId,
                awayTeam: NFLTeams.fullName(for: sides.away) ?? sides.away,
                homeTeam: NFLTeams.fullName(for: sides.home) ?? sides.home,
                awayAbbr: awayAbbr,
                homeAbbr: homeAbbr,
                gameDate: p.gameDate,
                slot: p.slot
            ))
        }
        return options
    }

    private static func awayHomeTeams(for player: NFLPropPlayer) -> (away: String, home: String) {
        let team = player.team ?? ""
        let opp = player.opponent ?? ""
        if player.isHome == true { return (away: opp, home: team) }
        if player.isHome == false { return (away: team, home: opp) }
        // Fallback: parse `2025_12_AWAY_HOME` when home/away flag is missing.
        let parts = player.gameId.split(separator: "_")
        if parts.count >= 4 {
            return (away: String(parts[parts.count - 2]), home: String(parts[parts.count - 1]))
        }
        return (away: team, home: opp)
    }
}

/// Navigation payload pushed when an NFL prop card is tapped.
struct NFLPlayerPropSelection: Identifiable, Hashable {
    let player: NFLPropPlayer
    /// When set, the detail page opens on this market (feed market filter).
    let preferredMarket: String?
    let transitionID: String

    var id: String { transitionID }
}

/// One player card in the NFL props feed.
struct NFLPropFeedItem: Identifiable {
    let player: NFLPropPlayer
    let displayMarket: NFLPropMarket
    let metricLabel: String
    let selection: NFLPlayerPropSelection

    var id: String { selection.transitionID }

    var sortDate: String { player.gameDate }
    var sortTime: String { player.sortKey }
    var hitRate: Double { displayMarket.l10HitRate ?? -1 }
}

enum NFLPropFeed {
    /// One card per player. Players without a headline market for the active
    /// filter are dropped.
    static func items(
        from players: [NFLPropPlayer],
        filters: NFLPropFeedFilters = NFLPropFeedFilters()
    ) -> [NFLPropFeedItem] {
        let scoped = filters.gameId.map { gid in players.filter { $0.gameId == gid } } ?? players

        return scoped.compactMap { player in
            guard let market = player.headlineMarket(
                filter: filters.market,
                signalsOnly: filters.signalsOnly
            ) else { return nil }
            let metricLabel: String = {
                if filters.signalsOnly { return "SIGNAL" }
                if filters.market == nil { return "BEST" }
                return NFLPlayerProps.marketLabel(filters.market!).uppercased()
            }()
            let selection = NFLPlayerPropSelection(
                player: player,
                preferredMarket: market.market,
                transitionID: "nflprop-\(player.id)"
            )
            return NFLPropFeedItem(
                player: player,
                displayMarket: market,
                metricLabel: metricLabel,
                selection: selection
            )
        }
    }
}

private extension NFLPropPlayer {
    func headlineMarket(filter: String?, signalsOnly: Bool = false) -> NFLPropMarket? {
        if signalsOnly {
            if let filter {
                guard let market = markets.first(where: { $0.market == filter }),
                      !market.flags.isEmpty else { return nil }
                return market
            }
            return markets.first { !$0.flags.isEmpty }
        }
        if let filter {
            return markets.first { $0.market == filter }
        }
        return markets.first { !$0.flags.isEmpty } ?? markets.first
    }
}

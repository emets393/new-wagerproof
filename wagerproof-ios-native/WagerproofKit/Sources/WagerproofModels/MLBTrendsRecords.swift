import Foundation

public struct MLBTrendsSlateBundle: Sendable {
    public let games: [OutliersTrendsGame]
    public let season: Int
    public let throughDate: String?
    public let teams: [MLBTeamTrendRecord]

    public init(
        games: [OutliersTrendsGame],
        season: Int,
        throughDate: String?,
        teams: [MLBTeamTrendRecord]
    ) {
        self.games = games
        self.season = season
        self.throughDate = throughDate
        self.teams = teams
    }
}

public struct MLBTeamTrendRecord: Sendable, Identifiable {
    public var id: String { teamAbbr }
    public let teamAbbr: String
    public let teamName: String?
    public let season: Int
    public let throughDate: String?
    public let splits: NFLTrendSplits
    public let matchups: [String: NFLTrendMatchupRecord]

    public init(
        teamAbbr: String,
        teamName: String?,
        season: Int,
        throughDate: String?,
        splits: NFLTrendSplits,
        matchups: [String: NFLTrendMatchupRecord]
    ) {
        self.teamAbbr = teamAbbr
        self.teamName = teamName
        self.season = season
        self.throughDate = throughDate
        self.splits = splits
        self.matchups = matchups
    }
}

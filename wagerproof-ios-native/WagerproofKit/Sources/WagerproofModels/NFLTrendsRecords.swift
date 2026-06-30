import Foundation

public struct NFLTrendsSlateBundle: Sendable {
    public let games: [OutliersTrendsGame]
    public let season: Int
    public let throughWeek: Int
    public let teams: [NFLTeamTrendRecord]
    public let coaches: [NFLCoachTrendRecord]
    public let referees: [NFLRefereeTrendRecord]
    public let players: [NFLPlayerPropTrendRecord]

    public init(
        games: [OutliersTrendsGame],
        season: Int,
        throughWeek: Int,
        teams: [NFLTeamTrendRecord],
        coaches: [NFLCoachTrendRecord],
        referees: [NFLRefereeTrendRecord],
        players: [NFLPlayerPropTrendRecord]
    ) {
        self.games = games
        self.season = season
        self.throughWeek = throughWeek
        self.teams = teams
        self.coaches = coaches
        self.referees = referees
        self.players = players
    }
}

public struct NFLTeamTrendRecord: Sendable, Identifiable {
    public var id: String { teamAbbr }
    public let teamAbbr: String
    public let teamName: String?
    public let season: Int
    public let throughWeek: Int
    public let splits: NFLTrendSplits
    public let matchups: [String: NFLTrendMatchupRecord]

    public init(
        teamAbbr: String,
        teamName: String?,
        season: Int,
        throughWeek: Int,
        splits: NFLTrendSplits,
        matchups: [String: NFLTrendMatchupRecord]
    ) {
        self.teamAbbr = teamAbbr
        self.teamName = teamName
        self.season = season
        self.throughWeek = throughWeek
        self.splits = splits
        self.matchups = matchups
    }
}

public struct NFLCoachTrendRecord: Sendable, Identifiable {
    public var id: String { coach }
    public let coach: String
    public let currentTeam: String?
    public let careerGames: Int?
    public let lastSeason: Int?
    public let throughSeason: Int
    public let throughWeek: Int
    public let splits: NFLTrendSplits
    public let matchups: [String: NFLTrendMatchupRecord]
    public let marketCoverage: NFLTrendMarketCoverage?

    public init(
        coach: String,
        currentTeam: String?,
        careerGames: Int?,
        lastSeason: Int?,
        throughSeason: Int,
        throughWeek: Int,
        splits: NFLTrendSplits,
        matchups: [String: NFLTrendMatchupRecord],
        marketCoverage: NFLTrendMarketCoverage?
    ) {
        self.coach = coach
        self.currentTeam = currentTeam
        self.careerGames = careerGames
        self.lastSeason = lastSeason
        self.throughSeason = throughSeason
        self.throughWeek = throughWeek
        self.splits = splits
        self.matchups = matchups
        self.marketCoverage = marketCoverage
    }
}

public struct NFLRefereeTrendRecord: Sendable, Identifiable {
    public var id: String { referee }
    public let referee: String
    public let careerGames: Int?
    public let throughSeason: Int
    public let throughWeek: Int
    public let splits: NFLTrendSplits
    public let marketCoverage: NFLTrendMarketCoverage?

    public init(
        referee: String,
        careerGames: Int?,
        throughSeason: Int,
        throughWeek: Int,
        splits: NFLTrendSplits,
        marketCoverage: NFLTrendMarketCoverage?
    ) {
        self.referee = referee
        self.careerGames = careerGames
        self.throughSeason = throughSeason
        self.throughWeek = throughWeek
        self.splits = splits
        self.marketCoverage = marketCoverage
    }
}

public struct NFLPlayerPropTrendRecord: Sendable, Identifiable {
    public var id: String { "\(playerId)" }
    public let playerId: String
    public let playerName: String?
    public let position: String?
    public let currentTeam: String?
    public let markets: [String]
    public let coverage: String?
    public let throughSeason: Int
    public let throughWeek: Int
    public let splits: NFLTrendSplits
    public let matchups: [String: NFLTrendMatchupRecord]

    public init(
        playerId: String,
        playerName: String?,
        position: String?,
        currentTeam: String?,
        markets: [String],
        coverage: String?,
        throughSeason: Int,
        throughWeek: Int,
        splits: NFLTrendSplits,
        matchups: [String: NFLTrendMatchupRecord] = [:]
    ) {
        self.playerId = playerId
        self.playerName = playerName
        self.position = position
        self.currentTeam = currentTeam
        self.markets = markets
        self.coverage = coverage
        self.throughSeason = throughSeason
        self.throughWeek = throughWeek
        self.splits = splits
        self.matchups = matchups
    }
}

public struct NFLTrendMatchupRecord: Sendable, Hashable {
    public let meetings: Int?
    public let markets: [String: NFLTrendH2HCell]

    public init(meetings: Int?, markets: [String: NFLTrendH2HCell]) {
        self.meetings = meetings
        self.markets = markets
    }
}

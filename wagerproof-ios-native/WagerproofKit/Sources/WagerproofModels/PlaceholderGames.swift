import Foundation

/// Slim placeholder shapes for NBA / MLB games. B04 ported NFL + CFB cards
/// in full. B11 unwaivered NCAAB — replaced its summary with the full
/// `NCAABGame` model (see `NCAABGame.swift`). The remaining two ports
/// (B10 NBA / B12 MLB) replace these with full models that match the RN
/// types.
///
/// We carry enough fields here so the orchestrating `GamesStore` can fetch
/// rows from the CFB Supabase project and surface them as placeholder rows
/// in `GamesView`. Each per-sport batch must keep field names byte-identical
/// to its `wagerproof-mobile/types/<sport>.ts` counterpart when it lands.
public struct NBAGameSummary: Identifiable, Codable, Hashable, Sendable {
    public let id: String
    public let awayTeam: String
    public let homeTeam: String
    public let awayAbbr: String?
    public let homeAbbr: String?
    public let gameDate: String?
    public let gameTime: String?

    public init(
        id: String,
        awayTeam: String,
        homeTeam: String,
        awayAbbr: String? = nil,
        homeAbbr: String? = nil,
        gameDate: String? = nil,
        gameTime: String? = nil
    ) {
        self.id = id
        self.awayTeam = awayTeam
        self.homeTeam = homeTeam
        self.awayAbbr = awayAbbr
        self.homeAbbr = homeAbbr
        self.gameDate = gameDate
        self.gameTime = gameTime
    }
}

public struct MLBGameSummary: Identifiable, Codable, Hashable, Sendable {
    public let id: String
    public let awayTeamName: String?
    public let homeTeamName: String?
    public let awayAbbr: String?
    public let homeAbbr: String?
    public let officialDate: String?
    public let gameTimeEt: String?
    public let isPostponed: Bool?

    public init(
        id: String,
        awayTeamName: String? = nil,
        homeTeamName: String? = nil,
        awayAbbr: String? = nil,
        homeAbbr: String? = nil,
        officialDate: String? = nil,
        gameTimeEt: String? = nil,
        isPostponed: Bool? = nil
    ) {
        self.id = id
        self.awayTeamName = awayTeamName
        self.homeTeamName = homeTeamName
        self.awayAbbr = awayAbbr
        self.homeAbbr = homeAbbr
        self.officialDate = officialDate
        self.gameTimeEt = gameTimeEt
        self.isPostponed = isPostponed
    }
}

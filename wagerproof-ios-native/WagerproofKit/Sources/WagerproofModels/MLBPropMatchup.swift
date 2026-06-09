import Foundation

/// Per-game assembly for the player-props matchups feed. Mirrors the RN
/// `PitcherMatchupSummary` (trimmed to the fields the props surface renders):
/// game header + both batting orders + both starters' archetypes + the
/// posted prop ladder for everyone in the game.
///
/// Hydrated by `MLBPlayerPropsService.fetchMatchups()` from a 5-way fetch:
///   - `mlb_games_today`        schedule + starting pitchers
///   - `mlb_game_lineups`       confirmed/projected batting orders
///   - `v_mlb_pitcher_archetypes` season archetype per starter
///   - `mlb_team_mapping`       abbreviation + logo
///   - `get_mlb_player_props_l10(p_game_pk)` RPC  prop ladder + game log

/// One batting-order slot. Mirrors RN `LineupRow`.
public struct MLBLineupRow: Codable, Hashable, Sendable, Identifiable {
    public let gamePk: Int
    public let teamId: Int
    public let playerId: Int
    public let playerName: String
    public let battingOrder: Int?
    public let position: String?
    public let batSide: String?
    public let isConfirmed: Bool?

    public var id: Int { playerId }

    public init(
        gamePk: Int,
        teamId: Int,
        playerId: Int,
        playerName: String,
        battingOrder: Int?,
        position: String?,
        batSide: String?,
        isConfirmed: Bool?
    ) {
        self.gamePk = gamePk
        self.teamId = teamId
        self.playerId = playerId
        self.playerName = playerName
        self.battingOrder = battingOrder
        self.position = position
        self.batSide = batSide
        self.isConfirmed = isConfirmed
    }

    enum CodingKeys: String, CodingKey {
        case gamePk = "game_pk"
        case teamId = "team_id"
        case playerId = "player_id"
        case playerName = "player_name"
        case battingOrder = "batting_order"
        case position
        case batSide = "bat_side"
        case isConfirmed = "is_confirmed"
    }
}

/// Season archetype profile for a starting pitcher. Mirrors RN
/// `PitcherArchetypeProfile`.
public struct MLBPitcherArchetypeProfile: Codable, Hashable, Sendable {
    public let pitcherId: Int
    public let archetype: String
    public let kPct: Double?
    public let gbPct: Double?
    public let fbPct: Double?
    public let bbPct: Double?
    public let maxFbVelo: Double?

    public init(
        pitcherId: Int,
        archetype: String,
        kPct: Double?,
        gbPct: Double?,
        fbPct: Double?,
        bbPct: Double?,
        maxFbVelo: Double?
    ) {
        self.pitcherId = pitcherId
        self.archetype = archetype
        self.kPct = kPct
        self.gbPct = gbPct
        self.fbPct = fbPct
        self.bbPct = bbPct
        self.maxFbVelo = maxFbVelo
    }

    enum CodingKeys: String, CodingKey {
        case pitcherId = "pitcher_id"
        case archetype
        case kPct = "k_pct"
        case gbPct = "gb_pct"
        case fbPct = "fb_pct"
        case bbPct = "bb_pct"
        case maxFbVelo = "max_fb_velo"
    }
}

/// A starting pitcher as seen on the matchup card (resolved, display-ready).
public struct MLBPropStarter: Hashable, Sendable {
    public let pitcherId: Int
    public let name: String
    public let teamLabel: String
    public let hand: String        // "R" / "L"
    public let archetype: MLBPitcherArchetypeProfile?

    public init(pitcherId: Int, name: String, teamLabel: String, hand: String, archetype: MLBPitcherArchetypeProfile?) {
        self.pitcherId = pitcherId
        self.name = name
        self.teamLabel = teamLabel
        self.hand = hand
        self.archetype = archetype
    }
}

/// Fully-assembled props matchup for one game.
public struct MLBPropMatchup: Identifiable, Hashable, Sendable {
    public let gamePk: Int
    public let officialDate: String
    public let gameTimeEt: String?

    public let awayTeamName: String
    public let homeTeamName: String
    public let awayAbbr: String
    public let homeAbbr: String
    public let awayLogoUrl: String?
    public let homeLogoUrl: String?

    public let awayStarter: MLBPropStarter
    public let homeStarter: MLBPropStarter

    public let awayLineup: [MLBLineupRow]
    public let homeLineup: [MLBLineupRow]

    public let props: [MLBPlayerPropRow]

    public var id: Int { gamePk }

    /// Day/night taken from any posted prop row (they all share the game),
    /// falling back to night. Mirrors RN `playerProps[0]?.game_is_day`.
    public var gameIsDay: Bool { props.first?.gameIsDay ?? false }

    /// True when at least one prop is posted for this game.
    public var hasProps: Bool { !props.isEmpty }

    public init(
        gamePk: Int,
        officialDate: String,
        gameTimeEt: String?,
        awayTeamName: String,
        homeTeamName: String,
        awayAbbr: String,
        homeAbbr: String,
        awayLogoUrl: String?,
        homeLogoUrl: String?,
        awayStarter: MLBPropStarter,
        homeStarter: MLBPropStarter,
        awayLineup: [MLBLineupRow],
        homeLineup: [MLBLineupRow],
        props: [MLBPlayerPropRow]
    ) {
        self.gamePk = gamePk
        self.officialDate = officialDate
        self.gameTimeEt = gameTimeEt
        self.awayTeamName = awayTeamName
        self.homeTeamName = homeTeamName
        self.awayAbbr = awayAbbr
        self.homeAbbr = homeAbbr
        self.awayLogoUrl = awayLogoUrl
        self.homeLogoUrl = homeLogoUrl
        self.awayStarter = awayStarter
        self.homeStarter = homeStarter
        self.awayLineup = awayLineup
        self.homeLineup = homeLineup
        self.props = props
    }

    /// Batter props for players who aren't in either posted lineup
    /// (pinch hitters, bench). Mirrors RN `extraBatterGroups`.
    public var extraBatterGroups: [(playerId: Int, props: [MLBPlayerPropRow])] {
        let lineupIds = Set(awayLineup.map(\.playerId) + homeLineup.map(\.playerId))
        return MLBPlayerProps.groupPropsByPlayer(props, isPitcher: false)
            .filter { !lineupIds.contains($0.playerId) }
    }

    /// Props for one batter (non-pitcher rows for that player id).
    public func batterProps(for playerId: Int) -> [MLBPlayerPropRow] {
        props.filter { $0.playerId == playerId && !$0.isPitcher }
    }

    /// Props for one pitcher (pitcher rows for that player id).
    public func pitcherProps(for playerId: Int) -> [MLBPlayerPropRow] {
        props.filter { $0.playerId == playerId && $0.isPitcher }
    }
}

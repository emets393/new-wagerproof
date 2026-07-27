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

/// One posted-but-unlisted batter (pinch hitter / bench) with their prop rows.
/// A named struct rather than the old `(playerId:props:)` tuple so
/// `MLBPropMatchup` can STORE the group list and still synthesize `Hashable`.
public struct MLBExtraBatterGroup: Hashable, Sendable {
    public let playerId: Int
    public let props: [MLBPlayerPropRow]

    public init(playerId: Int, props: [MLBPlayerPropRow]) {
        self.playerId = playerId
        self.props = props
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

    // Derived once in `init`, never as computed properties. The props-insight
    // pipeline asks for one player's rows ~20 times per game, and each ask used
    // to be a linear `props.filter` — O(players × props) on every view body
    // pass. `props` is `let`, so these can never drift out of sync with it.
    private let batterPropsByPlayer: [Int: [MLBPlayerPropRow]]
    private let pitcherPropsByPlayer: [Int: [MLBPlayerPropRow]]

    /// Batter props for players who aren't in either posted lineup
    /// (pinch hitters, bench). Mirrors RN `extraBatterGroups`. Stored, not
    /// computed: it does a full group-by + per-player sort over `props`, and
    /// both `MLBPropsInsight.buildPool` and `PlayerPropFeed.items` read it.
    public let extraBatterGroups: [MLBExtraBatterGroup]

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

        // Single pass over `props` replaces the per-player linear filters.
        // Bucketing preserves each player's relative row order, so the indexed
        // lookups return exactly what the old `filter` returned.
        var batters: [Int: [MLBPlayerPropRow]] = [:]
        var pitchers: [Int: [MLBPlayerPropRow]] = [:]
        for row in props {
            if row.isPitcher {
                pitchers[row.playerId, default: []].append(row)
            } else {
                batters[row.playerId, default: []].append(row)
            }
        }
        self.batterPropsByPlayer = batters
        self.pitcherPropsByPlayer = pitchers

        let lineupIds = Set(awayLineup.map(\.playerId) + homeLineup.map(\.playerId))
        self.extraBatterGroups = MLBPlayerProps.groupPropsByPlayer(props, isPitcher: false)
            .filter { !lineupIds.contains($0.playerId) }
            .map { MLBExtraBatterGroup(playerId: $0.playerId, props: $0.props) }
    }

    /// Props for one batter (non-pitcher rows for that player id).
    public func batterProps(for playerId: Int) -> [MLBPlayerPropRow] {
        batterPropsByPlayer[playerId] ?? []
    }

    /// Props for one pitcher (pitcher rows for that player id).
    public func pitcherProps(for playerId: Int) -> [MLBPlayerPropRow] {
        pitcherPropsByPlayer[playerId] ?? []
    }
}

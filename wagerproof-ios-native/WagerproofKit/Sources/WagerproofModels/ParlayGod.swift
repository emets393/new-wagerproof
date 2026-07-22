import Foundation

// MARK: - Sports

/// Which league a leg/ticket is built from. The rail mixes sports side by side
/// (per-sport tickets, never cross-sport legs — slates rarely share dates).
public enum ParlaySport: String, CaseIterable, Identifiable, Sendable, Hashable {
    case mlb
    case nfl

    public var id: String { rawValue }

    /// Header display order for the "Supports" icon cluster.
    public static let displayOrder: [ParlaySport] = [.mlb, .nfl]

    public var shortLabel: String {
        switch self {
        case .mlb: return "MLB"
        case .nfl: return "NFL"
        }
    }

    public var sfSymbol: String {
        switch self {
        case .mlb: return "baseball.fill"
        case .nfl: return "football.fill"
        }
    }
}

// MARK: - Categories

/// The "why it's perfect" axis for Parlay God legs. Each rail card is one
/// category: every leg on it is backed by a 100% streak in that dimension.
/// See .claude/docs/parlay-god.md for the feature spec.
public enum ParlayGodCategory: String, CaseIterable, Identifiable, Sendable, Hashable {
    case versusOpponent
    case recentForm
    case alternateLines
    case homeAway
    case teamForm
    case favDog
    case dayNight
    case firstFive
    case firstHalf
    case armType

    public var id: String { rawValue }

    /// Rail display order — the user-confirmed five first, extras after.
    public static let displayOrder: [ParlayGodCategory] = [
        .versusOpponent, .recentForm, .alternateLines, .homeAway, .teamForm,
        .favDog, .dayNight, .firstFive, .firstHalf, .armType,
    ]

    public var title: String {
        switch self {
        case .versusOpponent: return "100% Versus Opponent"
        case .recentForm: return "100% Recent Form"
        case .alternateLines: return "100% Alternate Lines"
        case .homeAway: return "100% Home/Away"
        case .teamForm: return "100% Team Form"
        case .favDog: return "100% Fav vs Dog"
        case .dayNight: return "100% Day/Night"
        case .firstFive: return "100% First 5"
        case .firstHalf: return "100% First Half"
        case .armType: return "100% vs Arm Type"
        }
    }

    public var sfSymbol: String {
        switch self {
        case .versusOpponent: return "shield.lefthalf.filled"
        case .recentForm: return "flame.fill"
        case .alternateLines: return "slider.horizontal.3"
        case .homeAway: return "house.fill"
        case .teamForm: return "chart.line.uptrend.xyaxis"
        case .favDog: return "pawprint.fill"
        case .dayNight: return "moon.stars.fill"
        case .firstFive: return "5.circle.fill"
        case .firstHalf: return "circle.lefthalf.filled"
        case .armType: return "figure.baseball"
        }
    }
}

// MARK: - Legs

/// One bettable selection backed by a perfect (100%) streak. Legs are the
/// atoms the engine assembles into `ParlayTicket`s.
public struct ParlayLeg: Identifiable, Hashable, Sendable {
    public enum Kind: String, Sendable, Hashable {
        case team
        case prop
    }

    public let id: String
    public let kind: Kind
    public let sport: ParlaySport
    public let category: ParlayGodCategory
    /// `String(game_pk)` — matches both `OutliersTrendsGame.id` (MLB) and
    /// `String(MLBPropMatchup.gamePk)`, so same-game rules join cleanly.
    /// NFL team legs use `nfl_dryrun_games.game_id` ("2025_12_CLE_LV").
    public let gameKey: String
    public let matchupLabel: String
    public let gameTimeEt: String?
    /// Display name: team nickname ("White Sox") or short player name ("A. Kirk").
    public let subject: String
    /// Team whose logo/colors decorate the row (player's team for props).
    public let teamAbbr: String?
    /// MLB player id for headshots on prop legs.
    public let playerId: Int?
    /// Direct headshot URL (NFL props ship one; MLB resolves off `playerId`).
    public let headshotUrl: String?
    /// The actual bet: "CWS ML", "TOR -1.5", "Over 8.5", "2+ Hits", "Under 1.5 Walks".
    public let betText: String
    public let odds: Int
    /// Streak credential: "Won 5 straight as underdog", "Hit in 10 straight games".
    public let evidence: String
    public let streakN: Int
    /// Market key for per-card diversity capping (ml/rl/ou/f5_*/batter_hits/...).
    public let marketKey: String
    /// Team the bet backs (ML/RL sides). Same-game legs backing different
    /// teams conflict; totals legs leave this nil.
    public let backedTeamAbbr: String?
    /// Set for totals legs so Over/Under of the same market can't share a card.
    public let totalsFamily: String?
    public let totalsSide: String?

    public init(
        kind: Kind,
        sport: ParlaySport = .mlb,
        category: ParlayGodCategory,
        gameKey: String,
        matchupLabel: String,
        gameTimeEt: String?,
        subject: String,
        teamAbbr: String?,
        playerId: Int?,
        headshotUrl: String? = nil,
        betText: String,
        odds: Int,
        evidence: String,
        streakN: Int,
        marketKey: String,
        backedTeamAbbr: String? = nil,
        totalsFamily: String? = nil,
        totalsSide: String? = nil
    ) {
        self.id = "\(category.rawValue)|\(gameKey)|\(subject)|\(betText)"
        self.kind = kind
        self.sport = sport
        self.category = category
        self.gameKey = gameKey
        self.matchupLabel = matchupLabel
        self.gameTimeEt = gameTimeEt
        self.subject = subject
        self.teamAbbr = teamAbbr
        self.playerId = playerId
        self.headshotUrl = headshotUrl
        self.betText = betText
        self.odds = odds
        self.evidence = evidence
        self.streakN = streakN
        self.marketKey = marketKey
        self.backedTeamAbbr = backedTeamAbbr
        self.totalsFamily = totalsFamily
        self.totalsSide = totalsSide
    }

    public var oddsText: String {
        odds > 0 ? "+\(odds)" : "\(odds)"
    }

    /// "5/5", "10/10" — perfect streaks are always N of N.
    public var fractionText: String { "\(streakN)/\(streakN)" }
}

// MARK: - Tickets

/// An assembled parlay: 3-5 conflict-free legs plus the combined price.
public struct ParlayTicket: Identifiable, Hashable, Sendable {
    public let id: String
    /// Sports contributing legs, in `ParlaySport.displayOrder`. One entry for a
    /// per-sport ticket; several when concurrent live slates merged into one
    /// cross-sport card.
    public let sports: [ParlaySport]
    public let category: ParlayGodCategory
    public let legs: [ParlayLeg]
    public let combinedOddsText: String

    public init(id: String, sports: [ParlaySport] = [.mlb], category: ParlayGodCategory, legs: [ParlayLeg], combinedOddsText: String) {
        self.id = id
        self.sports = sports
        self.category = category
        self.legs = legs
        self.combinedOddsText = combinedOddsText
    }

    /// True when every leg comes from the same game (matchup-widget tickets).
    public var isSameGame: Bool {
        Set(legs.map(\.gameKey)).count == 1
    }
}

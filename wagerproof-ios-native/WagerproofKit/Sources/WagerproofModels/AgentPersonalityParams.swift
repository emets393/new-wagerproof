import Foundation

/// Codable mirror of the RN `PersonalityParams` interface in
/// `wagerproof-mobile/types/agent.ts:48-89`. Decoded from the `personality_params`
/// JSONB column on `avatar_profiles`. Every key matches snake_case byte-for-byte
/// so the same payload that flows to the React Native app decodes cleanly here.
///
/// Scale1To5 fields are validated 1...5 in the RN Zod schema; here we keep them
/// as `Int` so a malformed row still decodes (parity behavior — RN throws but
/// the screen tolerates it via React Query error states).
///
/// See .claude/docs/agents/02_PERSONALITY_PARAMS.md for the canonical reference.
public struct AgentPersonalityParams: Codable, Hashable, Sendable {
    // MARK: Core Personality (always present)
    public var riskTolerance: Int
    public var underdogLean: Int
    public var overUnderLean: Int
    public var confidenceThreshold: Int
    public var chaseValue: Bool

    // MARK: Bet Selection (always present)
    public var preferredBetType: String
    public var maxFavoriteOdds: Int?
    public var minUnderdogOdds: Int?
    public var maxPicksPerDay: Int
    public var skipWeakSlates: Bool

    // MARK: Data Trust (always present)
    public var trustModel: Int
    public var trustPolymarket: Int
    public var polymarketDivergenceFlag: Bool

    // MARK: NFL/CFB only (optional)
    public var fadePublic: Bool?
    public var publicThreshold: Int?
    public var weatherImpactsTotals: Bool?
    public var weatherSensitivity: Int?

    // MARK: NBA/NCAAB only (optional)
    public var trustTeamRatings: Int?
    public var paceAffectsTotals: Bool?

    // MARK: NBA only (optional)
    public var weightRecentForm: Int?
    public var rideHotStreaks: Bool?
    public var fadeColdStreaks: Bool?
    public var trustAtsTrends: Bool?
    public var regressLuck: Bool?

    // MARK: Situational (conditional)
    public var homeCourtBoost: Int
    public var fadeBackToBacks: Bool?
    public var upsetAlert: Bool?

    enum CodingKeys: String, CodingKey {
        case riskTolerance = "risk_tolerance"
        case underdogLean = "underdog_lean"
        case overUnderLean = "over_under_lean"
        case confidenceThreshold = "confidence_threshold"
        case chaseValue = "chase_value"
        case preferredBetType = "preferred_bet_type"
        case maxFavoriteOdds = "max_favorite_odds"
        case minUnderdogOdds = "min_underdog_odds"
        case maxPicksPerDay = "max_picks_per_day"
        case skipWeakSlates = "skip_weak_slates"
        case trustModel = "trust_model"
        case trustPolymarket = "trust_polymarket"
        case polymarketDivergenceFlag = "polymarket_divergence_flag"
        case fadePublic = "fade_public"
        case publicThreshold = "public_threshold"
        case weatherImpactsTotals = "weather_impacts_totals"
        case weatherSensitivity = "weather_sensitivity"
        case trustTeamRatings = "trust_team_ratings"
        case paceAffectsTotals = "pace_affects_totals"
        case weightRecentForm = "weight_recent_form"
        case rideHotStreaks = "ride_hot_streaks"
        case fadeColdStreaks = "fade_cold_streaks"
        case trustAtsTrends = "trust_ats_trends"
        case regressLuck = "regress_luck"
        case homeCourtBoost = "home_court_boost"
        case fadeBackToBacks = "fade_back_to_backs"
        case upsetAlert = "upset_alert"
    }

    /// Default params seeded when an old row lacks a populated JSONB. Mirrors
    /// `DEFAULT_PERSONALITY_PARAMS` in `types/agent.ts:401-416`.
    public static let `default` = AgentPersonalityParams(
        riskTolerance: 3,
        underdogLean: 3,
        overUnderLean: 3,
        confidenceThreshold: 3,
        chaseValue: false,
        preferredBetType: "any",
        maxFavoriteOdds: -200,
        minUnderdogOdds: nil,
        maxPicksPerDay: 3,
        skipWeakSlates: true,
        trustModel: 4,
        trustPolymarket: 3,
        polymarketDivergenceFlag: true,
        homeCourtBoost: 3
    )

    public init(
        riskTolerance: Int = 3,
        underdogLean: Int = 3,
        overUnderLean: Int = 3,
        confidenceThreshold: Int = 3,
        chaseValue: Bool = false,
        preferredBetType: String = "any",
        maxFavoriteOdds: Int? = -200,
        minUnderdogOdds: Int? = nil,
        maxPicksPerDay: Int = 3,
        skipWeakSlates: Bool = true,
        trustModel: Int = 4,
        trustPolymarket: Int = 3,
        polymarketDivergenceFlag: Bool = true,
        fadePublic: Bool? = nil,
        publicThreshold: Int? = nil,
        weatherImpactsTotals: Bool? = nil,
        weatherSensitivity: Int? = nil,
        trustTeamRatings: Int? = nil,
        paceAffectsTotals: Bool? = nil,
        weightRecentForm: Int? = nil,
        rideHotStreaks: Bool? = nil,
        fadeColdStreaks: Bool? = nil,
        trustAtsTrends: Bool? = nil,
        regressLuck: Bool? = nil,
        homeCourtBoost: Int = 3,
        fadeBackToBacks: Bool? = nil,
        upsetAlert: Bool? = nil
    ) {
        self.riskTolerance = riskTolerance
        self.underdogLean = underdogLean
        self.overUnderLean = overUnderLean
        self.confidenceThreshold = confidenceThreshold
        self.chaseValue = chaseValue
        self.preferredBetType = preferredBetType
        self.maxFavoriteOdds = maxFavoriteOdds
        self.minUnderdogOdds = minUnderdogOdds
        self.maxPicksPerDay = maxPicksPerDay
        self.skipWeakSlates = skipWeakSlates
        self.trustModel = trustModel
        self.trustPolymarket = trustPolymarket
        self.polymarketDivergenceFlag = polymarketDivergenceFlag
        self.fadePublic = fadePublic
        self.publicThreshold = publicThreshold
        self.weatherImpactsTotals = weatherImpactsTotals
        self.weatherSensitivity = weatherSensitivity
        self.trustTeamRatings = trustTeamRatings
        self.paceAffectsTotals = paceAffectsTotals
        self.weightRecentForm = weightRecentForm
        self.rideHotStreaks = rideHotStreaks
        self.fadeColdStreaks = fadeColdStreaks
        self.trustAtsTrends = trustAtsTrends
        self.regressLuck = regressLuck
        self.homeCourtBoost = homeCourtBoost
        self.fadeBackToBacks = fadeBackToBacks
        self.upsetAlert = upsetAlert
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        // Tolerant decoding — any missing scalar defaults to the .default value
        // since old rows in production sometimes have partial JSONB.
        self.riskTolerance = (try? c.decode(Int.self, forKey: .riskTolerance)) ?? Self.default.riskTolerance
        self.underdogLean = (try? c.decode(Int.self, forKey: .underdogLean)) ?? Self.default.underdogLean
        self.overUnderLean = (try? c.decode(Int.self, forKey: .overUnderLean)) ?? Self.default.overUnderLean
        self.confidenceThreshold = (try? c.decode(Int.self, forKey: .confidenceThreshold)) ?? Self.default.confidenceThreshold
        self.chaseValue = (try? c.decode(Bool.self, forKey: .chaseValue)) ?? Self.default.chaseValue
        self.preferredBetType = (try? c.decode(String.self, forKey: .preferredBetType)) ?? Self.default.preferredBetType
        self.maxFavoriteOdds = try? c.decodeIfPresent(Int.self, forKey: .maxFavoriteOdds)
        self.minUnderdogOdds = try? c.decodeIfPresent(Int.self, forKey: .minUnderdogOdds)
        self.maxPicksPerDay = (try? c.decode(Int.self, forKey: .maxPicksPerDay)) ?? Self.default.maxPicksPerDay
        self.skipWeakSlates = (try? c.decode(Bool.self, forKey: .skipWeakSlates)) ?? Self.default.skipWeakSlates
        self.trustModel = (try? c.decode(Int.self, forKey: .trustModel)) ?? Self.default.trustModel
        self.trustPolymarket = (try? c.decode(Int.self, forKey: .trustPolymarket)) ?? Self.default.trustPolymarket
        self.polymarketDivergenceFlag = (try? c.decode(Bool.self, forKey: .polymarketDivergenceFlag)) ?? Self.default.polymarketDivergenceFlag
        self.fadePublic = try? c.decodeIfPresent(Bool.self, forKey: .fadePublic)
        self.publicThreshold = try? c.decodeIfPresent(Int.self, forKey: .publicThreshold)
        self.weatherImpactsTotals = try? c.decodeIfPresent(Bool.self, forKey: .weatherImpactsTotals)
        self.weatherSensitivity = try? c.decodeIfPresent(Int.self, forKey: .weatherSensitivity)
        self.trustTeamRatings = try? c.decodeIfPresent(Int.self, forKey: .trustTeamRatings)
        self.paceAffectsTotals = try? c.decodeIfPresent(Bool.self, forKey: .paceAffectsTotals)
        self.weightRecentForm = try? c.decodeIfPresent(Int.self, forKey: .weightRecentForm)
        self.rideHotStreaks = try? c.decodeIfPresent(Bool.self, forKey: .rideHotStreaks)
        self.fadeColdStreaks = try? c.decodeIfPresent(Bool.self, forKey: .fadeColdStreaks)
        self.trustAtsTrends = try? c.decodeIfPresent(Bool.self, forKey: .trustAtsTrends)
        self.regressLuck = try? c.decodeIfPresent(Bool.self, forKey: .regressLuck)
        self.homeCourtBoost = (try? c.decode(Int.self, forKey: .homeCourtBoost)) ?? Self.default.homeCourtBoost
        self.fadeBackToBacks = try? c.decodeIfPresent(Bool.self, forKey: .fadeBackToBacks)
        self.upsetAlert = try? c.decodeIfPresent(Bool.self, forKey: .upsetAlert)
    }
}

/// `custom_insights` JSONB on `avatar_profiles`. RN `CustomInsights`
/// interface in `types/agent.ts:95-100`.
public struct AgentCustomInsights: Codable, Hashable, Sendable {
    public var bettingPhilosophy: String?
    public var perceivedEdges: String?
    public var avoidSituations: String?
    public var targetSituations: String?

    enum CodingKeys: String, CodingKey {
        case bettingPhilosophy = "betting_philosophy"
        case perceivedEdges = "perceived_edges"
        case avoidSituations = "avoid_situations"
        case targetSituations = "target_situations"
    }

    public init(
        bettingPhilosophy: String? = nil,
        perceivedEdges: String? = nil,
        avoidSituations: String? = nil,
        targetSituations: String? = nil
    ) {
        self.bettingPhilosophy = bettingPhilosophy
        self.perceivedEdges = perceivedEdges
        self.avoidSituations = avoidSituations
        self.targetSituations = targetSituations
    }

    public static let empty = AgentCustomInsights()
}

/// Archetype id enum — mirrors the RN `ARCHETYPE_IDS` tuple. Raw values match
/// the DB `archetype` column verbatim.
public enum AgentArchetype: String, Codable, CaseIterable, Sendable, Hashable {
    case contrarian
    case chalkGrinder = "chalk_grinder"
    case plusMoneyHunter = "plus_money_hunter"
    case modelTruther = "model_truther"
    case polymarketProphet = "polymarket_prophet"
    case momentumRider = "momentum_rider"
    case weatherWatcher = "weather_watcher"
    case theAnalyst = "the_analyst"

    /// Title-cased preset name shown in the agent card's strategy bar.
    public var displayName: String {
        switch self {
        case .contrarian: return "Contrarian"
        case .chalkGrinder: return "Chalk Grinder"
        case .plusMoneyHunter: return "Plus-Money Hunter"
        case .modelTruther: return "Model Truther"
        case .polymarketProphet: return "Polymarket Prophet"
        case .momentumRider: return "Momentum Rider"
        case .weatherWatcher: return "Weather Watcher"
        case .theAnalyst: return "The Analyst"
        }
    }
}

/// Sport enum used across agent-related tables. Values match the RN `SPORTS`
/// tuple.
public enum AgentSport: String, Codable, CaseIterable, Sendable, Hashable {
    case nfl
    case cfb
    case nba
    case ncaab
    case mlb

    public var label: String {
        switch self {
        case .nfl: return "NFL"
        case .cfb: return "CFB"
        case .nba: return "NBA"
        case .ncaab: return "NCAAB"
        case .mlb: return "MLB"
        }
    }

    /// SF Symbol approximation for the per-sport tag pills on AgentIdCard.
    public var sfSymbol: String {
        switch self {
        case .nfl: return "football.fill"
        case .cfb: return "football"
        case .nba: return "basketball.fill"
        case .ncaab: return "basketball"
        case .mlb: return "baseball.fill"
        }
    }
}

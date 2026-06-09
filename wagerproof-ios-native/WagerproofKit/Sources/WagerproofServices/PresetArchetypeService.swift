import Foundation
import Supabase
import WagerproofModels

/// Port of `wagerproof-mobile/services/agentService.ts::fetchPresetArchetypes`
/// plus the `hooks/usePresetArchetypes.ts` React-Query wrapper.
///
/// Preset archetypes live in `preset_archetypes` on **main** Supabase. The RN
/// app filters by `is_active=true` and orders by `display_order`. We mirror
/// that contract byte-for-byte so a row added through the admin tooling shows
/// up identically on both clients.
///
/// FIDELITY: Schema decoded into `PresetArchetypeRow` matches the RN
/// `PresetArchetype` interface in `types/agent.ts:239-249` — including the
/// nested `personality_params` (partial) + `custom_insights` JSONB columns.
public enum PresetArchetypeService {
    /// Fetch every active preset, ordered for display. Returns the canonical
    /// list — callers should cache (the store does this).
    public static func fetchAll() async throws -> [PresetArchetypeRow] {
        let main = await MainSupabase.shared.client
        let rows: [PresetArchetypeRow] = try await main
            .from("preset_archetypes")
            .select()
            .eq("is_active", value: true)
            .order("display_order", ascending: true)
            .execute()
            .value
        return rows
    }
}

/// Codable mirror of a `preset_archetypes` row. Field-for-field with RN
/// `PresetArchetype` in `wagerproof-mobile/types/agent.ts:239-249`.
///
/// `personality_params` is a **partial** params snapshot — only the deltas
/// from `DEFAULT_PERSONALITY_PARAMS` are stored on the row. Apply via
/// `AgentPersonalityParams.default.merging(_:)` (see AgentCreationStore).
public struct PresetArchetypeRow: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public let name: String
    public let emoji: String
    public let description: String
    public let color: String
    public let recommendedSports: [AgentSport]
    /// Partial param overrides — only the keys this archetype changes from
    /// defaults. Stored as raw JSON to preserve sparse semantics. Decoded into
    /// a strongly-typed merge helper at apply time.
    public let personalityParams: AgentPersonalityParamsPartial
    public let customInsights: AgentCustomInsights
    public let displayOrder: Int
    public let isActive: Bool

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case emoji
        case description
        case color
        case recommendedSports = "recommended_sports"
        case personalityParams = "personality_params"
        case customInsights = "custom_insights"
        case displayOrder = "display_order"
        case isActive = "is_active"
    }

    public init(
        id: String,
        name: String,
        emoji: String,
        description: String,
        color: String,
        recommendedSports: [AgentSport],
        personalityParams: AgentPersonalityParamsPartial,
        customInsights: AgentCustomInsights,
        displayOrder: Int,
        isActive: Bool = true
    ) {
        self.id = id
        self.name = name
        self.emoji = emoji
        self.description = description
        self.color = color
        self.recommendedSports = recommendedSports
        self.personalityParams = personalityParams
        self.customInsights = customInsights
        self.displayOrder = displayOrder
        self.isActive = isActive
    }
}

/// Partial personality params — only fields explicitly set on the archetype
/// row, so `nil` semantically means "keep default". Mirrors RN's
/// `Partial<PersonalityParams>` type from the archetype record.
public struct AgentPersonalityParamsPartial: Codable, Hashable, Sendable {
    public var riskTolerance: Int?
    public var underdogLean: Int?
    public var overUnderLean: Int?
    public var confidenceThreshold: Int?
    public var chaseValue: Bool?
    public var preferredBetType: String?
    public var maxFavoriteOdds: Int?
    public var minUnderdogOdds: Int?
    public var maxPicksPerDay: Int?
    public var skipWeakSlates: Bool?
    public var trustModel: Int?
    public var trustPolymarket: Int?
    public var polymarketDivergenceFlag: Bool?
    public var fadePublic: Bool?
    public var publicThreshold: Int?
    public var weatherImpactsTotals: Bool?
    public var weatherSensitivity: Int?
    public var trustTeamRatings: Int?
    public var paceAffectsTotals: Bool?
    public var weightRecentForm: Int?
    public var rideHotStreaks: Bool?
    public var fadeColdStreaks: Bool?
    public var trustAtsTrends: Bool?
    public var regressLuck: Bool?
    public var homeCourtBoost: Int?
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

    public init() {}
}

public extension AgentPersonalityParams {
    /// Apply an archetype's partial overrides on top of the canonical default
    /// set. Mirrors RN `{ ...DEFAULT_PERSONALITY_PARAMS, ...personality_params }`
    /// in `agents/create.tsx:151-152`.
    static func applying(_ partial: AgentPersonalityParamsPartial) -> AgentPersonalityParams {
        var p = AgentPersonalityParams.default
        if let v = partial.riskTolerance { p.riskTolerance = v }
        if let v = partial.underdogLean { p.underdogLean = v }
        if let v = partial.overUnderLean { p.overUnderLean = v }
        if let v = partial.confidenceThreshold { p.confidenceThreshold = v }
        if let v = partial.chaseValue { p.chaseValue = v }
        if let v = partial.preferredBetType { p.preferredBetType = v }
        if let v = partial.maxFavoriteOdds { p.maxFavoriteOdds = v }
        if let v = partial.minUnderdogOdds { p.minUnderdogOdds = v }
        if let v = partial.maxPicksPerDay { p.maxPicksPerDay = v }
        if let v = partial.skipWeakSlates { p.skipWeakSlates = v }
        if let v = partial.trustModel { p.trustModel = v }
        if let v = partial.trustPolymarket { p.trustPolymarket = v }
        if let v = partial.polymarketDivergenceFlag { p.polymarketDivergenceFlag = v }
        if let v = partial.fadePublic { p.fadePublic = v }
        if let v = partial.publicThreshold { p.publicThreshold = v }
        if let v = partial.weatherImpactsTotals { p.weatherImpactsTotals = v }
        if let v = partial.weatherSensitivity { p.weatherSensitivity = v }
        if let v = partial.trustTeamRatings { p.trustTeamRatings = v }
        if let v = partial.paceAffectsTotals { p.paceAffectsTotals = v }
        if let v = partial.weightRecentForm { p.weightRecentForm = v }
        if let v = partial.rideHotStreaks { p.rideHotStreaks = v }
        if let v = partial.fadeColdStreaks { p.fadeColdStreaks = v }
        if let v = partial.trustAtsTrends { p.trustAtsTrends = v }
        if let v = partial.regressLuck { p.regressLuck = v }
        if let v = partial.homeCourtBoost { p.homeCourtBoost = v }
        if let v = partial.fadeBackToBacks { p.fadeBackToBacks = v }
        if let v = partial.upsetAlert { p.upsetAlert = v }
        return p
    }
}

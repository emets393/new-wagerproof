package com.wagerproof.core.models

import com.wagerproof.core.models.serialization.FallbackEnumSerializer
import com.wagerproof.core.models.serialization.OptionalFallbackEnumSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Mirror of the `personality_params` JSONB column on `avatar_profiles` (RN
 * `PersonalityParams`, iOS `AgentPersonalityParams`). Keys are snake_case
 * byte-for-byte. Scale1To5 fields stay plain Int so a malformed row still
 * decodes. See .claude/docs/agents/02_PERSONALITY_PARAMS.md.
 */
@Serializable
data class AgentPersonalityParams(
    // Core personality (always present)
    @SerialName("risk_tolerance") var riskTolerance: Int = 3,
    @SerialName("underdog_lean") var underdogLean: Int = 3,
    @SerialName("over_under_lean") var overUnderLean: Int = 3,
    @SerialName("confidence_threshold") var confidenceThreshold: Int = 3,
    @SerialName("chase_value") var chaseValue: Boolean = false,
    // 1 = straights only (submit_parlay withheld server-side) … 5 = loves parlays.
    @SerialName("parlay_appetite") var parlayAppetite: Int = 1,
    // Forces EVERY play into parlay tickets; overrides parlayAppetite's tool gating.
    @SerialName("parlays_only") var parlaysOnly: Boolean = false,
    /** Opt into one NFL/CFB parlay that remains active for the football week. */
    @SerialName("weekly_parlay_enabled") var weeklyParlayEnabled: Boolean? = null,
    /** Requested weekly ticket length, server-clamped to 2…6. */
    @SerialName("weekly_parlay_legs") var weeklyParlayLegs: Int? = null,

    // Bet selection (always present)
    @SerialName("preferred_bet_type") var preferredBetType: String = "any",
    /** Flat V3 market allowlist; null/empty means all markets for selected sports. */
    @SerialName("allowed_markets") var allowedMarkets: List<String>? = null,
    /** NFL player-prop steering: off / allow / emphasize. */
    @SerialName("props_emphasis") var propsEmphasis: String? = null,
    // Wire default is null; the canonical [default] instance carries -200 (parity with Swift).
    @SerialName("max_favorite_odds") var maxFavoriteOdds: Int? = null,
    @SerialName("min_underdog_odds") var minUnderdogOdds: Int? = null,
    @SerialName("max_picks_per_day") var maxPicksPerDay: Int = 3,
    @SerialName("skip_weak_slates") var skipWeakSlates: Boolean = true,

    // Data trust (always present)
    @SerialName("trust_model") var trustModel: Int = 4,
    @SerialName("trust_polymarket") var trustPolymarket: Int = 3,
    @SerialName("polymarket_divergence_flag") var polymarketDivergenceFlag: Boolean = true,

    // NFL/CFB only
    @SerialName("fade_public") var fadePublic: Boolean? = null,
    @SerialName("public_threshold") var publicThreshold: Int? = null,
    @SerialName("weather_impacts_totals") var weatherImpactsTotals: Boolean? = null,
    @SerialName("weather_sensitivity") var weatherSensitivity: Int? = null,

    // NBA/NCAAB only
    @SerialName("trust_team_ratings") var trustTeamRatings: Int? = null,
    @SerialName("pace_affects_totals") var paceAffectsTotals: Boolean? = null,

    // NBA only
    @SerialName("weight_recent_form") var weightRecentForm: Int? = null,
    @SerialName("ride_hot_streaks") var rideHotStreaks: Boolean? = null,
    @SerialName("fade_cold_streaks") var fadeColdStreaks: Boolean? = null,
    @SerialName("trust_ats_trends") var trustAtsTrends: Boolean? = null,
    @SerialName("regress_luck") var regressLuck: Boolean? = null,

    // Situational
    @SerialName("home_court_boost") var homeCourtBoost: Int = 3,
    @SerialName("fade_back_to_backs") var fadeBackToBacks: Boolean? = null,
    @SerialName("upset_alert") var upsetAlert: Boolean? = null,
) {
    companion object {
        /**
         * Default params seeded when an old row lacks a populated JSONB
         * (RN `DEFAULT_PERSONALITY_PARAMS`). Note maxFavoriteOdds is -200 here
         * even though a decode-miss leaves it null.
         */
        val default = AgentPersonalityParams(maxFavoriteOdds = -200)
    }
}

/** `custom_insights` JSONB on `avatar_profiles` (RN `CustomInsights`). */
@Serializable
data class AgentCustomInsights(
    @SerialName("betting_philosophy") var bettingPhilosophy: String? = null,
    @SerialName("perceived_edges") var perceivedEdges: String? = null,
    @SerialName("avoid_situations") var avoidSituations: String? = null,
    @SerialName("target_situations") var targetSituations: String? = null,
) {
    companion object {
        val empty = AgentCustomInsights()
    }
}

/**
 * Archetype id enum — raw values match the DB `archetype` column verbatim.
 * Unknown raw values decode to null (apply [AgentArchetypeSerializer] at the
 * property site — a nullable serializer can't be a class-level default).
 */
enum class AgentArchetype(val raw: String) {
    CONTRARIAN("contrarian"),
    CHALK_GRINDER("chalk_grinder"),
    PLUS_MONEY_HUNTER("plus_money_hunter"),
    MODEL_TRUTHER("model_truther"),
    POLYMARKET_PROPHET("polymarket_prophet"),
    MOMENTUM_RIDER("momentum_rider"),
    WEATHER_WATCHER("weather_watcher"),
    THE_ANALYST("the_analyst");

    /** Title-cased preset name shown in the agent card's strategy bar. */
    val displayName: String
        get() = when (this) {
            CONTRARIAN -> "Contrarian"
            CHALK_GRINDER -> "Chalk Grinder"
            PLUS_MONEY_HUNTER -> "Plus-Money Hunter"
            MODEL_TRUTHER -> "Model Truther"
            POLYMARKET_PROPHET -> "Polymarket Prophet"
            MOMENTUM_RIDER -> "Momentum Rider"
            WEATHER_WATCHER -> "Weather Watcher"
            THE_ANALYST -> "The Analyst"
        }
}

object AgentArchetypeSerializer : OptionalFallbackEnumSerializer<AgentArchetype>(
    serialName = "AgentArchetype",
    rawToValue = AgentArchetype.entries.associateBy { it.raw },
    valueToRaw = { it.raw },
)

/**
 * Sport enum used across agent-related tables. Unknown raw values fall back to
 * NFL (matches Swift's `?? .nfl` in AgentPick / TopAgentPickFeedRow decode).
 */
@Serializable(with = AgentSportSerializer::class)
enum class AgentSport(val raw: String) {
    NFL("nfl"),
    CFB("cfb"),
    NBA("nba"),
    NCAAB("ncaab"),
    MLB("mlb");

    val label: String get() = raw.uppercase()

    /** SF Symbol name kept for iOS parity; Android maps these to its own icon ids. */
    val sfSymbol: String
        get() = when (this) {
            NFL -> "football.fill"
            CFB -> "football"
            NBA -> "basketball.fill"
            NCAAB -> "basketball"
            MLB -> "baseball.fill"
        }
}

object AgentSportSerializer : FallbackEnumSerializer<AgentSport>(
    serialName = "AgentSport",
    rawToValue = AgentSport.entries.associateBy { it.raw },
    valueToRaw = { it.raw },
    default = AgentSport.NFL,
)

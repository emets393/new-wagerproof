package com.wagerproof.core.services

import com.wagerproof.core.models.AgentCustomInsights
import com.wagerproof.core.models.AgentPersonalityParams
import com.wagerproof.core.models.AgentSport
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Preset archetypes for the agent-creation wizard, from `preset_archetypes` on
 * the Main project. Port of iOS `PresetArchetypeService.swift` — same contract
 * as RN (`is_active=true`, ordered by `display_order`) so a row added through
 * admin tooling shows up identically on every client.
 */
object PresetArchetypeService {

    /** Every active preset, ordered for display. Callers cache (the store does). */
    suspend fun fetchAll(): List<PresetArchetypeRow> =
        SupabaseClients.main.from("preset_archetypes").select {
            filter { eq("is_active", true) }
            order("display_order", Order.ASCENDING)
        }.decodeList()
}

/**
 * Mirror of a `preset_archetypes` row (RN `PresetArchetype` in
 * `types/agent.ts:239-249`). Lives here rather than core/models because only
 * the preset flow reads it (mirrors its Swift home in PresetArchetypeService.swift).
 *
 * `personality_params` is a PARTIAL snapshot — only the deltas this archetype
 * changes from defaults are stored on the row.
 */
@Serializable
data class PresetArchetypeRow(
    val id: String,
    val name: String,
    val emoji: String,
    val description: String,
    val color: String,
    @SerialName("recommended_sports") val recommendedSports: List<AgentSport>,
    @SerialName("personality_params") val personalityParams: AgentPersonalityParamsPartial,
    @SerialName("custom_insights") val customInsights: AgentCustomInsights,
    @SerialName("display_order") val displayOrder: Int,
    @SerialName("is_active") val isActive: Boolean = true,
)

/**
 * Partial personality params — only fields explicitly set on the archetype
 * row; null semantically means "keep default". Mirrors RN's
 * `Partial<PersonalityParams>`.
 */
@Serializable
data class AgentPersonalityParamsPartial(
    @SerialName("risk_tolerance") val riskTolerance: Int? = null,
    @SerialName("underdog_lean") val underdogLean: Int? = null,
    @SerialName("over_under_lean") val overUnderLean: Int? = null,
    @SerialName("confidence_threshold") val confidenceThreshold: Int? = null,
    @SerialName("chase_value") val chaseValue: Boolean? = null,
    @SerialName("preferred_bet_type") val preferredBetType: String? = null,
    @SerialName("max_favorite_odds") val maxFavoriteOdds: Int? = null,
    @SerialName("min_underdog_odds") val minUnderdogOdds: Int? = null,
    @SerialName("max_picks_per_day") val maxPicksPerDay: Int? = null,
    @SerialName("skip_weak_slates") val skipWeakSlates: Boolean? = null,
    @SerialName("trust_model") val trustModel: Int? = null,
    @SerialName("trust_polymarket") val trustPolymarket: Int? = null,
    @SerialName("polymarket_divergence_flag") val polymarketDivergenceFlag: Boolean? = null,
    @SerialName("fade_public") val fadePublic: Boolean? = null,
    @SerialName("public_threshold") val publicThreshold: Int? = null,
    @SerialName("weather_impacts_totals") val weatherImpactsTotals: Boolean? = null,
    @SerialName("weather_sensitivity") val weatherSensitivity: Int? = null,
    @SerialName("trust_team_ratings") val trustTeamRatings: Int? = null,
    @SerialName("pace_affects_totals") val paceAffectsTotals: Boolean? = null,
    @SerialName("weight_recent_form") val weightRecentForm: Int? = null,
    @SerialName("ride_hot_streaks") val rideHotStreaks: Boolean? = null,
    @SerialName("fade_cold_streaks") val fadeColdStreaks: Boolean? = null,
    @SerialName("trust_ats_trends") val trustAtsTrends: Boolean? = null,
    @SerialName("regress_luck") val regressLuck: Boolean? = null,
    @SerialName("home_court_boost") val homeCourtBoost: Int? = null,
    @SerialName("fade_back_to_backs") val fadeBackToBacks: Boolean? = null,
    @SerialName("upset_alert") val upsetAlert: Boolean? = null,
)

/**
 * Apply an archetype's partial overrides on top of the canonical defaults —
 * semantics of RN `{ ...DEFAULT_PERSONALITY_PARAMS, ...personality_params }`.
 */
fun AgentPersonalityParams.Companion.applying(
    partial: AgentPersonalityParamsPartial,
): AgentPersonalityParams {
    // copy() first — `default` is a shared instance with var fields, and
    // mutating it in place would poison every later merge.
    val p = default.copy()
    partial.riskTolerance?.let { p.riskTolerance = it }
    partial.underdogLean?.let { p.underdogLean = it }
    partial.overUnderLean?.let { p.overUnderLean = it }
    partial.confidenceThreshold?.let { p.confidenceThreshold = it }
    partial.chaseValue?.let { p.chaseValue = it }
    partial.preferredBetType?.let { p.preferredBetType = it }
    partial.maxFavoriteOdds?.let { p.maxFavoriteOdds = it }
    partial.minUnderdogOdds?.let { p.minUnderdogOdds = it }
    partial.maxPicksPerDay?.let { p.maxPicksPerDay = it }
    partial.skipWeakSlates?.let { p.skipWeakSlates = it }
    partial.trustModel?.let { p.trustModel = it }
    partial.trustPolymarket?.let { p.trustPolymarket = it }
    partial.polymarketDivergenceFlag?.let { p.polymarketDivergenceFlag = it }
    partial.fadePublic?.let { p.fadePublic = it }
    partial.publicThreshold?.let { p.publicThreshold = it }
    partial.weatherImpactsTotals?.let { p.weatherImpactsTotals = it }
    partial.weatherSensitivity?.let { p.weatherSensitivity = it }
    partial.trustTeamRatings?.let { p.trustTeamRatings = it }
    partial.paceAffectsTotals?.let { p.paceAffectsTotals = it }
    partial.weightRecentForm?.let { p.weightRecentForm = it }
    partial.rideHotStreaks?.let { p.rideHotStreaks = it }
    partial.fadeColdStreaks?.let { p.fadeColdStreaks = it }
    partial.trustAtsTrends?.let { p.trustAtsTrends = it }
    partial.regressLuck?.let { p.regressLuck = it }
    partial.homeCourtBoost?.let { p.homeCourtBoost = it }
    partial.fadeBackToBacks?.let { p.fadeBackToBacks = it }
    partial.upsetAlert?.let { p.upsetAlert = it }
    return p
}

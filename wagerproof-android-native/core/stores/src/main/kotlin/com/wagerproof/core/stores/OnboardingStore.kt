package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.AgentCustomInsights
import com.wagerproof.core.models.AgentPersonalityParams
import com.wagerproof.core.models.SportLeague
import com.wagerproof.core.models.serialization.WagerproofJson
import com.wagerproof.core.services.BuildFlags
import com.wagerproof.core.services.MetaAnalyticsService
import com.wagerproof.core.services.SupabaseClients
import com.wagerproof.core.shared.AppGroupKey
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * Port of iOS `OnboardingStore.swift`. Owns the onboarding wizard's entire
 * state: local-first completion flag, 20-step pointer, survey answers, and the
 * embedded agent-builder draft.
 *
 * Mutations are cache-first with a fire-and-forget background sync to `profiles`
 * — server failure NEVER blocks the user (matches the RN/iOS "local cache is
 * the source of truth" contract).
 */
@Stable
class OnboardingStore {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    /**
     * 20-step ordered flow. Steps 1..18 are pages inside the onboarding carousel
     * (`carouselIndex` 0..17); 19/20 are full-screen cinematic phases rendered
     * outside the pager. Raw values MUST stay contiguous — [advance]/[back]
     * navigate by ±1 arithmetic. Enum declaration order == raw order, so the
     * natural (ordinal) comparison used by [isCinematic] matches Swift's
     * `Comparable` on rawValue.
     */
    enum class Step(val raw: Int) {
        TERMS(1),
        SPORTS_SELECTION(2),
        SPORTS_SHOWCASE(3),
        BETTOR_TYPE(4),
        PERSONALIZED_VALUE(5),
        ACQUISITION_SOURCE(6),
        PRIMARY_GOAL(7),
        AGENT_VALUE_INTRO(8),
        AGENT_VALUE_PROOF(9),
        ATT_PRIMING(10),
        BUILDER_SPORTS(11),
        BUILDER_ARCHETYPE(12),
        BUILDER_MINDSET(13),
        BUILDER_BET_STYLE(14),
        BUILDER_DATA_TRUST(15),
        BUILDER_SPORT_RULES(16),
        BUILDER_INSIGHTS(17),
        BUILDER_IDENTITY(18),
        GENERATION(19),
        REVEAL(20);

        val isCinematic: Boolean get() = this >= GENERATION

        /** TabView slot (0-based). null for cinematic steps — they render outside the pager. */
        val carouselIndex: Int? get() = if (isCinematic) null else raw - 1

        /** Progress-bar fraction. null for cinematic steps (no chrome there). */
        val progress: Double? get() = if (isCinematic) null else raw.toDouble() / carouselPageCount

        companion object {
            const val carouselPageCount: Int = 18

            fun fromRaw(raw: Int): Step? = entries.firstOrNull { it.raw == raw }
        }
    }

    @Serializable
    enum class BettorType(val raw: String) {
        @SerialName("casual") Casual("casual"),
        @SerialName("serious") Serious("serious"),
        @SerialName("professional") Professional("professional"),
    }

    /**
     * Survey answers synced to `profiles.onboarding_data`. Every field has a
     * default so older payloads decode (tolerant — mirrors Swift's Codable
     * shape kept for backward compat, including the dormant [age]).
     */
    @Serializable
    data class SurveyAnswers(
        val favoriteSports: List<String> = emptyList(),
        /** Dormant since the v2 redesign; kept so older payloads keep their shape. Never set. */
        val age: Int? = null,
        val bettorType: BettorType? = null,
        val mainGoal: String? = null,
        val emailOptIn: Boolean? = null,
        val acquisitionSource: String? = null,
        val termsAcceptedAt: String? = null,
        val overEighteenAttested: Boolean? = null,
    )

    /**
     * Full agent-draft state — mirrors the standalone wizard's draft so
     * onboarding collects the same configuration depth. Persisted to
     * `profiles.onboarding_data.agentFormState`. Every field defaults
     * individually so older (pre-expansion) payloads decode without crashing.
     */
    @Serializable
    data class AgentDraft(
        val preferredSports: List<SportLeague> = emptyList(),
        val archetype: String? = null, // archetype id; matches AgentArchetype.raw
        val name: String = "",
        // RN INITIAL_FORM_STATE defaults: emoji=🤖, color=gradient indigo→pink.
        val avatarEmoji: String = "🤖",
        val avatarColor: String = "gradient:#6366f1,#ec4899",
        /** User-chosen pixel character (0..7). null = legacy name-hash pick. */
        val spriteIndex: Int? = null,
        val personalityParams: AgentPersonalityParams = AgentPersonalityParams.default,
        val customInsights: AgentCustomInsights = AgentCustomInsights.empty,
        val autoGenerate: Boolean = true,
        val autoGenerateTime: String = "09:00",
        val autoGenerateTimezone: String = "America/New_York",
    )

    // MARK: - Observable state

    var isComplete by mutableStateOf(false); private set
    var currentStep by mutableStateOf(Step.TERMS); private set
    var survey by mutableStateOf(SurveyAnswers()); private set
    private var _agentDraft by mutableStateOf(AgentDraft())
    val agentDraft: AgentDraft get() = _agentDraft

    /** Monotonic counter the views use for haptic triggers — bumps on each advance. */
    var advanceCount by mutableStateOf(0); private set
    var isTransitioning by mutableStateOf(false); private set

    // Transient per-run UI state. Lives here (not in page views) so the pager's
    // windowed unmounting can't lose it and the shared chrome can derive CTA
    // enablement from `canAdvance(from:)`.
    var hasScrolledTermsToBottom by mutableStateOf(false); private set
    var hasCheckedTerms by mutableStateOf(false); private set
    /** Tracked separately from `agentDraft.archetype` because the scratch path leaves archetype null. */
    var hasChosenArchetype by mutableStateOf(false); private set
    /** Agent-pitch page: index of the visible reason-carousel slide (0..2). */
    private var _agentPitchSlide by mutableStateOf(0)
    val agentPitchSlide: Int get() = _agentPitchSlide

    /** The user this store is currently scoped to. null when signed out. */
    private var attachedUserId: String? = null
    private var validationJob: Job? = null
    private var transitionJob: Job? = null

    fun close() = scope.cancel()

    // MARK: - User attachment

    /**
     * Bind the store to the signed-in user. Loads cached completion
     * synchronously (no spinner between splash and the next screen) and kicks
     * off a background Supabase read to reconcile. Idempotent — same userId is
     * a no-op.
     */
    fun attachUser(userId: String) {
        if (attachedUserId == userId) return
        attachedUserId = userId

        // Step 1: instant cache read. Local cache is authoritative offline.
        isComplete = StorePrefs.appGroup.getBoolean(AppGroupKey.onboardingComplete(userId), false)

        // Step 2: background validate against Supabase. Failures swallowed —
        // local cache is the fallback source of truth.
        validationJob?.cancel()
        validationJob = scope.launch { validateAgainstSupabase(userId) }
    }

    /**
     * Detach the current user. The per-user cache entry STAYS so re-signing as
     * the same user is still instant.
     */
    fun detachUser() {
        validationJob?.cancel()
        validationJob = null
        attachedUserId = null
        isComplete = false
        resetToStart()
    }

    private suspend fun validateAgainstSupabase(userId: String) {
        try {
            val row = SupabaseClients.main
                .from("profiles")
                .select(columns = Columns.raw("onboarding_completed")) {
                    filter { eq("user_id", userId) }
                }
                .decodeSingle<OnboardingFlagRow>()

            // Re-check we're still attached to the same user — auth could have
            // flipped while the network call was in flight.
            if (attachedUserId != userId) return
            val serverCompleted = row.onboardingCompleted ?: false
            if (serverCompleted && !isComplete) {
                isComplete = true
                StorePrefs.appGroup.edit().putBoolean(AppGroupKey.onboardingComplete(userId), true).apply()
            }
            // We never downgrade true → false from the server: a just-completed
            // local flag whose write hasn't landed would otherwise bounce the
            // user back into the flow.
        } catch (_: Throwable) {
            // Network failure / no profile row yet — trust local cache.
        }
    }

    @Serializable
    private data class OnboardingFlagRow(
        @SerialName("onboarding_completed") val onboardingCompleted: Boolean? = null,
    )

    // MARK: - Step navigation

    fun advance() {
        if (isTransitioning) return
        val next = Step.fromRaw(currentStep.raw + 1) ?: return
        isTransitioning = true
        currentStep = next
        advanceCount += 1
        startTransitionLock()
    }

    fun back() {
        if (isTransitioning) return
        val prev = Step.fromRaw(currentStep.raw - 1) ?: return
        isTransitioning = true
        currentStep = prev
        startTransitionLock()
    }

    // 350ms lock — prevents double-taps from skipping steps and matches the
    // carousel's page-slide duration. Cancel-and-relaunch so overlapping taps
    // can't strand `isTransitioning=true`.
    private fun startTransitionLock() {
        transitionJob?.cancel()
        transitionJob = scope.launch {
            delay(350)
            isTransitioning = false
        }
    }

    /** Jump back to step 1 without firing transitions. Used by reset + detachUser. */
    fun resetToStart() {
        currentStep = Step.TERMS
        survey = SurveyAnswers()
        _agentDraft = AgentDraft()
        advanceCount = 0
        hasScrolledTermsToBottom = false
        hasCheckedTerms = false
        hasChosenArchetype = false
        _agentPitchSlide = 0
    }

    // MARK: - CTA gating

    /** The single validation surface the carousel container consults per step. */
    fun canAdvance(step: Step): Boolean = when (step) {
        Step.TERMS -> hasCheckedTerms
        Step.SPORTS_SELECTION -> survey.favoriteSports.isNotEmpty()
        Step.BETTOR_TYPE -> survey.bettorType != null
        Step.ACQUISITION_SOURCE -> survey.acquisitionSource != null
        Step.PRIMARY_GOAL -> survey.mainGoal != null
        Step.BUILDER_SPORTS -> agentDraft.preferredSports.isNotEmpty()
        Step.BUILDER_ARCHETYPE -> hasChosenArchetype
        Step.BUILDER_IDENTITY -> {
            val trimmed = agentDraft.name.trim()
            trimmed.isNotEmpty() && trimmed.length <= 50
        }
        Step.SPORTS_SHOWCASE, Step.PERSONALIZED_VALUE, Step.AGENT_VALUE_INTRO,
        Step.AGENT_VALUE_PROOF, Step.ATT_PRIMING,
        Step.BUILDER_MINDSET, Step.BUILDER_BET_STYLE, Step.BUILDER_DATA_TRUST,
        Step.BUILDER_SPORT_RULES, Step.BUILDER_INSIGHTS,
        Step.GENERATION, Step.REVEAL -> true
    }

    // MARK: - Survey mutators

    fun setFavoriteSports(sports: List<String>) {
        survey = survey.copy(favoriteSports = sports)
    }

    fun toggleFavoriteSport(sport: String) {
        val current = survey.favoriteSports
        survey = survey.copy(
            favoriteSports = if (current.contains(sport)) current - sport else current + sport,
        )
    }

    fun setBettorType(type: BettorType) {
        survey = survey.copy(bettorType = type)
    }

    fun setMainGoal(goal: String) {
        survey = survey.copy(mainGoal = goal)
    }

    fun setAcquisitionSource(source: String) {
        survey = survey.copy(acquisitionSource = source)
    }

    fun setTermsScrolledToBottom() {
        hasScrolledTermsToBottom = true
    }

    fun setTermsChecked(checked: Boolean) {
        hasCheckedTerms = checked
    }

    /** Stamps acceptance + the 18+ attestation (the Terms checkbox copy covers both). */
    fun setTermsAccepted() {
        survey = survey.copy(termsAcceptedAt = isoNow(), overEighteenAttested = true)
    }

    // MARK: - Agent draft mutators

    fun setAgentSports(sports: List<SportLeague>) {
        _agentDraft = agentDraft.copy(preferredSports = sports)
    }

    fun setAgentArchetype(archetype: String?) {
        _agentDraft = agentDraft.copy(archetype = archetype)
    }

    fun setArchetypeChosen() {
        hasChosenArchetype = true
    }

    fun setAgentPitchSlide(index: Int) {
        _agentPitchSlide = index.coerceIn(0, agentPitchSlideCount - 1)
    }

    fun setAgentName(name: String) {
        _agentDraft = agentDraft.copy(name = name)
    }

    fun setAgentEmoji(emoji: String) {
        _agentDraft = agentDraft.copy(avatarEmoji = emoji)
    }

    fun setAgentColor(color: String) {
        _agentDraft = agentDraft.copy(avatarColor = color)
    }

    /** Replace the entire agent draft (projects the embedded creation store back in). */
    fun setAgentDraft(draft: AgentDraft) {
        _agentDraft = draft
    }

    // MARK: - Completion

    /**
     * Mark onboarding complete + background-sync `profiles.onboarding_completed`.
     * Order matters: local flag + cache write FIRST (never re-shows onboarding
     * on network failure), then Meta funnel event, then fire-and-forget sync.
     */
    fun markComplete() {
        // Local cache write first — never blocks.
        isComplete = true
        attachedUserId?.let { userId ->
            StorePrefs.appGroup.edit().putBoolean(AppGroupKey.onboardingComplete(userId), true).apply()
        }

        // Fire Meta SDK `fb_mobile_complete_registration` (install → register funnel).
        MetaAnalyticsService.trackCompleteRegistration(method = "email")

        // Snapshot data so the mutators can't race with the network task.
        val surveySnapshot = survey
        val agentSnapshot = agentDraft
        scope.launch { syncToSupabase(surveySnapshot, agentSnapshot) }
    }

    /** DEBUG/dev-tools affordance — reset wizard state AND wipe the per-user cache. */
    fun reset() {
        isComplete = false
        attachedUserId?.let { userId ->
            StorePrefs.appGroup.edit().putBoolean(AppGroupKey.onboardingComplete(userId), false).apply()
        }
        resetToStart()
    }

    // MARK: - Background sync

    /** Fire-and-forget profile sync; never blocks UI. Failure intentionally swallowed. */
    private suspend fun syncToSupabase(survey: SurveyAnswers, agent: AgentDraft) {
        try {
            // Matches Swift's `client.auth.session.user` read — return if no session.
            val uid = SupabaseClients.main.auth.currentUserOrNull()?.id ?: return
            val payload = OnboardingSyncPayload(
                onboardingData = OnboardingDataPayload(
                    favoriteSports = survey.favoriteSports,
                    age = survey.age,
                    bettorType = survey.bettorType?.raw,
                    mainGoal = survey.mainGoal,
                    acquisitionSource = survey.acquisitionSource,
                    termsAcceptedAt = survey.termsAcceptedAt,
                    overEighteenAttested = survey.overEighteenAttested,
                    agentFormState = AgentFormStatePayload(
                        preferredSports = agent.preferredSports.map { it.raw },
                        archetype = agent.archetype,
                        name = agent.name,
                        avatarEmoji = agent.avatarEmoji,
                        avatarColor = agent.avatarColor,
                        spriteIndex = agent.spriteIndex,
                        personalityParams = agent.personalityParams,
                        customInsights = agent.customInsights,
                        autoGenerate = agent.autoGenerate,
                        autoGenerateTime = agent.autoGenerateTime,
                        autoGenerateTimezone = agent.autoGenerateTimezone,
                    ),
                ),
                onboardingCompleted = true,
            )
            // Encode via a defaults-preserving Json so nested personality_params
            // fully serialise (the shared serializer drops default-valued fields).
            val element = SYNC_JSON.encodeToJsonElement(OnboardingSyncPayload.serializer(), payload)
            SupabaseClients.main.from("profiles").update(element) {
                filter { eq("user_id", uid) }
            }
        } catch (_: Throwable) {
            // FIDELITY-WAIVER #027: Offline write queue not ported — failure log + drop.
            // Acceptable since the call is fire-and-forget and the local cache is
            // authoritative for gating.
        }
    }

    @Serializable
    private data class OnboardingSyncPayload(
        @SerialName("onboarding_data") val onboardingData: OnboardingDataPayload,
        @SerialName("onboarding_completed") val onboardingCompleted: Boolean,
    )

    // Match RN's nested shape: { favoriteSports, age?, ..., agentFormState }.
    // Optional (Swift encodeIfPresent) fields are nullable; the sync Json omits
    // nulls (explicitNulls=false). favoriteSports/agentFormState always encode.
    @Serializable
    private data class OnboardingDataPayload(
        val favoriteSports: List<String>,
        val age: Int? = null,
        val bettorType: String? = null,
        val mainGoal: String? = null,
        val acquisitionSource: String? = null,
        val termsAcceptedAt: String? = null,
        val overEighteenAttested: Boolean? = null,
        val agentFormState: AgentFormStatePayload,
    )

    // Snake-case mirror of RN's `CreateAgentFormState`. Adding fields here must
    // round-trip with `INITIAL_FORM_STATE` defaults on the JS side.
    @Serializable
    private data class AgentFormStatePayload(
        @SerialName("preferred_sports") val preferredSports: List<String>,
        val archetype: String? = null,
        val name: String,
        @SerialName("avatar_emoji") val avatarEmoji: String,
        @SerialName("avatar_color") val avatarColor: String,
        @SerialName("sprite_index") val spriteIndex: Int? = null,
        @SerialName("personality_params") val personalityParams: AgentPersonalityParams,
        @SerialName("custom_insights") val customInsights: AgentCustomInsights,
        @SerialName("auto_generate") val autoGenerate: Boolean,
        @SerialName("auto_generate_time") val autoGenerateTime: String,
        @SerialName("auto_generate_timezone") val autoGenerateTimezone: String,
    )

    // MARK: - DEBUG seams (ScreenshotHarness parity)

    fun debugSetStep(step: Step) {
        if (!BuildFlags.isDebugBuild) return
        currentStep = step
    }

    fun debugSetSurvey(survey: SurveyAnswers) {
        if (!BuildFlags.isDebugBuild) return
        this.survey = survey
    }

    fun debugSetAgentDraft(agentDraft: AgentDraft) {
        if (!BuildFlags.isDebugBuild) return
        this._agentDraft = agentDraft
    }

    companion object {
        /** Highest pitch-carousel slide count (0-based indices 0..2). */
        const val agentPitchSlideCount: Int = 3

        // iOS ISO8601DateFormatter() default: internet date-time, UTC, no fractional seconds.
        private val ISO_FORMATTER =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).withZone(ZoneOffset.UTC)

        private fun isoNow(): String = ISO_FORMATTER.format(Instant.now())

        // encodeDefaults=true so nested params (all-default JSONB) serialise in
        // full; inherits explicitNulls=false so optional fields still omit nulls.
        private val SYNC_JSON: Json = Json(WagerproofJson) { encodeDefaults = true }
    }
}

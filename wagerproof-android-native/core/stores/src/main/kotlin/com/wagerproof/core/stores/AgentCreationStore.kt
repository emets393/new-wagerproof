package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.Agent
import com.wagerproof.core.models.AgentArchetype
import com.wagerproof.core.models.AgentCustomInsights
import com.wagerproof.core.models.AgentPersonalityParams
import com.wagerproof.core.models.AgentSport
import com.wagerproof.core.services.AgentService
import com.wagerproof.core.services.CreateAgentInput
import com.wagerproof.core.services.PresetArchetypeRow
import com.wagerproof.core.services.PresetArchetypeService
import com.wagerproof.core.services.applying
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel

/**
 * `AgentCreationStore` is the source of truth for the 6-step agent creation
 * wizard. Ports the `CreateAgentFormState` machinery from
 * `wagerproof-mobile/app/(drawer)/(tabs)/agents/create.tsx` (formState +
 * helpers) into a single observable.
 *
 * State model:
 *   - `draft` holds the in-progress agent — every field maps to the RN
 *     `CreateAgentFormState` interface (`types/agent.ts:429-449`).
 *   - `step` is the current wizard page (0..5).
 *   - `archetypeRows` is the cached preset list — loaded once when the wizard
 *     opens, mirroring RN's `usePresetArchetypes` query (30-min stale).
 *   - `submitState` tracks the create-agent network call.
 *
 * FIDELITY: Validation matches `validateScreen()` in RN line-for-line — the
 * view consults `canProceed(from:)` before allowing Next.
 */
@Stable
class AgentCreationStore {

    sealed interface SubmitState {
        data object Idle : SubmitState
        data object Submitting : SubmitState
        data class Succeeded(val agent: Agent) : SubmitState
        data class Failed(val message: String) : SubmitState
    }

    sealed interface ArchetypesLoadState {
        data object Idle : ArchetypesLoadState
        data object Loading : ArchetypesLoadState
        data object Loaded : ArchetypesLoadState
        data class Failed(val message: String) : ArchetypesLoadState
    }

    /**
     * Mutable draft snapshot. The wizard mutates fields via the store's setter
     * helpers (copy-based) so Compose recomposes on change.
     */
    data class Draft(
        val preferredSports: List<AgentSport> = emptyList(),
        val archetype: AgentArchetype? = null,
        val name: String = "",
        // Defaults match RN INITIAL_FORM_STATE (types/agent.ts:451-462).
        val avatarEmoji: String = "🤖", // 🤖
        val avatarColor: String = "gradient:#6366f1,#ec4899",
        /**
         * Chosen pixel character (avatar_0…avatar_7). null = not chosen yet;
         * hosts seed it once so the preview doesn't reshuffle per keystroke
         * (create_agent has no sprite field — persisted via update_agent right
         * after creation).
         */
        val spriteIndex: Int? = null,
        val personalityParams: AgentPersonalityParams = AgentPersonalityParams.default,
        val customInsights: AgentCustomInsights = AgentCustomInsights.empty,
        val autoGenerate: Boolean = true,
        val autoGenerateTime: String = "09:00",
        val autoGenerateTimezone: String = "America/New_York",
    )

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    // MARK: - State

    var draft by mutableStateOf(Draft())
    var step by mutableStateOf(0)
    var archetypeRows by mutableStateOf<List<PresetArchetypeRow>>(emptyList())
    var archetypesLoadState by mutableStateOf<ArchetypesLoadState>(ArchetypesLoadState.Idle)
    var submitState by mutableStateOf<SubmitState>(SubmitState.Idle)

    /**
     * Names of agents the user already owns — set by the view after
     * `AgentsStore.refresh()`. Used for duplicate-name validation.
     */
    var existingAgentNames by mutableStateOf<List<String>>(emptyList())

    // MARK: - Archetype loading

    /**
     * Fetch the preset archetypes once. Idempotent — subsequent calls no-op if
     * already loaded. RN uses React Query's 30-min staleTime for equivalent caching.
     */
    suspend fun loadArchetypesIfNeeded() {
        if (archetypesLoadState is ArchetypesLoadState.Loaded) return
        if (archetypesLoadState is ArchetypesLoadState.Loading) return
        archetypesLoadState = ArchetypesLoadState.Loading
        try {
            archetypeRows = PresetArchetypeService.fetchAll()
            archetypesLoadState = ArchetypesLoadState.Loaded
        } catch (t: Throwable) {
            archetypesLoadState = ArchetypesLoadState.Failed(message(t))
        }
    }

    // MARK: - Path selection & toggles

    /**
     * Apply an archetype preset: auto-fills sports, archetype id, and merges
     * the partial personality params on top of defaults. Mirrors RN's
     * `applyArchetypePreset()`.
     */
    fun applyArchetype(row: PresetArchetypeRow) {
        // Row.id may not match a known enum case (server can ship new ids) —
        // leave archetype null (fully-custom) rather than crashing on decode.
        val archetype = AgentArchetype.entries.firstOrNull { it.raw == row.id }
        draft = draft.copy(
            archetype = archetype,
            preferredSports = row.recommendedSports,
            personalityParams = AgentPersonalityParams.applying(row.personalityParams),
            customInsights = row.customInsights,
        )
    }

    /**
     * Reset to the "fully-custom" path: clears the archetype but keeps the
     * user's chosen sports. Mirrors RN's `handleSelectPath('scratch')` flow.
     */
    fun clearArchetype() {
        draft = draft.copy(
            archetype = null,
            personalityParams = AgentPersonalityParams.default,
            customInsights = AgentCustomInsights.empty,
        )
    }

    /**
     * Toggle a sport selection. Plain multi-select — MLB used to be exclusive
     * (single-sport Statcast payload) but the pipeline now supports mixing it.
     */
    fun toggleSport(sport: AgentSport) {
        val current = draft.preferredSports
        draft = if (current.contains(sport)) {
            draft.copy(preferredSports = current.filter { it != sport })
        } else {
            draft.copy(preferredSports = current + sport)
        }
    }

    // MARK: - Validation

    /** Whether the user can advance past the given step. Mirrors `validateScreen()`. */
    fun canProceed(from: Int): Boolean = when (from) {
        0 -> draft.preferredSports.isNotEmpty()
        1 -> {
            val trimmed = draft.name.trim()
            when {
                trimmed.isEmpty() || trimmed.length > 50 -> false
                existingAgentNames.any { it.lowercase() == trimmed.lowercase() } -> false
                draft.avatarEmoji.isEmpty() -> false
                draft.avatarColor.isEmpty() -> false
                else -> true
            }
        }
        2, 3, 4, 5 -> true
        else -> false
    }

    /** Surface-friendly explanation of why a step is blocked. Mirrors `getValidationError()`. */
    fun validationError(stepIndex: Int): String? = when (stepIndex) {
        0 -> if (draft.preferredSports.isEmpty()) "Please select at least one sport" else null
        1 -> {
            val trimmed = draft.name.trim()
            when {
                trimmed.isEmpty() -> "Please enter a name for your agent"
                trimmed.length > 50 -> "Name must be 50 characters or less"
                existingAgentNames.any { it.lowercase() == trimmed.lowercase() } ->
                    "You already have an agent named \"$trimmed\". Please choose a different name."
                draft.avatarEmoji.isEmpty() -> "Please select an emoji"
                else -> null
            }
        }
        else -> null
    }

    // MARK: - Navigation

    fun advance() {
        if (step < totalSteps - 1) step += 1
    }

    fun back() {
        if (step > 0) step -= 1
    }

    // MARK: - Submission

    /**
     * Submit the draft via the edge function. Sets `submitState` to either
     * `.succeeded(agent)` or `.failed(reason)`.
     */
    suspend fun submit(autoModeForcedOff: Boolean): Agent? {
        val trimmedName = draft.name.trim()
        // Honor the "Pro auto-slot full" gate — flip auto_generate off before
        // serializing so the server sees the user's effective intent (manual).
        val shouldStartAuto = draft.autoGenerate && !autoModeForcedOff
        val input = CreateAgentInput(
            name = trimmedName,
            avatarEmoji = draft.avatarEmoji,
            avatarColor = draft.avatarColor,
            preferredSports = draft.preferredSports,
            archetype = draft.archetype,
            personalityParams = draft.personalityParams,
            customInsights = draft.customInsights,
            autoGenerate = shouldStartAuto,
            autoGenerateTime = draft.autoGenerateTime,
            autoGenerateTimezone = draft.autoGenerateTimezone,
        )
        submitState = SubmitState.Submitting
        return try {
            val agent = AgentService.create(input)
            submitState = SubmitState.Succeeded(agent)
            agent
        } catch (t: Throwable) {
            submitState = SubmitState.Failed(message(t))
            null
        }
    }

    // MARK: - Lifecycle teardown

    fun close() = scope.cancel()

    companion object {
        const val totalSteps = 6

        private fun message(t: Throwable): String =
            t.message?.takeIf { it.isNotEmpty() } ?: "Unknown error"
    }
}

package com.wagerproof.core.stores

import android.util.Log
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.AgentBetItem
import com.wagerproof.core.models.AgentGenerationRunSummary
import com.wagerproof.core.models.AgentParlay
import com.wagerproof.core.models.AgentPick
import com.wagerproof.core.models.AgentDetailSnapshot
import com.wagerproof.core.models.AgentWithPerformance
import com.wagerproof.core.services.AgentAuthorizedActionsService
import com.wagerproof.core.services.AgentPicksService
import com.wagerproof.core.services.AgentService
import com.wagerproof.core.services.BuildFlags
import com.wagerproof.core.services.NotificationService
import com.wagerproof.core.services.TriggerRunStatusService
import com.wagerproof.core.services.TriggerV3RunStatus
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.cancel
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.time.LocalDate
import java.util.Locale

/**
 * Source of truth for a single agent's detail screen (owner *or* public view).
 * Ports the React-Query trio in `hooks/useAgentPicks.ts`
 * (`useAgentDetailSnapshot`, `useAgentPicks`, `useGeneratePicks`) into one
 * observable store.
 *
 * The store fetches:
 *   - `snapshot` (agent + perf + today's picks + today's run + can_view +
 *     is_following) via `agent-authorized-action-v1 / detail_snapshot`.
 *   - `pickHistory` — recent preview for the history list.
 *   - `performancePicks` — full history for performance charts.
 *
 * Generation runs a two-nested-poll loop (trigger-run status → detail snapshot);
 * the bounded polls live inside the caller's coroutine so cancellation flows
 * from whatever scope launched `generatePicks`. See docs/inventory/03_stores.md §8.2.
 */
@Stable
class AgentDetailStore(agentId: String) {

    enum class PickFilter(val raw: String, val label: String) {
        All("all", "All"),
        Won("won", "Won"),
        Lost("lost", "Lost"),
    }

    /** Result of watching a Trigger.dev run through to a terminal status. */
    private sealed interface TriggerPollOutcome {
        data object Succeeded : TriggerPollOutcome
        data class Failed(val message: String) : TriggerPollOutcome
        /** Never observed a terminal Trigger.dev status within budget. */
        data object TimedOutWaiting : TriggerPollOutcome
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    // MARK: - Identity / lifecycle
    var agentId by mutableStateOf(agentId); private set

    // MARK: - Snapshot state
    var snapshot by mutableStateOf<AgentDetailSnapshot?>(null); private set
    var snapshotLoadState by mutableStateOf<LoadState>(LoadState.Idle); private set

    // MARK: - History state
    var pickHistory by mutableStateOf<List<AgentPick>>(emptyList()); private set
    var parlayHistory by mutableStateOf<List<AgentParlay>>(emptyList()); private set
    var historyLoadState by mutableStateOf<LoadState>(LoadState.Idle); private set
    var performancePicks by mutableStateOf<List<AgentPick>>(emptyList()); private set
    var performanceParlays by mutableStateOf<List<AgentParlay>>(emptyList()); private set
    var performanceLoadState by mutableStateOf<LoadState>(LoadState.Idle); private set

    // MARK: - Generation state
    var isGenerating by mutableStateOf(false); private set
    var lastGenerationError by mutableStateOf<String?>(null); private set
    var liveRunState by mutableStateOf<TriggerV3RunStatus?>(null); private set

    // MARK: - View-driven filter (history)
    var pickFilter by mutableStateOf(PickFilter.All)

    // MARK: - Derived

    /**
     * The Agent + Performance pair, surfaced as `AgentWithPerformance` so
     * view code can reuse the existing helpers (`AgentSparkline`, etc.).
     */
    val agentWithPerformance: AgentWithPerformance?
        get() {
            val agent = snapshot?.agent ?: return null
            return AgentWithPerformance(agent = agent, performance = snapshot?.performance)
        }

    val todaysPicks: List<AgentPick>
        get() {
            val fromSnapshot = snapshot?.todaysPicks ?: emptyList()
            if (fromSnapshot.isNotEmpty()) return fromSnapshot
            // Snapshot only includes today's picks when the server grants Pro
            // entitlement. Owners on the free tier still load history via direct
            // reads — surface today's slice from that cache when available.
            val todayStr = localDateString()
            return performancePicks.filter { it.gameDate == todayStr }
        }

    /**
     * Today's parlay tickets — same snapshot-first / direct-read-fallback
     * shape as `todaysPicks`.
     */
    val todaysParlays: List<AgentParlay>
        get() {
            val fromSnapshot = snapshot?.todaysParlays ?: emptyList()
            if (fromSnapshot.isNotEmpty()) return fromSnapshot
            val todayStr = localDateString()
            return performanceParlays.filter { it.displayDate == todayStr }
        }

    /**
     * Today's picks + parlays interleaved (newest first) — feeds the unified
     * Today's Picks rail.
     */
    val todaysBetItems: List<AgentBetItem>
        get() {
            val items = todaysPicks.map { AgentBetItem.Pick(it) } +
                todaysParlays.map { AgentBetItem.Parlay(it) }
            return items.sortedByDescending { it.createdAt }
        }

    val todaysGenerationRun: AgentGenerationRunSummary?
        get() = snapshot?.todaysGenerationRun

    /**
     * A run that's live RIGHT NOW (queued/processing, per the snapshot).
     * Non-null ⇒ the UI should show the generating state and resume polling
     * rather than offering a fresh trigger.
     */
    val activeGenerationRun: AgentGenerationRunSummary?
        get() = snapshot?.activeGenerationRun

    /**
     * Server-reported visibility flag. Kept here for callers that want raw
     * access — the UI gates on the local entitlements store.
     */
    val serverCanViewAgentPicks: Boolean
        get() = snapshot?.canViewAgentPicks ?: false

    val isFollowingFromSnapshot: Boolean?
        get() = snapshot?.isFollowing

    /**
     * Filtered slice of `pickHistory` matching `pickFilter`. Driven entirely
     * from local state so flipping filters never re-hits the network.
     */
    val filteredPickHistory: List<AgentPick>
        get() = when (pickFilter) {
            PickFilter.All -> pickHistory
            PickFilter.Won -> pickHistory.filter { it.result == AgentPick.PickResultStatus.WON }
            PickFilter.Lost -> pickHistory.filter { it.result == AgentPick.PickResultStatus.LOST }
        }

    /**
     * The COMPLETE graded pick history (prior-date won/lost/push picks),
     * newest first. Falls back to the loaded preview when performance picks
     * haven't arrived yet, so the folder is never empty while history exists.
     */
    val fullPickHistory: List<AgentPick>
        get() {
            val todayStr = localDateString()
            val graded = performancePicks.filter { isPickHistoryEligible(it, todayStr) }
            val base = if (graded.isEmpty()) pickHistory else graded
            return base.sortedWith(
                compareByDescending<AgentPick> { it.gameDate }.thenByDescending { it.createdAt },
            )
        }

    /**
     * The graded pick history interleaved with graded parlay tickets, newest
     * first — backs the unified Pick History folder/rolodex.
     */
    val fullBetHistory: List<AgentBetItem>
        get() {
            val todayStr = localDateString()
            val gradedParlays = (if (performanceParlays.isEmpty()) parlayHistory else performanceParlays)
                .filter { isParlayHistoryEligible(it, todayStr) }
            val items = fullPickHistory.map { AgentBetItem.Pick(it) } +
                gradedParlays.map { AgentBetItem.Parlay(it) }
            return items.sortedWith(
                compareByDescending<AgentBetItem> { it.gameDate }.thenByDescending { it.createdAt },
            )
        }

    /** Mirrors RN's `regensRemaining` derivation: 3-per-day, reset at midnight. */
    fun regenerationsRemaining(maxDaily: Int = 3): Int {
        val agent = snapshot?.agent ?: return maxDaily
        val todayStr = localDateString()
        // Reset if the stored date doesn't match today.
        if (agent.lastGenerationDate != todayStr) return maxDaily
        return maxOf(0, maxDaily - agent.dailyGenerationCount)
    }

    // MARK: - Loaders

    /** Refresh the snapshot. Always re-runs; the view drives debouncing. */
    suspend fun refreshSnapshot() {
        snapshotLoadState = LoadState.Loading
        try {
            snapshot = AgentPicksService.fetchDetailSnapshot(agentId = agentId)
            snapshotLoadState = LoadState.Loaded
        } catch (t: Throwable) {
            snapshotLoadState = LoadState.Failed(message(t))
        }
    }

    /**
     * Load the recent pick-history preview plus the parlay preview. Both
     * fetches run concurrently; a parlay failure never blanks the pick
     * history (parlays are additive).
     */
    suspend fun loadHistory(isOwner: Boolean = false) {
        historyLoadState = LoadState.Loading
        try {
            coroutineScope {
                val parlaysDeferred = async {
                    runCatching {
                        if (isOwner) loadParlayHistoryPreviewPreferringDirectRead()
                        else loadParlayHistoryPreviewPreferringAuthorizedPage()
                    }.getOrNull()
                }
                val preview = if (isOwner) loadHistoryPreviewPreferringDirectRead()
                else loadHistoryPreviewPreferringAuthorizedPage()
                parlaysDeferred.await()?.let { parlayHistory = it }
                pickHistory = preview
            }
            historyLoadState = LoadState.Loaded
        } catch (t: Throwable) {
            historyLoadState = LoadState.Failed(message(t))
        }
    }

    /** Load the full pick + parlay sets used by performance charts. */
    suspend fun loadPerformancePicks(isOwner: Boolean = false) {
        performanceLoadState = LoadState.Loading
        try {
            coroutineScope {
                val parlaysDeferred = async {
                    runCatching {
                        if (isOwner) loadAllParlaysPreferringDirectRead()
                        else loadAllParlaysPreferringAuthorizedPage()
                    }.getOrNull()
                }
                val allPicks = if (isOwner) loadAllPicksPreferringDirectRead()
                else loadAllPicksPreferringAuthorizedPage()
                parlaysDeferred.await()?.let { performanceParlays = it }
                performancePicks = allPicks
            }
            performanceLoadState = LoadState.Loaded
        } catch (t: Throwable) {
            performanceLoadState = LoadState.Failed(message(t))
        }
    }

    private suspend fun loadHistoryPreviewPreferringDirectRead(): List<AgentPick> {
        val limit = pickHistoryPreviewLimit
        val direct = AgentPicksService.fetchGradedPickHistory(agentId = agentId, limit = limit)
        if (direct.isNotEmpty()) return direct
        return loadHistoryPage(limit)
    }

    private suspend fun loadHistoryPreviewPreferringAuthorizedPage(): List<AgentPick> {
        val limit = pickHistoryPreviewLimit
        val paged = loadHistoryPage(limit)
        if (paged.isNotEmpty()) return paged
        return AgentPicksService.fetchGradedPickHistory(agentId = agentId, limit = limit)
    }

    private suspend fun loadAllPicksPreferringDirectRead(): List<AgentPick> {
        val direct = AgentPicksService.fetchPicks(agentId = agentId)
        if (direct.isNotEmpty()) return direct
        return loadAllPicksViaAuthorizedPage()
    }

    private suspend fun loadAllPicksPreferringAuthorizedPage(): List<AgentPick> {
        val paged = loadAllPicksViaAuthorizedPage()
        if (paged.isNotEmpty()) return paged
        return AgentPicksService.fetchPicks(agentId = agentId)
    }

    private suspend fun loadHistoryPage(limit: Int): List<AgentPick> {
        val page = AgentPicksService.fetchPicksPage(
            agentId = agentId,
            filter = "all",
            pageSize = 50,
            cursor = null,
            includeOverlap = false,
        )
        return filterPickHistoryPreview(page.picks, limit)
    }

    private suspend fun loadAllPicksViaAuthorizedPage(): List<AgentPick> {
        val allPicks = mutableListOf<AgentPick>()
        var cursor: String? = null
        while (true) {
            val page = AgentPicksService.fetchPicksPage(
                agentId = agentId,
                filter = "all",
                pageSize = 50,
                cursor = cursor,
                includeOverlap = false,
            )
            allPicks.addAll(page.picks)
            val next = page.nextCursor
            if (!page.hasMore || next.isNullOrEmpty()) break
            cursor = next
        }
        return allPicks
    }

    // MARK: - Parlay loaders (same dual-path shape as the pick loaders)

    private suspend fun loadParlayHistoryPreviewPreferringDirectRead(): List<AgentParlay> {
        val limit = pickHistoryPreviewLimit
        val direct = AgentPicksService.fetchGradedParlayHistory(agentId = agentId, limit = limit)
        if (direct.isNotEmpty()) return direct
        return loadParlayHistoryPage(limit)
    }

    private suspend fun loadParlayHistoryPreviewPreferringAuthorizedPage(): List<AgentParlay> {
        val limit = pickHistoryPreviewLimit
        val paged = loadParlayHistoryPage(limit)
        if (paged.isNotEmpty()) return paged
        return AgentPicksService.fetchGradedParlayHistory(agentId = agentId, limit = limit)
    }

    private suspend fun loadAllParlaysPreferringDirectRead(): List<AgentParlay> {
        val direct = AgentPicksService.fetchParlays(agentId = agentId)
        if (direct.isNotEmpty()) return direct
        return loadParlaysViaAuthorizedPage()
    }

    private suspend fun loadAllParlaysPreferringAuthorizedPage(): List<AgentParlay> {
        val paged = loadParlaysViaAuthorizedPage()
        if (paged.isNotEmpty()) return paged
        return AgentPicksService.fetchParlays(agentId = agentId)
    }

    private suspend fun loadParlayHistoryPage(limit: Int): List<AgentParlay> {
        val todayStr = localDateString()
        return loadParlaysViaAuthorizedPage()
            .filter { isParlayHistoryEligible(it, todayStr) }
            .take(limit)
    }

    /**
     * The picks-page RPC carries parlays on the FIRST page only (tickets are
     * few — they don't join the pick cursor), so one uncursored fetch is the
     * complete set.
     */
    private suspend fun loadParlaysViaAuthorizedPage(): List<AgentParlay> {
        val page = AgentPicksService.fetchPicksPage(
            agentId = agentId,
            filter = "all",
            pageSize = 50,
            cursor = null,
            includeOverlap = false,
        )
        return page.parlays
    }

    // MARK: - Generation

    /**
     * Trigger a fresh generation run (or resume an in-flight one). Sets
     * `isGenerating` while the run executes; on success the snapshot is
     * refreshed so today's picks appear. If the snapshot reports a run in
     * flight, ride the EXISTING run to completion instead of racing a new one.
     */
    suspend fun resumeActiveGenerationIfNeeded() {
        if (isGenerating) return
        val active = activeGenerationRun ?: return
        val runId = active.triggerRunId ?: return
        isGenerating = true
        lastGenerationError = null
        liveRunState = null
        try {
            // priorRunId: the last SUCCEEDED run — completion is detected by a
            // new succeeded id appearing, exactly like a fresh trigger.
            val priorRunId = todaysGenerationRun?.id
            val outcome = pollTriggerRunUntilComplete(runId = runId, priorRunId = priorRunId)
            when (outcome) {
                is TriggerPollOutcome.Succeeded -> pollUntilGenerationCompletes(priorRunId)
                is TriggerPollOutcome.Failed -> lastGenerationError = outcome.message
                is TriggerPollOutcome.TimedOutWaiting -> {
                    runCatching { AgentPicksService.fetchDetailSnapshot(agentId = agentId) }
                        .getOrNull()?.let { snapshot = it }
                }
            }
            loadHistory(isOwner = true)
            loadPerformancePicks(isOwner = true)
            when (outcome) {
                is TriggerPollOutcome.Succeeded -> notifyGenerationFinished(succeeded = true)
                is TriggerPollOutcome.Failed -> notifyGenerationFinished(succeeded = false, note = outcome.message)
                is TriggerPollOutcome.TimedOutWaiting -> Unit // uncertain — don't claim an outcome
            }
        } finally {
            isGenerating = false
            liveRunState = null
        }
    }

    /**
     * Local "run finished" banner — only shows when the app is backgrounded
     * (the service gates on application state), so the on-screen live card
     * never doubles up with a notification.
     */
    private fun notifyGenerationFinished(succeeded: Boolean, note: String? = null) {
        val name = snapshot?.agent?.name ?: "Your agent"
        NotificationService.postGenerationFinishedNotification(
            agentId = agentId,
            agentName = name,
            picksGenerated = todaysGenerationRun?.picksGenerated ?: todaysPicks.size,
            parlaysGenerated = todaysParlays.size,
            succeeded = succeeded,
            note = note ?: todaysGenerationRun?.slateNote,
        )
    }

    suspend fun generatePicks(): Boolean {
        if (isGenerating) return false
        // A run is already live (e.g. re-entered the page mid-run) — join it
        // rather than triggering a duplicate. The server coalesces too.
        if (activeGenerationRun?.triggerRunId != null) {
            resumeActiveGenerationIfNeeded()
            return lastGenerationError == null
        }
        isGenerating = true
        lastGenerationError = null
        liveRunState = null
        try {
            // This client is V3-only: generation always runs on the Trigger.dev
            // agentic engine. `model`/`dryRun` are DEBUG tuning knobs.
            val v3 = AgentV3SettingsStore()
            // Generation runs ASYNC on the server (enqueue → Trigger.dev queue →
            // worker). Capture the current run id so we can poll until a NEW
            // completed run lands — otherwise the spinner clears in ~1s.
            val priorRunId = todaysGenerationRun?.id
            val trigger = AgentPicksService.requestTriggerV3Generation(
                agentId = agentId,
                dryRun = v3.dryRun,
                modelName = v3.model,
            )
            if (BuildFlags.isDebugBuild) {
                Log.d("V3Gen", "triggered runId=${trigger.runId ?: "nil"}")
            }
            val runId = trigger.runId
            val outcome = if (runId != null) {
                pollTriggerRunUntilComplete(runId = runId, priorRunId = priorRunId)
            } else {
                TriggerPollOutcome.Succeeded
            }
            return when (outcome) {
                is TriggerPollOutcome.Succeeded -> {
                    // The ledger only surfaces `status='succeeded'` runs, so this
                    // picks up the freshly-written picks/no-picks note.
                    pollUntilGenerationCompletes(priorRunId)
                    loadHistory(isOwner = true)
                    loadPerformancePicks(isOwner = true)
                    notifyGenerationFinished(succeeded = true)
                    true
                }
                is TriggerPollOutcome.Failed -> {
                    // A failed run's ledger row never flips to 'succeeded', so
                    // pollUntilGenerationCompletes would burn its full budget —
                    // surface the failure immediately instead.
                    lastGenerationError = outcome.message
                    loadHistory(isOwner = true)
                    loadPerformancePicks(isOwner = true)
                    notifyGenerationFinished(succeeded = false, note = outcome.message)
                    false
                }
                is TriggerPollOutcome.TimedOutWaiting -> {
                    // Never saw a terminal Trigger.dev status within budget. Do
                    // one quiet snapshot check in case it finished right at the
                    // edge, then give up rather than blocking on a second long poll.
                    runCatching { AgentPicksService.fetchDetailSnapshot(agentId = agentId) }
                        .getOrNull()?.let { snapshot = it }
                    loadHistory(isOwner = true)
                    loadPerformancePicks(isOwner = true)
                    if (todaysGenerationRun?.id == priorRunId) {
                        lastGenerationError =
                            "This is taking longer than usual — check back in a few minutes for your picks."
                        false
                    } else {
                        true
                    }
                }
            }
        } catch (t: Throwable) {
            lastGenerationError = message(t)
            return false
        } finally {
            isGenerating = false
            liveRunState = null
        }
    }

    /**
     * Poll the run's live status + metadata until it reaches a terminal status
     * or the budget runs out. Budget: 440 attempts × 1.5s (~11 min; task
     * maxDuration is 600s). Cancellation flows from the caller's coroutine.
     */
    private suspend fun pollTriggerRunUntilComplete(
        runId: String,
        priorRunId: String?,
    ): TriggerPollOutcome {
        val maxAttempts = 440
        repeat(maxAttempts) { attempt ->
            if (currentCoroutineContext()[Job]?.isActive == false) return TriggerPollOutcome.TimedOutWaiting
            try {
                val state = TriggerRunStatusService.fetch(runId = runId)
                liveRunState = state
                if (BuildFlags.isDebugBuild) {
                    val m = state.metadata
                    Log.d(
                        "V3Poll",
                        "#$attempt status=${state.status} turn=${m.turn ?: -1}/${m.maxTurns ?: -1} " +
                            "tools=${m.toolCalls ?: -1} picks=${m.picksAccepted ?: -1}",
                    )
                }
                if (state.isTerminal) {
                    return if (state.isSuccessful) {
                        TriggerPollOutcome.Succeeded
                    } else {
                        TriggerPollOutcome.Failed(
                            state.metadata.note ?: "Generation failed (${state.status}). Please try again.",
                        )
                    }
                }
            } catch (t: Throwable) {
                // Surface the failure in debug (the poll used to swallow it,
                // hiding that the direct-to-Trigger fetch was 401'ing).
                if (BuildFlags.isDebugBuild) Log.d("V3Poll", "#$attempt fetch FAILED: $t")
            }
            delay(1_500)
        }
        return TriggerPollOutcome.TimedOutWaiting
    }

    /**
     * Poll the detail snapshot until a NEW succeeded run appears (its id differs
     * from `priorRunId`) or we hit the cap (60 attempts × 4s ~4 min). The
     * snapshot RPC only surfaces `status='succeeded'` runs, so a changed id ==
     * "this generation finished". Uses a silent fetch so `snapshotLoadState`
     * doesn't flicker under the spinner.
     */
    private suspend fun pollUntilGenerationCompletes(priorRunId: String?) {
        val maxAttempts = 60
        repeat(maxAttempts) {
            delay(4_000)
            val snap = runCatching { AgentPicksService.fetchDetailSnapshot(agentId = agentId) }
                .getOrNull() ?: return@repeat
            snapshot = snap
            val cur = snap.todaysGenerationRun?.id
            if (cur != null && cur != priorRunId) return
        }
    }

    // MARK: - Mutations

    /** Toggle autopilot via the granular service. Optimistic — refresh on failure restores truth. */
    suspend fun setAutoGenerate(value: Boolean): Boolean {
        return try {
            AgentService.setAutoGenerate(agentId = agentId, autoGenerate = value)
            refreshSnapshot()
            true
        } catch (t: Throwable) {
            false
        }
    }

    /**
     * Persist just the autopilot schedule (partial `update_agent`). Used by the
     * AutoPilot bottom sheet so the user can retime autopilot without opening
     * full Settings. Refreshes the snapshot on success.
     */
    suspend fun setAutoGenerateTime(time: String, timezone: String): Boolean =
        saveSettings(
            buildJsonObject {
                put("auto_generate_time", time)
                put("auto_generate_timezone", timezone)
            },
        )

    /**
     * Full-form save (called from AgentSettingsView). Routes through the
     * `update_agent` action. On success, refreshes the snapshot.
     */
    suspend fun saveSettings(payload: JsonObject): Boolean {
        return try {
            AgentAuthorizedActionsService.updateAgent(agentId = agentId, payload = payload)
            refreshSnapshot()
            true
        } catch (t: Throwable) {
            lastGenerationError = message(t)
            false
        }
    }

    /** Delete the agent. Mirrors RN's destroy path. View navigates back. */
    suspend fun delete(): Boolean {
        return try {
            AgentService.delete(agentId = agentId)
            true
        } catch (t: Throwable) {
            lastGenerationError = message(t)
            false
        }
    }

    // MARK: - Lifecycle teardown

    fun close() = scope.cancel()

    companion object {
        const val pickHistoryPreviewLimit = 7

        /** Graded picks from prior game dates only — excludes today and pending rows. */
        fun isPickHistoryEligible(pick: AgentPick, todayStr: String): Boolean {
            if (pick.gameDate >= todayStr) return false
            return when (pick.result) {
                AgentPick.PickResultStatus.WON,
                AgentPick.PickResultStatus.LOST,
                AgentPick.PickResultStatus.PUSH -> true
                AgentPick.PickResultStatus.PENDING -> false
            }
        }

        /** Parlay mirror of [isPickHistoryEligible], keyed on the ticket's display date + rolled-up result. */
        fun isParlayHistoryEligible(parlay: AgentParlay, todayStr: String): Boolean {
            val date = parlay.displayDate
            if (date.isEmpty() || date >= todayStr) return false
            return when (parlay.result) {
                AgentPick.PickResultStatus.WON,
                AgentPick.PickResultStatus.LOST,
                AgentPick.PickResultStatus.PUSH -> true
                AgentPick.PickResultStatus.PENDING -> false
            }
        }

        fun filterPickHistoryPreview(picks: List<AgentPick>, limit: Int): List<AgentPick> {
            val todayStr = localDateString()
            return picks.filter { isPickHistoryEligible(it, todayStr) }.take(limit)
        }

        private fun message(t: Throwable): String =
            t.message?.takeIf { it.isNotEmpty() } ?: "Unknown error"

        // `%04d-%02d-%02d` from the LOCAL calendar day (Swift gregorian components).
        private fun localDateString(): String {
            val now = LocalDate.now()
            return String.format(Locale.US, "%04d-%02d-%02d", now.year, now.monthValue, now.dayOfMonth)
        }
    }
}

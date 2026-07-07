package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.WagerBotContentBlock
import com.wagerproof.core.models.WagerBotMessage
import com.wagerproof.core.models.WagerBotStreamEvent
import com.wagerproof.core.models.WagerBotThreadSummary
import com.wagerproof.core.models.WagerBotToolStatus
import com.wagerproof.core.services.WagerBotChatService
import com.wagerproof.core.services.WagerBotThreadService
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.util.UUID

/**
 * Port of iOS `WagerBotChatStore.swift` (doc §9.1). In-memory chat state for
 * the WagerBot sheet — current thread id + title, message list, streaming
 * state, history list, last error.
 *
 * Streaming flow:
 *   1. [send] appends a user message + an empty assistant placeholder, flips
 *      [isStreaming] = true, and launches a store-scoped Job that collects the
 *      SSE [kotlinx.coroutines.flow.Flow] of [WagerBotStreamEvent] from
 *      [WagerBotChatService].
 *   2. Each event mutates the in-flight assistant message via [apply] (append
 *      text deltas to the current text block, push tool_use blocks on
 *      tool_start, flip status on tool_end, etc.). Mirrors the RN reducer in
 *      `wagerBotChatService.ts`.
 *   3. When the stream finishes the Job flips streaming off and refreshes the
 *      history list so the drawer picks up the new (or renamed) thread.
 *
 * History persistence is server-side — the edge function writes both user and
 * assistant messages to `chat_messages` itself, so the store never inserts
 * directly. On thread switch we hydrate via [WagerBotThreadService.loadMessages].
 */
@Stable
class WagerBotChatStore(
    private val service: WagerBotChatService = WagerBotChatService.shared,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    var messages by mutableStateOf<List<WagerBotMessage>>(emptyList()); private set
    var isStreaming by mutableStateOf(false); private set
    var threadId by mutableStateOf<String?>(null); private set
    var threadTitle by mutableStateOf<String?>(null); private set
    var lastError by mutableStateOf<String?>(null); private set

    var threads by mutableStateOf<List<WagerBotThreadSummary>>(emptyList()); private set
    var historyLoadState by mutableStateOf<HistoryLoadState>(HistoryLoadState.Idle); private set

    var draft by mutableStateOf("")

    var boundUserId by mutableStateOf<String?>(null); private set

    private var streamJob: Job? = null

    // Declared but unused seam (see [WagerBotAuthProvider]) — the service walks
    // Supabase auth itself. Kept so future refresh-on-401 variants can plug in.
    @Suppress("unused")
    private var authProvider: WagerBotAuthProvider? = null

    /**
     * Nested load-state for the history drawer. Mirrors Swift's nested
     * `HistoryLoadState` (idle/loading/loaded/failed) rather than the shared
     * [LoadState] so the surface stays 1:1 with iOS.
     */
    sealed interface HistoryLoadState {
        data object Idle : HistoryLoadState
        data object Loading : HistoryLoadState
        data object Loaded : HistoryLoadState
        data class Failed(val message: String) : HistoryLoadState
    }

    /**
     * The store can't reach into AuthStore without a circular dependency
     * (Stores → Services, Services don't see Stores). The owning view passes the
     * current Supabase user id once at first appear via this hook.
     */
    fun bind(userId: String?) {
        boundUserId = userId
    }

    /**
     * Are we still waiting for the first assistant block to arrive? Drives the
     * thinking indicator that replaces the empty bubble body until the first
     * text / tool / widget lands.
     */
    val isWaitingForFirstBlock: Boolean
        get() {
            if (!isStreaming) return false
            val last = messages.lastOrNull() ?: return false
            if (last.role != WagerBotMessage.Role.ASSISTANT) return false
            return last.blocks.isEmpty()
        }

    // MARK: - Send / cancel

    /**
     * Submit a new user message and start streaming the response. Safe to call
     * while a previous stream is running — the active Job is cancelled first.
     *
     * Note: not `suspend` — mirrors Swift's fire-and-forget `send(text:)` that
     * kicks off a background Task and returns immediately (the locked SSE rule
     * launches the collection in a store-scoped Job).
     */
    fun send(text: String) {
        val trimmed = text.trim()
        if (trimmed.isEmpty()) return
        streamJob?.cancel()

        val userMsg = WagerBotMessage.user(trimmed)
        val assistantMsg = WagerBotMessage.assistantPlaceholder()
        messages = messages + userMsg + assistantMsg
        isStreaming = true
        draft = ""

        val assistantId = assistantMsg.id
        val pinnedThreadId = threadId

        streamJob = scope.launch {
            try {
                service.startRun(userMessage = trimmed, threadId = pinnedThreadId)
                    .collect { event -> apply(event, assistantId) }
            } catch (cancel: CancellationException) {
                // A newer send (or cancel()) cancelled us — bail without
                // touching isStreaming/streamJob so we don't clobber the
                // replacement stream's bookkeeping.
                throw cancel
            } catch (error: Throwable) {
                applyTransportError(error, assistantId)
            }
            isStreaming = false
            streamJob = null
            // Best-effort: refresh history so the drawer picks up the new
            // thread or the updated title without the user reopening the sheet.
            boundUserId?.let { refreshHistory(it) }
        }
    }

    fun cancel() {
        streamJob?.cancel()
        streamJob = null
        isStreaming = false
    }

    /**
     * Drop the in-memory thread and start a fresh conversation. Does NOT touch
     * the server — the existing thread stays in history.
     */
    fun newConversation() {
        cancel()
        messages = emptyList()
        threadId = null
        threadTitle = null
        draft = ""
        lastError = null
    }

    /** Switch to an existing thread, hydrating its persisted messages. */
    suspend fun loadThread(summary: WagerBotThreadSummary) {
        cancel()
        messages = emptyList()
        threadId = summary.id
        threadTitle = summary.title
        runCatching { WagerBotThreadService.loadMessages(threadId = summary.id) }
            .onSuccess { loaded -> messages = loaded }
            .onFailure { lastError = it.message ?: "Unknown error" }
    }

    // MARK: - History

    suspend fun refreshHistory(userId: String) {
        historyLoadState = HistoryLoadState.Loading
        runCatching { WagerBotThreadService.listThreads(userId = userId) }
            .onSuccess { rows ->
                threads = rows
                historyLoadState = HistoryLoadState.Loaded
            }
            .onFailure { historyLoadState = HistoryLoadState.Failed(it.message ?: "Unknown error") }
    }

    suspend fun deleteThread(id: String) {
        runCatching { WagerBotThreadService.deleteThread(threadId = id) }
            .onSuccess {
                threads = threads.filterNot { it.id == id }
                if (threadId == id) newConversation()
            }
            .onFailure { lastError = it.message ?: "Unknown error" }
    }

    suspend fun deleteAllThreads() {
        val userId = boundUserId ?: return
        runCatching { WagerBotThreadService.deleteAllThreads(userId = userId) }
            .onSuccess {
                threads = emptyList()
                newConversation()
            }
            .onFailure { lastError = it.message ?: "Unknown error" }
    }

    // MARK: - Event application

    /**
     * Apply one SSE event to the in-flight assistant message. Indexed by
     * message id (not position) so a parallel [loadThread] swap doesn't smash
     * the stream's target.
     */
    private fun apply(event: WagerBotStreamEvent, targetId: String) {
        val idx = messages.indexOfFirst { it.id == targetId }
        if (idx < 0) return

        when (event) {
            is WagerBotStreamEvent.Thread ->
                if (threadId == null) threadId = event.id

            is WagerBotStreamEvent.ContentDelta ->
                appendText(event.text, idx)

            is WagerBotStreamEvent.ThinkingDelta ->
                appendThinking(event.text, idx)

            is WagerBotStreamEvent.ThinkingDone ->
                // Drop the thinking block entirely once the model finishes
                // reasoning — the visible answer is in the upcoming text deltas.
                updateBlocks(idx) { blocks ->
                    blocks.filterNot { it is WagerBotContentBlock.Thinking }
                }

            is WagerBotStreamEvent.ToolStart ->
                updateBlocks(idx) { blocks ->
                    blocks + WagerBotContentBlock.ToolUse(
                        id = event.id,
                        name = event.name,
                        argumentsJson = event.argumentsJson,
                        status = WagerBotToolStatus.Running,
                    )
                }

            is WagerBotStreamEvent.ToolEnd ->
                updateBlocks(idx) { blocks ->
                    val bIdx = blocks.indexOfFirst { it is WagerBotContentBlock.ToolUse && it.id == event.id }
                    if (bIdx < 0) return@updateBlocks blocks
                    val tool = blocks[bIdx] as WagerBotContentBlock.ToolUse
                    blocks.toMutableList().also {
                        it[bIdx] = tool.copy(
                            status = WagerBotToolStatus.Done(
                                ms = event.ms,
                                ok = event.ok,
                                summary = event.summary,
                            ),
                        )
                    }
                }

            is WagerBotStreamEvent.GameCards -> {
                // Game cards are no longer rendered as a primary surface (widgets
                // from present_analysis replaced them) — keep the parse path so
                // existing threads load, but drop the streamed block.
            }

            is WagerBotStreamEvent.ChatWidgets ->
                updateBlocks(idx) { blocks ->
                    blocks + WagerBotContentBlock.ChatWidgets(
                        id = "w_${uuid()}",
                        widgets = event.widgets,
                    )
                }

            is WagerBotStreamEvent.AppComponents ->
                // V2 chat: rich tappable components (wagerbot-agent). Appended as
                // a single block; the bubble renders them downstream.
                updateBlocks(idx) { blocks ->
                    blocks + WagerBotContentBlock.AppComponents(
                        id = "ac_${uuid()}",
                        summary = event.summary,
                        components = event.components,
                    )
                }

            is WagerBotStreamEvent.FollowUps ->
                // Replace any existing follow-ups block so the final list is the
                // latest round, not an accumulation.
                updateBlocks(idx) { blocks ->
                    blocks.filterNot { it is WagerBotContentBlock.FollowUps } +
                        WagerBotContentBlock.FollowUps(id = "f_${uuid()}", questions = event.questions)
                }

            is WagerBotStreamEvent.ThreadTitled ->
                if (threadId == event.id) threadTitle = event.title

            is WagerBotStreamEvent.MessagePersisted -> Unit

            is WagerBotStreamEvent.Error -> {
                // Surface the error as a text block in the assistant bubble so the
                // user sees what went wrong instead of an empty bubble.
                updateBlocks(idx) { blocks ->
                    blocks + WagerBotContentBlock.Text(
                        id = "err_${uuid()}",
                        text = "Sorry, something went wrong (${event.code}): ${event.message}",
                    )
                }
                lastError = event.message
            }

            is WagerBotStreamEvent.Done -> Unit
        }
    }

    private fun appendText(delta: String, msgIdx: Int) {
        // Append to the last existing text block, or push a new one.
        updateBlocks(msgIdx) { blocks ->
            val bIdx = blocks.indexOfLast { it is WagerBotContentBlock.Text }
            if (bIdx >= 0) {
                val existing = blocks[bIdx] as WagerBotContentBlock.Text
                blocks.toMutableList().also {
                    it[bIdx] = existing.copy(text = existing.text + delta)
                }
            } else {
                blocks + WagerBotContentBlock.Text(id = "t_${uuid()}", text = delta)
            }
        }
    }

    private fun appendThinking(delta: String, msgIdx: Int) {
        updateBlocks(msgIdx) { blocks ->
            val bIdx = blocks.indexOfLast { it is WagerBotContentBlock.Thinking }
            if (bIdx >= 0) {
                val existing = blocks[bIdx] as WagerBotContentBlock.Thinking
                blocks.toMutableList().also {
                    it[bIdx] = existing.copy(text = existing.text + delta)
                }
            } else {
                blocks + WagerBotContentBlock.Thinking(id = "th_${uuid()}", text = delta)
            }
        }
    }

    private fun applyTransportError(error: Throwable, targetId: String) {
        val idx = messages.indexOfFirst { it.id == targetId }
        if (idx < 0) return
        // Only inject a friendly error text if the assistant hasn't already
        // streamed anything visible — otherwise a trailing error reads as noise.
        val hasVisibleContent = messages[idx].blocks.any { block ->
            block is WagerBotContentBlock.Text && block.text.isNotEmpty()
        }
        if (!hasVisibleContent) {
            updateBlocks(idx) { blocks ->
                blocks + WagerBotContentBlock.Text(
                    id = "err_${uuid()}",
                    text = "Sorry, I couldn't reach the chat service. Please try again.",
                )
            }
        }
        lastError = error.message ?: "Unknown error"
    }

    fun close() = scope.cancel()

    // MARK: - Helpers

    /**
     * Reassign [messages] with the target message's blocks transformed. Building
     * a new list (vs mutating in place) is what triggers Compose recomposition —
     * the `mutableStateOf` list reference must change.
     */
    private inline fun updateBlocks(
        idx: Int,
        transform: (List<WagerBotContentBlock>) -> List<WagerBotContentBlock>,
    ) {
        val msg = messages[idx]
        val newMsg = msg.copy(blocks = transform(msg.blocks))
        messages = messages.toMutableList().also { it[idx] = newMsg }
    }

    // Swift used `UUID().uuidString` (uppercase) for block id suffixes.
    private fun uuid(): String = UUID.randomUUID().toString().uppercase()
}

/**
 * Hook for the chat view to hand the store an auth token resolver. Not
 * currently used — the service walks Supabase auth itself — but kept so future
 * variants (refresh-on-401, programmatic token injection in tests) can plug in
 * without a public-API break.
 */
interface WagerBotAuthProvider {
    suspend fun currentAccessToken(): String?
    suspend fun currentUserId(): String?
}

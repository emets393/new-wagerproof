package com.wagerproof.core.stores

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.wagerproof.core.models.AgentChatMessage
import com.wagerproof.core.services.AgentChatService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

/**
 * Port of iOS `AgentChatStore.swift` (doc §8.4). Per-agent chat thread (NOT
 * WagerBot). Optimistic user send: append a temp message (id = "temp-{uuid}"),
 * swap for the persisted row on success, strip on failure; then request the
 * assistant reply while [isAssistantTyping] is true (non-streaming — one awaited
 * reply message).
 *
 * Created per-screen: `AgentChatStore(agentId, userId)`.
 */
@Stable
class AgentChatStore(
    agentId: String,
    userId: String? = null,
    private val service: AgentChatService = AgentChatService,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    var agentId by mutableStateOf(agentId); private set
    var userId by mutableStateOf(userId); private set

    var messages by mutableStateOf<List<AgentChatMessage>>(emptyList()); private set
    var loadState by mutableStateOf<LoadState>(LoadState.Idle); private set
    var isAssistantTyping by mutableStateOf(false); private set
    var lastError by mutableStateOf<String?>(null); private set

    var draft by mutableStateOf("")

    fun bind(userId: String?) {
        if (userId == this.userId) return
        this.userId = userId
        messages = emptyList()
        loadState = LoadState.Idle
    }

    /** Load the full thread. Mirrors useAgentChatHistory. */
    suspend fun refresh() {
        val uid = userId ?: return
        loadState = LoadState.Loading
        runCatching { service.fetchThread(userId = uid, agentId = agentId) }
            .onSuccess { rows ->
                messages = rows
                loadState = LoadState.Loaded
            }
            .onFailure { loadState = LoadState.Failed(message(it)) }
    }

    /**
     * Send a user message + request an assistant reply. Optimistic on the user
     * side; the assistant reply blocks [isAssistantTyping].
     */
    suspend fun send() {
        val uid = userId ?: return
        if (draft.trim().isEmpty()) return
        val body = draft
        draft = ""
        val tempId = "temp-${java.util.UUID.randomUUID()}"
        val temp = AgentChatMessage(
            id = tempId,
            avatarId = agentId,
            userId = uid,
            role = AgentChatMessage.Role.USER,
            content = body,
            createdAt = nowISO(),
        )
        messages = messages + temp

        val persisted = runCatching {
            service.sendUserMessage(userId = uid, agentId = agentId, content = body)
        }.getOrElse {
            // Strip the temp on failure and surface the error.
            messages = messages.filterNot { m -> m.id == tempId }
            lastError = message(it)
            return
        }
        // Swap temp with persisted row so we have the canonical id.
        messages = messages.map { m -> if (m.id == tempId) persisted else m }

        isAssistantTyping = true
        try {
            runCatching { service.requestAssistantReply(agentId = agentId) }
                .onSuccess { reply -> messages = messages + reply }
                .onFailure { lastError = message(it) }
        } finally {
            isAssistantTyping = false
        }
    }

    fun close() = scope.cancel()

    // MARK: - Helpers

    private fun message(error: Throwable): String {
        val raw = error.message.orEmpty()
        return raw.ifEmpty { "Unknown error" }
    }

    private fun nowISO(): String =
        ISO_MILLIS.format(Instant.now())

    private companion object {
        // ISO8601 with fractional seconds + Z, matching Swift's
        // [.withInternetDateTime, .withFractionalSeconds].
        val ISO_MILLIS: DateTimeFormatter =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneOffset.UTC)
    }
}

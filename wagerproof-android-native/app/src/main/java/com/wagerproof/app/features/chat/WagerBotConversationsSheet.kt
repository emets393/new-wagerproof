package com.wagerproof.app.features.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.components.SkeletonBlock
import com.wagerproof.core.design.components.shimmering
import com.wagerproof.core.models.WagerBotThreadSummary
import com.wagerproof.core.stores.StorePrefs
import com.wagerproof.core.stores.WagerBotChatStore
import java.time.Duration
import java.time.Instant
import java.time.OffsetDateTime
import kotlinx.coroutines.launch

/** Server-backed thread history with per-user local pin state. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WagerBotConversationsSheet(
    store: WagerBotChatStore,
    userId: String?,
    ui: WagerBotUiTokens,
    onDismiss: () -> Unit,
    onSelect: (WagerBotThreadSummary) -> Unit,
) {
    val scope = rememberCoroutineScope()
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val pinsKey = "wagerbot.pinnedThreads.${userId.orEmpty()}"
    var pinnedIds by remember(userId) {
        mutableStateOf(StorePrefs.standard.getStringSet(pinsKey, emptySet()).orEmpty().toSet())
    }
    var confirmClearAll by remember { mutableStateOf(false) }
    var deletingId by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(userId) {
        if (userId != null && (store.historyLoadState is WagerBotChatStore.HistoryLoadState.Idle || store.threads.isEmpty())) {
            store.refreshHistory(userId)
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = ui.pageBackground,
    ) {
        Column(Modifier.fillMaxSize().padding(bottom = 20.dp)) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                TextButton(onClick = { confirmClearAll = true }, enabled = store.threads.isNotEmpty()) {
                    Text("Clear All", color = if (store.threads.isEmpty()) ui.mutedText else Loss)
                }
                Text(
                    "History",
                    color = ui.primaryText,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.weight(1f),
                )
                TextButton(onClick = onDismiss) { Text("Done", color = ui.accent, fontWeight = FontWeight.SemiBold) }
            }

            when (val state = store.historyLoadState) {
                WagerBotChatStore.HistoryLoadState.Idle,
                WagerBotChatStore.HistoryLoadState.Loading -> HistorySkeleton(ui)
                is WagerBotChatStore.HistoryLoadState.Failed -> HistoryError(
                    message = state.message,
                    ui = ui,
                    canRetry = userId != null,
                    onRetry = { userId?.let { scope.launch { store.refreshHistory(it) } } },
                )
                WagerBotChatStore.HistoryLoadState.Loaded -> if (store.threads.isEmpty()) {
                    HistoryEmpty(ui)
                } else {
                    val pinned = store.threads.filter { it.id in pinnedIds }
                    val unpinned = store.threads.filterNot { it.id in pinnedIds }
                    LazyColumn(
                        Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        if (pinned.isNotEmpty()) {
                            item { HistorySectionLabel("Pinned", ui) }
                            items(pinned, key = { it.id }) { thread ->
                                ThreadRow(
                                    thread = thread,
                                    active = store.threadId == thread.id,
                                    pinned = true,
                                    deleting = deletingId == thread.id,
                                    ui = ui,
                                    onSelect = { onSelect(thread) },
                                    onTogglePin = {
                                        pinnedIds = pinnedIds - thread.id
                                        StorePrefs.standard.edit().putStringSet(pinsKey, pinnedIds).apply()
                                    },
                                    onDelete = {
                                        deletingId = thread.id
                                        scope.launch {
                                            store.deleteThread(thread.id)
                                            deletingId = null
                                        }
                                    },
                                )
                            }
                        }
                        item { HistorySectionLabel(if (pinned.isEmpty()) "History" else "Earlier", ui) }
                        items(unpinned, key = { it.id }) { thread ->
                            ThreadRow(
                                thread = thread,
                                active = store.threadId == thread.id,
                                pinned = false,
                                deleting = deletingId == thread.id,
                                ui = ui,
                                onSelect = { onSelect(thread) },
                                onTogglePin = {
                                    pinnedIds = pinnedIds + thread.id
                                    StorePrefs.standard.edit().putStringSet(pinsKey, pinnedIds).apply()
                                },
                                onDelete = {
                                    deletingId = thread.id
                                    scope.launch {
                                        store.deleteThread(thread.id)
                                        deletingId = null
                                    }
                                },
                            )
                        }
                    }
                }
            }
        }
    }

    if (confirmClearAll) {
        AlertDialog(
            onDismissRequest = { confirmClearAll = false },
            title = { Text("Clear all conversations?") },
            text = { Text("This permanently deletes every conversation in your history.") },
            confirmButton = {
                TextButton(onClick = {
                    confirmClearAll = false
                    scope.launch {
                        store.deleteAllThreads()
                        pinnedIds = emptySet()
                        StorePrefs.standard.edit().remove(pinsKey).apply()
                    }
                }) { Text("Clear All", color = Loss) }
            },
            dismissButton = { TextButton(onClick = { confirmClearAll = false }) { Text("Cancel") } },
            containerColor = ui.surfaceBackground,
            titleContentColor = ui.primaryText,
            textContentColor = ui.mutedText,
        )
    }
}

@Composable
private fun HistorySectionLabel(text: String, ui: WagerBotUiTokens) {
    Text(
        text.uppercase(),
        color = ui.mutedText,
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 0.8.sp,
        modifier = Modifier.padding(start = 20.dp, top = 14.dp, bottom = 2.dp),
    )
}

@Composable
private fun ThreadRow(
    thread: WagerBotThreadSummary,
    active: Boolean,
    pinned: Boolean,
    deleting: Boolean,
    ui: WagerBotUiTokens,
    onSelect: () -> Unit,
    onTogglePin: () -> Unit,
    onDelete: () -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(if (active) ui.accent.copy(alpha = 0.10f) else ui.surfaceBackground)
            .clickable(enabled = !deleting, onClick = onSelect)
            .semantics { contentDescription = thread.title?.takeIf { it.isNotBlank() } ?: "New chat" }
            .padding(start = 14.dp, top = 10.dp, bottom = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        if (pinned) Icon(chatIcon("pin.fill"), "Pinned", tint = Amber, modifier = Modifier.size(15.dp))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                thread.title?.takeIf { it.isNotBlank() } ?: "New chat",
                color = ui.primaryText,
                fontSize = 15.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(relativeTime(thread.updatedAt ?: thread.createdAt), color = ui.mutedText, fontSize = 12.sp)
        }
        IconButton(onClick = onTogglePin, enabled = !deleting) {
            Icon(chatIcon(if (pinned) "pin.slash.fill" else "pin.fill"), if (pinned) "Unpin" else "Pin", tint = if (pinned) Amber else ui.mutedText, modifier = Modifier.size(17.dp))
        }
        IconButton(onClick = onDelete, enabled = !deleting) {
            Icon(chatIcon(if (deleting) "hourglass" else "trash"), "Delete conversation", tint = Loss, modifier = Modifier.size(18.dp))
        }
        Icon(chatIcon(if (active) "checkmark" else "chevron.right"), null, tint = if (active) ui.accent else ui.mutedText, modifier = Modifier.size(14.dp).padding(end = 2.dp))
    }
}

@Composable
private fun HistorySkeleton(ui: WagerBotUiTokens) {
    Column(Modifier.fillMaxSize().padding(horizontal = 18.dp).shimmering(), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        Spacer(Modifier.height(8.dp))
        repeat(6) {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                SkeletonBlock(height = 14.dp, width = 210.dp)
                SkeletonBlock(height = 11.dp, width = 90.dp)
            }
        }
    }
}

@Composable
private fun HistoryEmpty(ui: WagerBotUiTokens) {
    Column(
        Modifier.fillMaxSize().padding(horizontal = 36.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(chatIcon("bubble.left.and.bubble.right.fill"), null, tint = ui.mutedText, modifier = Modifier.size(38.dp))
        Spacer(Modifier.height(12.dp))
        Text("No conversations yet", color = ui.primaryText, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text("Ask WagerBot anything about today's games and your conversations will show up here.", color = ui.mutedText, fontSize = 14.sp, textAlign = TextAlign.Center)
    }
}

@Composable
private fun HistoryError(message: String, ui: WagerBotUiTokens, canRetry: Boolean, onRetry: () -> Unit) {
    Column(
        Modifier.fillMaxSize().padding(horizontal = 36.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(chatIcon("exclamationmark.triangle.fill"), null, tint = Amber, modifier = Modifier.size(34.dp))
        Spacer(Modifier.height(12.dp))
        Text("Couldn't load history", color = ui.primaryText, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(6.dp))
        Text(message, color = ui.mutedText, fontSize = 13.sp, textAlign = TextAlign.Center)
        Spacer(Modifier.height(14.dp))
        Button(onClick = onRetry, enabled = canRetry, colors = ButtonDefaults.buttonColors(containerColor = ui.accent)) { Text("Retry") }
    }
}

private fun relativeTime(raw: String): String {
    val instant = runCatching { Instant.parse(raw) }.getOrNull()
        ?: runCatching { OffsetDateTime.parse(raw).toInstant() }.getOrNull()
        ?: return ""
    val seconds = Duration.between(instant, Instant.now()).seconds.coerceAtLeast(0)
    return when {
        seconds < 60 -> "now"
        seconds < 3_600 -> "${seconds / 60}m ago"
        seconds < 86_400 -> "${seconds / 3_600}h ago"
        seconds < 604_800 -> "${seconds / 86_400}d ago"
        else -> "${seconds / 604_800}w ago"
    }
}

private val Amber = Color(0xFFF59E0B)
private val Loss = Color(0xFFE53935)

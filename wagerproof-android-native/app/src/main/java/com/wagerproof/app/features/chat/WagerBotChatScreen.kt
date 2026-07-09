package com.wagerproof.app.features.chat

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.wagerproof.app.di.appGraph
import com.wagerproof.core.design.components.LiquidGlassScene
import com.wagerproof.core.design.components.liquidGlassBackground
import com.wagerproof.core.models.WagerBotChatGameCard
import com.wagerproof.core.models.WagerBotChatNav
import com.wagerproof.core.models.WagerBotChatWidget
import com.wagerproof.core.models.WagerBotMessage
import com.wagerproof.core.stores.AuthStore
import com.wagerproof.core.stores.MainTabStore
import com.wagerproof.core.stores.WagerBotChatStore
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** Production WagerBot page: streaming chat, thread history, and realtime voice. */
@Composable
fun WagerBotChatScreen(
    onDismiss: () -> Unit,
    onOpenSettings: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val graph = appGraph()
    val store = graph.wagerBotChat
    val ui = WagerBotUiTokens.resolve()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val userId = (graph.auth.phase as? AuthStore.Phase.Authenticated)?.userId

    var showHistory by remember { mutableStateOf(false) }
    var showVoice by remember { mutableStateOf(false) }
    var microphoneDenied by remember { mutableStateOf(false) }
    var loadingThread by remember { mutableStateOf(false) }
    var lastUserMessageId by remember { mutableStateOf<String?>(null) }
    val snackbar = remember { SnackbarHostState() }

    fun closeChat() {
        store.cancel()
        onDismiss()
    }

    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) showVoice = true else microphoneDenied = true
    }

    fun openVoice() {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            showVoice = true
        } else {
            permissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
        }
    }

    fun openGame(gameId: String, sport: String) {
        when (sport.lowercase()) {
            "nfl" -> graph.games.games.nfl.firstOrNull { it.id == gameId || it.gameId == gameId || it.uniqueId == gameId }?.let {
                graph.nflGameSheet.openGameSheet(it)
            }
            "cfb", "ncaaf" -> graph.games.games.cfb.firstOrNull { it.id == gameId || it.gameId == gameId || it.uniqueId == gameId }?.let {
                graph.cfbGameSheet.openGameSheet(it)
            }
            "nba" -> graph.games.games.nba.firstOrNull { it.id == gameId || it.gameId.toString() == gameId || it.uniqueId == gameId }?.let {
                graph.nbaGameSheet.openGameSheet(it)
            }
            "ncaab" -> graph.games.games.ncaab.firstOrNull { it.id == gameId || it.gameId.toString() == gameId || it.uniqueId == gameId }?.let {
                graph.ncaabGameSheet.openGameSheet(it)
            }
            "mlb" -> graph.games.games.mlb.firstOrNull { it.id == gameId || it.gamePk.toString() == gameId }?.let {
                graph.mlbGameSheet.openGameSheet(it)
            }
        }
        closeChat()
        graph.mainTab.select(MainTabStore.Tab.Games)
    }

    fun handleNav(nav: WagerBotChatNav) {
        when (nav.kind) {
            "game", "value" -> {
                val gameId = nav.gameId
                val sport = nav.sport
                if (gameId != null && sport != null) openGame(gameId, sport)
            }
            "prop" -> {
                closeChat()
                graph.mainTab.select(MainTabStore.Tab.Props)
            }
            "agent", "agent_pick" -> {
                nav.agentId?.let { graph.mainTab.pendingAgentRoute = MainTabStore.PendingAgentRoute(it, true) }
                closeChat()
                graph.mainTab.select(MainTabStore.Tab.Agents)
            }
            "editor_picks", "tool" -> {
                closeChat()
                graph.mainTab.select(MainTabStore.Tab.Games)
            }
        }
    }

    fun send(text: String) {
        val cleaned = text.trim()
        if (cleaned.isEmpty()) return
        store.send(cleaned)
        lastUserMessageId = store.messages.lastOrNull { it.role == WagerBotMessage.Role.USER }?.id
    }

    LaunchedEffect(userId) {
        store.bind(userId)
        if (userId != null) store.refreshHistory(userId)
    }
    LaunchedEffect(store.lastError) {
        store.lastError?.takeIf { it.isNotBlank() }?.let { snackbar.showSnackbar(it) }
    }
    DisposableEffect(store) { onDispose { store.cancel() } }
    BackHandler(enabled = !showVoice) { closeChat() }

    if (showVoice) {
        WagerBotVoiceScreen(
            isPro = graph.proAccess.isPro,
            onBack = { showVoice = false },
            onUpgrade = {
                showVoice = false
                closeChat()
                onOpenSettings()
            },
            modifier = modifier,
        )
        return
    }

    LiquidGlassScene { sourceModifier ->
        Box(modifier.fillMaxSize().then(sourceModifier).background(ui.pageBackground).safeDrawingPadding()) {
            when {
                graph.proAccess.isLoading -> CircularProgressIndicator(Modifier.align(Alignment.Center), color = ui.accent)
                !graph.proAccess.isPro -> LockedChat(
                    ui = ui,
                    onClose = ::closeChat,
                    onUpgrade = {
                        closeChat()
                        onOpenSettings()
                    },
                )
                else -> ChatBody(
                    store = store,
                    ui = ui,
                    lastUserMessageId = lastUserMessageId,
                    onClose = ::closeChat,
                    onNew = store::newConversation,
                    onHistory = { showHistory = true },
                    onVoice = ::openVoice,
                    onSend = ::send,
                    onGame = { id, sport -> openGame(id, sport) },
                    onComponentNav = ::handleNav,
                )
            }
            SnackbarHost(snackbar, Modifier.align(Alignment.BottomCenter).padding(bottom = 100.dp))
            if (loadingThread) {
                Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.36f)), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = ui.accent)
                }
            }
        }
    }

    if (showHistory) {
        WagerBotConversationsSheet(
            store = store,
            userId = userId,
            ui = ui,
            onDismiss = { showHistory = false },
            onSelect = { summary ->
                showHistory = false
                loadingThread = true
                scope.launch {
                    store.loadThread(summary)
                    loadingThread = false
                }
            },
        )
    }

    if (microphoneDenied) {
        AlertDialog(
            onDismissRequest = { microphoneDenied = false },
            title = { Text("Microphone access needed") },
            text = { Text("Allow microphone access in Android Settings to use WagerBot Voice.") },
            confirmButton = { TextButton(onClick = { microphoneDenied = false }) { Text("Got it") } },
            containerColor = ui.surfaceBackground,
            titleContentColor = ui.primaryText,
            textContentColor = ui.mutedText,
        )
    }
}

@Composable
private fun ChatBody(
    store: WagerBotChatStore,
    ui: WagerBotUiTokens,
    lastUserMessageId: String?,
    onClose: () -> Unit,
    onNew: () -> Unit,
    onHistory: () -> Unit,
    onVoice: () -> Unit,
    onSend: (String) -> Unit,
    onGame: (String, String) -> Unit,
    onComponentNav: (WagerBotChatNav) -> Unit,
) {
    val keyboard = LocalSoftwareKeyboardController.current
    val focus = LocalFocusManager.current
    val scope = rememberCoroutineScope()
    val listState = rememberLazyListState()
    val isAtBottom by remember { derivedStateOf { !listState.canScrollForward } }

    LaunchedEffect(lastUserMessageId) {
        val id = lastUserMessageId ?: return@LaunchedEffect
        delay(32)
        val index = store.messages.indexOfFirst { it.id == id }
        if (index >= 0) listState.animateScrollToItem(index)
    }

    fun submit(text: String = store.draft) {
        val cleaned = text.trim()
        if (cleaned.isEmpty()) return
        keyboard?.hide()
        focus.clearFocus()
        onSend(cleaned)
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(ui.pageBackground)
            .windowInsetsPadding(WindowInsets.statusBars)
            .imePadding(),
    ) {
        ChatHeader(store, ui, onClose, onNew, onHistory, onVoice)
        Box(Modifier.weight(1f).fillMaxWidth()) {
            if (store.messages.isEmpty()) {
                WelcomeState(ui = ui, onSend = { submit(it) })
            } else {
                BoxWithConstraints(Modifier.fillMaxSize()) {
                    LazyColumn(
                        state = listState,
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        itemsIndexed(store.messages, key = { _, message -> message.id }) { index, message ->
                            WagerBotChatBubble(
                                message = message,
                                ui = ui,
                                isStreaming = store.isStreaming && index == store.messages.lastIndex && message.role == WagerBotMessage.Role.ASSISTANT,
                                onFollowUpTap = { question -> submit(question) },
                                onTapWidget = { widget: WagerBotChatWidget -> onGame(widget.gameId, widget.sport) },
                                onTapGameCard = { card: WagerBotChatGameCard -> onGame(card.gameId, card.sport) },
                                onComponentNav = onComponentNav,
                            )
                        }
                        item(key = "phantom-tail") { Spacer(Modifier.height(maxHeight * 0.78f)) }
                    }
                }
                if (!isAtBottom) {
                    IconButton(
                        onClick = {
                            val last = store.messages.lastIndex
                            if (last >= 0) scope.launch { listState.animateScrollToItem(last) }
                        },
                        modifier = Modifier
                            .align(Alignment.BottomCenter)
                            .padding(bottom = 8.dp)
                            .clip(CircleShape)
                            .background(ui.composerBackground)
                            .border(1.dp, ui.composerBorder, CircleShape)
                            .semantics { contentDescription = "Scroll to latest" },
                    ) { Icon(chatIcon("arrow.down"), null, tint = ui.primaryText, modifier = Modifier.size(19.dp)) }
                }
            }
        }
        Composer(store, ui, onSend = { submit() })
    }
}

@Composable
private fun ChatHeader(
    store: WagerBotChatStore,
    ui: WagerBotUiTokens,
    onClose: () -> Unit,
    onNew: () -> Unit,
    onHistory: () -> Unit,
    onVoice: () -> Unit,
) {
    var menuExpanded by remember { mutableStateOf(false) }
    Box(Modifier.fillMaxWidth().height(58.dp).padding(horizontal = 4.dp)) {
        IconButton(
            onClick = onClose,
            modifier = Modifier.align(Alignment.CenterStart).semantics { contentDescription = "Close" },
        ) {
            Icon(chatIcon("xmark"), null, tint = ui.primaryText, modifier = Modifier.size(18.dp))
        }
        Row(
            Modifier.align(Alignment.Center).widthIn(max = 230.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            WagerBotIcon(19.dp, ui.accent)
            Column(Modifier.weight(1f, fill = false)) {
                Text(
                    store.threadTitle?.takeIf { it.isNotBlank() } ?: "WagerBot",
                    color = ui.primaryText,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text("Sports betting AI", color = ui.mutedText, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
            }
        }
        Box(Modifier.align(Alignment.CenterEnd)) {
            IconButton(
                onClick = { menuExpanded = true },
                modifier = Modifier.semantics { contentDescription = "More" },
            ) {
                Icon(chatIcon("ellipsis.circle"), null, tint = ui.primaryText, modifier = Modifier.size(22.dp))
            }
            DropdownMenu(expanded = menuExpanded, onDismissRequest = { menuExpanded = false }) {
                if (store.messages.isNotEmpty()) {
                    DropdownMenuItem(
                        text = { Text("New conversation") },
                        leadingIcon = { Icon(chatIcon("square.and.pencil"), null) },
                        onClick = { menuExpanded = false; onNew() },
                    )
                }
                DropdownMenuItem(
                    text = { Text("History") },
                    leadingIcon = { Icon(chatIcon("clock.arrow.circlepath"), null) },
                    onClick = { menuExpanded = false; onHistory() },
                )
                DropdownMenuItem(
                    text = { Text("WagerBot Voice") },
                    leadingIcon = { Icon(chatIcon("waveform.circle.fill"), null, tint = ui.accent) },
                    onClick = { menuExpanded = false; onVoice() },
                )
            }
        }
    }
}

private val WelcomePrompts = listOf(
    "What are the best bets today?",
    "Show me NBA value plays tonight",
    "Break down today's MLB slate",
    "Top NFL picks for this week",
    "Where is the model fading the public?",
    "How does Polymarket compare to Vegas?",
    "Find me the biggest spread mismatches",
    "Which underdogs look live?",
    "What are the current editor picks?",
    "Any injury news affecting tonight's lines?",
    "Search news on the Lakers",
    "Explain how the model weights matchups",
)

@Composable
private fun WelcomeState(ui: WagerBotUiTokens, onSend: (String) -> Unit) {
    val pages = remember { WelcomePrompts.chunked(4) }
    val pager = rememberPagerState { pages.size }
    Column(
        Modifier.fillMaxSize().padding(horizontal = 20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        WagerBotDynamicIcon(72.dp)
        Spacer(Modifier.height(14.dp))
        Text("What's on your slip today?", color = ui.primaryText, fontSize = 22.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
        Spacer(Modifier.height(10.dp))
        Text("Try one of these", color = ui.mutedText, fontSize = 13.sp, fontWeight = FontWeight.Medium)
        Spacer(Modifier.height(10.dp))
        HorizontalPager(state = pager, modifier = Modifier.fillMaxWidth().height(240.dp)) { page ->
            Column(Modifier.padding(horizontal = 4.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                pages[page].forEach { prompt ->
                    Text(
                        prompt,
                        color = ui.hintChipText,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(ui.hintChipBackground)
                            .border(1.dp, ui.borderColor, RoundedCornerShape(14.dp))
                            .clickable { onSend(prompt) }
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                    )
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            pages.indices.forEach { index ->
                Box(
                    Modifier
                        .widthIn(min = if (pager.currentPage == index) 18.dp else 6.dp, max = if (pager.currentPage == index) 18.dp else 6.dp)
                        .height(6.dp)
                        .clip(CircleShape)
                        .background(if (pager.currentPage == index) ui.accent else ui.borderColor),
                )
            }
        }
    }
}

@Composable
private fun Composer(store: WagerBotChatStore, ui: WagerBotUiTokens, onSend: () -> Unit) {
    val canSend = store.draft.isNotBlank()
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(24.dp)
    Column(
        Modifier
            .padding(horizontal = 12.dp, vertical = 8.dp)
            .shadow(16.dp, shape, ambientColor = Color.Black.copy(alpha = 0.10f), spotColor = Color.Black.copy(alpha = 0.10f))
            .liquidGlassBackground(shape, tint = ui.composerBackground)
            .border(1.dp, ui.composerBorder.copy(alpha = 0.6f), shape),
    ) {
        BasicTextField(
            value = store.draft,
            onValueChange = { store.draft = it.replace('\n', ' ') },
            modifier = Modifier
                .fillMaxWidth()
                .onFocusChanged { focused = it.isFocused }
                .padding(horizontal = 24.dp, vertical = 12.dp)
                .semantics { contentDescription = "Ask WagerBot anything" },
            textStyle = androidx.compose.ui.text.TextStyle(color = ui.primaryText, fontSize = 16.sp),
            minLines = 1,
            maxLines = 4,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
            keyboardActions = KeyboardActions(onSend = { if (canSend) onSend() }),
            cursorBrush = androidx.compose.ui.graphics.SolidColor(ui.accent),
            decorationBox = { inner ->
                Box {
                    if (store.draft.isEmpty()) {
                        Text("Ask anything", color = ui.mutedText, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    }
                    inner()
                }
            },
        )
        Row(Modifier.fillMaxWidth().height(54.dp).padding(end = 10.dp, bottom = 10.dp), horizontalArrangement = Arrangement.End) {
            if (store.isStreaming || canSend || focused) {
                IconButton(
                    onClick = { if (store.isStreaming) store.cancel() else if (canSend) onSend() },
                    enabled = store.isStreaming || canSend,
                    modifier = Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(if (store.isStreaming || canSend) ui.primaryActionBackground else ui.controlBackground),
                ) {
                    Icon(
                        chatIcon(if (store.isStreaming) "stop.fill" else "arrow.up"),
                        if (store.isStreaming) "Stop" else "Send",
                        tint = if (store.isStreaming || canSend) ui.primaryActionForeground else ui.mutedText,
                        modifier = Modifier.size(22.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun LockedChat(ui: WagerBotUiTokens, onClose: () -> Unit, onUpgrade: () -> Unit) {
    Box(Modifier.fillMaxSize()) {
        TextButton(onClick = onClose, modifier = Modifier.align(Alignment.TopEnd).windowInsetsPadding(WindowInsets.statusBars).padding(10.dp)) {
            Text("Close", color = ui.primaryText)
        }
        Column(
            Modifier.align(Alignment.Center).padding(horizontal = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Box {
                WagerBotIcon(58.dp, ui.accent)
                Icon(chatIcon("lock.fill"), null, tint = Color(0xFFF59E0B), modifier = Modifier.align(Alignment.TopEnd).size(21.dp))
            }
            Text("WagerBot Pro", color = ui.primaryText, fontSize = 24.sp, fontWeight = FontWeight.Bold)
            Text("Get unlimited AI-powered betting analysis across every sport.", color = ui.mutedText, fontSize = 14.sp, textAlign = TextAlign.Center)
            Button(onClick = onUpgrade, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF59E0B))) {
                Icon(chatIcon("crown.fill"), null, modifier = Modifier.size(16.dp))
                Text("  Unlock with Pro", fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

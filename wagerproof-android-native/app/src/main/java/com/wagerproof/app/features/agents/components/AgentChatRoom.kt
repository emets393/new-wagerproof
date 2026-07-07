package com.wagerproof.app.features.agents.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.agents.PixelEmojiInline
import com.wagerproof.app.features.agents.agentSymbol
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.Agent
import com.wagerproof.core.models.AgentChatMessage
import com.wagerproof.core.stores.AgentChatStore
import com.wagerproof.core.stores.LoadState
import kotlinx.coroutines.launch

// ---------------------------------------------------------------------------
// AgentChatRoom — per-agent chat surface. Port of iOS AgentChatRoom.swift.
// A real one-on-one chat between the user and their agent, backed by
// AgentChatStore (@Stable — read directly). Owner can "interview" the agent.
// ---------------------------------------------------------------------------

private val TEAL = Color(0xFF20B2AA)
private val LIVE_GREEN = Color(0xFF22C55E)
private val USER_BLUE = Color(0xFF3B82F6)
private val SEND_GREEN = Color(0xFF00E676)

@Composable
fun AgentChatRoom(
    agent: Agent,
    store: AgentChatStore,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(12.dp)

    // Load the thread once when the store is still idle. Mirrors .task { ... }.
    LaunchedEffect(store) {
        if (store.loadState is LoadState.Idle) {
            store.refresh()
        }
    }

    Column(
        modifier = modifier
            .clip(shape)
            .background(AppColors.appSurfaceElevated)
            .border(1.dp, AppColors.appBorder.copy(alpha = 0.4f), shape),
    ) {
        Header(agent)
        MessageList(agent, store, modifier = Modifier.weight(1f, fill = false))
        InputBar(agent, store)
    }
}

@Composable
private fun Header(agent: Agent) {
    Box {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = agentSymbol("bubble.left.and.bubble.right.fill"),
                contentDescription = null,
                tint = TEAL,
                modifier = Modifier.size(14.dp),
            )
            Text(
                text = "Chat with ${agent.name}",
                color = AppColors.appTextPrimary,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
            )
            Spacer(Modifier.weight(1f))
            Row(
                modifier = Modifier
                    .clip(CircleShape)
                    .background(LIVE_GREEN.copy(alpha = 0.1f))
                    .padding(horizontal = 6.dp, vertical = 2.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(Modifier.size(6.dp).clip(CircleShape).background(LIVE_GREEN))
                Text(
                    text = "LIVE",
                    color = LIVE_GREEN,
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 0.3.sp,
                )
            }
        }
        // Bottom hairline.
        Box(
            Modifier
                .fillMaxWidth()
                .align(Alignment.BottomCenter)
                .height(1.dp)
                .background(AppColors.appBorder.copy(alpha = 0.4f)),
        )
    }
}

@Composable
private fun MessageList(agent: Agent, store: AgentChatStore, modifier: Modifier = Modifier) {
    val listState = rememberLazyListState()

    // Keep the newest message (or the typing indicator) pinned to the bottom.
    LaunchedEffect(store.messages.size, store.isAssistantTyping) {
        val target = if (store.isAssistantTyping) store.messages.size else (store.messages.size - 1)
        if (target >= 0) listState.animateScrollToItem(target.coerceAtLeast(0))
    }

    LazyColumn(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(max = 360.dp),
        state = listState,
        contentPadding = androidx.compose.foundation.layout.PaddingValues(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (store.messages.isEmpty()) {
            item { EmptyState(agent) }
        } else {
            items(store.messages, key = { it.id }) { msg ->
                MessageBubble(agent, msg)
            }
        }
        if (store.isAssistantTyping) {
            item(key = "typing") { TypingDots() }
        }
    }
}

@Composable
private fun EmptyState(agent: Agent) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        PixelEmojiInline(emoji = agent.avatarEmoji, size = 28.sp)
        Text(
            text = "Ask ${agent.name} about a pick",
            color = AppColors.appTextSecondary,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
        )
        Text(
            text = "\"Why are you on the Nuggets tonight?\"\n\"What's your read on tonight's Lakers/Suns total?\"",
            color = AppColors.appTextSecondary.copy(alpha = 0.7f),
            fontSize = 11.sp,
            fontFamily = FontFamily.Monospace,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun MessageBubble(agent: Agent, msg: AgentChatMessage) {
    val isUser = msg.role == AgentChatMessage.Role.USER
    val bg = if (isUser) USER_BLUE.copy(alpha = 0.18f) else AppColors.appBorder.copy(alpha = 0.45f)
    val bubbleShape = RoundedCornerShape(10.dp)

    // iOS pins the bubble to one edge with a flexible min-36 spacer on the other.
    // A single weighted-fill-false child + Arrangement is the Compose equivalent:
    // the bubble sizes to content (capped at row width) and aligns to its side.
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start,
    ) {
        Column(
            modifier = Modifier
                .weight(1f, fill = false)
                .clip(bubbleShape)
                .background(bg)
                .padding(horizontal = 10.dp, vertical = 8.dp),
            horizontalAlignment = if (isUser) Alignment.End else Alignment.Start,
            verticalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                if (!isUser) Text(text = agent.avatarEmoji, fontSize = 14.sp)
                Text(
                    text = if (isUser) "You" else agent.name,
                    color = if (isUser) USER_BLUE else AppColors.appTextSecondary,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Black,
                )
            }
            Text(
                text = msg.content,
                color = AppColors.appTextPrimary,
                fontSize = 13.sp,
                textAlign = if (isUser) TextAlign.End else TextAlign.Start,
            )
        }
    }
}

@Composable
private fun InputBar(agent: Agent, store: AgentChatStore) {
    val scope = rememberCoroutineScope()
    val canSend = store.draft.trim().isNotEmpty()
    val fieldShape = RoundedCornerShape(8.dp)
    val interaction = remember { MutableInteractionSource() }

    Box {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(10.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            BasicTextField(
                value = store.draft,
                onValueChange = { store.draft = it },
                modifier = Modifier
                    .weight(1f)
                    .clip(fieldShape)
                    .background(AppColors.appBorder.copy(alpha = 0.4f))
                    .padding(horizontal = 10.dp, vertical = 8.dp),
                textStyle = TextStyle(color = AppColors.appTextPrimary, fontSize = 14.sp),
                cursorBrush = SolidColor(SEND_GREEN),
                maxLines = 4,
                decorationBox = { inner ->
                    if (store.draft.isEmpty()) {
                        Text(
                            text = "Message ${agent.name}…",
                            color = AppColors.appTextSecondary,
                            fontSize = 14.sp,
                        )
                    }
                    inner()
                },
            )

            val enabled = canSend && !store.isAssistantTyping
            Box(
                modifier = Modifier
                    .size(26.dp)
                    .clip(CircleShape)
                    .let {
                        if (enabled) {
                            it.clickable(interactionSource = interaction, indication = null) {
                                scope.launch { store.send() }
                            }
                        } else it
                    },
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = agentSymbol("arrow.up.circle.fill"),
                    contentDescription = "Send",
                    tint = if (canSend) SEND_GREEN else AppColors.appTextSecondary,
                    modifier = Modifier.size(26.dp),
                )
            }
        }
        // Top hairline.
        Box(
            Modifier
                .fillMaxWidth()
                .align(Alignment.TopCenter)
                .height(1.dp)
                .background(AppColors.appBorder.copy(alpha = 0.4f)),
        )
    }
}

/** Three-dot "typing" indicator. */
@Composable
private fun TypingDots() {
    val transition = rememberInfiniteTransition(label = "typing")
    val t by transition.animateFloat(
        initialValue = 0f,
        targetValue = 3f,
        animationSpec = infiniteRepeatable(
            animation = tween(540, easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "typingPhase",
    )
    val active = t.toInt() % 3
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(10.dp))
            .background(AppColors.appBorder.copy(alpha = 0.45f))
            .padding(horizontal = 10.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        repeat(3) { idx ->
            Box(
                Modifier
                    .size(6.dp)
                    .clip(CircleShape)
                    .background(AppColors.appTextSecondary.copy(alpha = if (idx == active) 1.0f else 0.4f)),
            )
        }
    }
}

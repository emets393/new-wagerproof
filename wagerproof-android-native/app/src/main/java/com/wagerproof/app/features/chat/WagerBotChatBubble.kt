package com.wagerproof.app.features.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.models.WagerBotChatGameCard
import com.wagerproof.core.models.WagerBotChatNav
import com.wagerproof.core.models.WagerBotChatWidget
import com.wagerproof.core.models.WagerBotContentBlock
import com.wagerproof.core.models.WagerBotMessage

/** A full content-block message renderer with deterministic block ordering. */
@Composable
fun WagerBotChatBubble(
    message: WagerBotMessage,
    ui: WagerBotUiTokens,
    isStreaming: Boolean = false,
    modifier: Modifier = Modifier,
    onFollowUpTap: (String) -> Unit = {},
    onTapWidget: (WagerBotChatWidget) -> Unit = {},
    onTapGameCard: (WagerBotChatGameCard) -> Unit = {},
    onComponentNav: (WagerBotChatNav) -> Unit = {},
) {
    val body = message.blocks.filter { block ->
        when (block) {
            is WagerBotContentBlock.ToolUse, is WagerBotContentBlock.FollowUps -> false
            is WagerBotContentBlock.GameCards,
            is WagerBotContentBlock.ChatWidgets,
            is WagerBotContentBlock.AppComponents -> !isStreaming
            else -> true
        }
    }
    val tools = message.blocks.filterIsInstance<WagerBotContentBlock.ToolUse>()
    val followUps = if (isStreaming) emptyList() else message.blocks
        .filterIsInstance<WagerBotContentBlock.FollowUps>()
        .flatMap { it.questions }
        .map { it.trim() }
        .filter { it.isNotEmpty() }
        .distinct()
    val gameReferences = if (isStreaming) emptyList() else buildList {
        message.blocks.forEach { block ->
            when (block) {
                is WagerBotContentBlock.GameCards -> block.cards.forEach { card ->
                    add(WagerBotGameReference(card.gameId, card.sport, card.awayAbbr, card.homeAbbr))
                }
                is WagerBotContentBlock.ChatWidgets -> block.widgets.forEach { widget ->
                    add(WagerBotGameReference(widget.gameId, widget.sport, "", ""))
                }
                else -> Unit
            }
        }
    }.distinctBy { it.id }

    Row(
        modifier = modifier
            .fillMaxWidth()
            .semantics {
                contentDescription = if (message.role == WagerBotMessage.Role.USER) "Your message" else "WagerBot response"
            },
        verticalAlignment = Alignment.Top,
    ) {
        if (message.role == WagerBotMessage.Role.USER) Spacer(Modifier.weight(1f))
        Column(
            modifier = if (message.role == WagerBotMessage.Role.USER) Modifier.fillMaxWidth(0.86f) else Modifier.fillMaxWidth(),
            horizontalAlignment = if (message.role == WagerBotMessage.Role.USER) Alignment.End else Alignment.Start,
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            if (body.isEmpty() && isStreaming && message.role == WagerBotMessage.Role.ASSISTANT) {
                WagerBotThinkingIndicator(ui)
            } else {
                body.forEach { block ->
                    when (block) {
                        is WagerBotContentBlock.Text -> MessageText(message.role, block.text, ui)
                        is WagerBotContentBlock.Thinking -> Text(
                            block.text,
                            color = ui.mutedText,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            fontStyle = FontStyle.Italic,
                            maxLines = 4,
                            overflow = TextOverflow.Ellipsis,
                        )
                        is WagerBotContentBlock.GameCards -> WagerBotSuggestedGamesCarousel(block.cards, ui, onTap = onTapGameCard)
                        is WagerBotContentBlock.ChatWidgets -> Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            block.widgets.forEach { widget ->
                                WagerBotActionPreview(widget, ui, onTap = { onTapWidget(widget) })
                            }
                        }
                        is WagerBotContentBlock.AppComponents -> WagerBotAppComponentsView(
                            summary = block.summary,
                            components = block.components,
                            ui = ui,
                            onNav = onComponentNav,
                        )
                        is WagerBotContentBlock.ToolUse, is WagerBotContentBlock.FollowUps -> Unit
                    }
                }
            }

            if (tools.isNotEmpty()) WagerBotToolCallsPill(tools, Modifier.padding(top = 2.dp))

            if (gameReferences.isNotEmpty()) {
                WagerBotGameReferencesPill(
                    references = gameReferences,
                    modifier = Modifier.padding(top = 2.dp),
                    onTap = { ref ->
                        message.blocks.filterIsInstance<WagerBotContentBlock.GameCards>()
                            .flatMap { it.cards }.firstOrNull { it.gameId == ref.id }?.let(onTapGameCard)
                            ?: message.blocks.filterIsInstance<WagerBotContentBlock.ChatWidgets>()
                                .flatMap { it.widgets }.firstOrNull { it.gameId == ref.id }?.let(onTapWidget)
                    },
                )
            }

            if (followUps.isNotEmpty()) FollowUps(followUps, ui, onFollowUpTap)
        }
    }
}

@Composable
private fun MessageText(role: WagerBotMessage.Role, text: String, ui: WagerBotUiTokens) {
    if (role == WagerBotMessage.Role.USER) {
        Text(
            text,
            color = ui.userBubbleText,
            fontSize = 15.sp,
            modifier = Modifier
                .clip(RoundedCornerShape(16.dp))
                .background(ui.userBubbleBackground)
                .border(1.dp, ui.borderColor, RoundedCornerShape(16.dp))
                .padding(12.dp),
        )
    } else {
        WagerBotMarkdownText(
            text = text,
            modifier = Modifier.padding(start = 4.dp, end = 12.dp),
            primaryColor = ui.primaryText,
            secondaryColor = ui.mutedText,
            quoteAccent = ui.accent,
        )
    }
}

@Composable
private fun FollowUps(items: List<String>, ui: WagerBotUiTokens, onTap: (String) -> Unit) {
    Column(Modifier.fillMaxWidth().padding(top = 4.dp)) {
        items.forEachIndexed { index, question ->
            if (index > 0) HorizontalDivider(Modifier.padding(start = 28.dp), color = ui.borderColor.copy(alpha = 0.5f))
            Row(
                Modifier.fillMaxWidth().clickable { onTap(question) }.padding(vertical = 10.dp),
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Icon(chatIcon("arrow.turn.down.right"), null, tint = ui.mutedText, modifier = Modifier.size(14.dp).padding(top = 2.dp))
                Text(question, color = ui.primaryText, fontSize = 14.sp, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
                Icon(chatIcon("plus"), null, tint = ui.mutedText.copy(alpha = 0.7f), modifier = Modifier.size(12.dp).padding(top = 3.dp))
            }
        }
    }
}

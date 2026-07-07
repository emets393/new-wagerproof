package com.wagerproof.app.features.roast

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.stores.RoastSessionStore

/**
 * Port of iOS `RoastMessageBubble.swift`. User = green-20% right-aligned, bottom-
 * right corner pinched to 4dp; assistant = white-8% left-aligned, bottom-left
 * pinch, "THE BOOKIE" caption. Live variants dimmed; max width 320dp.
 */
sealed interface RoastBubbleVariant {
    data class Finalized(val role: RoastSessionStore.Message.Role) : RoastBubbleVariant
    data object LiveUser : RoastBubbleVariant
    data object LiveAssistant : RoastBubbleVariant
}

@Composable
fun RoastMessageBubble(
    text: String,
    variant: RoastBubbleVariant,
    modifier: Modifier = Modifier,
) {
    val role = when (variant) {
        is RoastBubbleVariant.Finalized -> variant.role
        RoastBubbleVariant.LiveUser -> RoastSessionStore.Message.Role.user
        RoastBubbleVariant.LiveAssistant -> RoastSessionStore.Message.Role.assistant
    }
    val isUser = role == RoastSessionStore.Message.Role.user

    val background = when (variant) {
        is RoastBubbleVariant.Finalized ->
            if (variant.role == RoastSessionStore.Message.Role.user) AppColors.appPrimary.copy(alpha = 0.2f)
            else Color.White.copy(alpha = 0.08f)
        RoastBubbleVariant.LiveUser -> AppColors.appPrimary.copy(alpha = 0.08f)
        RoastBubbleVariant.LiveAssistant -> Color.White.copy(alpha = 0.08f)
    }
    val textAlpha = when (variant) {
        is RoastBubbleVariant.Finalized ->
            if (variant.role == RoastSessionStore.Message.Role.user) 1f else 0.9f
        RoastBubbleVariant.LiveUser -> 0.7f
        RoastBubbleVariant.LiveAssistant -> 0.8f
    }

    // Pinched corner toward the speaker's side.
    val shape = RoundedCornerShape(
        topStart = 16.dp,
        topEnd = 16.dp,
        bottomStart = if (isUser) 16.dp else 4.dp,
        bottomEnd = if (isUser) 4.dp else 16.dp,
    )

    Row(
        modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start,
    ) {
        if (isUser) Spacer(Modifier.widthIn(min = 40.dp))
        Column(
            Modifier
                .widthIn(max = 320.dp)
                .clip(shape)
                // FIDELITY-WAIVER #301 — iOS draws a dashed border on the live-user
                // bubble; Compose has no ergonomic dashed stroke on an uneven
                // rounded shape, so we use a solid green hairline instead.
                .then(
                    if (variant == RoastBubbleVariant.LiveUser)
                        Modifier.border(1.dp, AppColors.appPrimary.copy(alpha = 0.3f), shape)
                    else Modifier,
                )
                .background(background)
                .padding(horizontal = 14.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            if (!isUser) {
                Text(
                    "THE BOOKIE",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.5.sp,
                    color = AppColors.appPrimary,
                )
            }
            Text(text, fontSize = 15.sp, color = Color.White.copy(alpha = textAlpha), lineHeight = 20.sp)
        }
        if (!isUser) Spacer(Modifier.widthIn(min = 40.dp))
    }
}

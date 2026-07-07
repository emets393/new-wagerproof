package com.wagerproof.app.features.agents.creation.inputs

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.tokens.AppColors

/**
 * Paged emoji grid for Step 2 (Identity). Port of iOS `SwipeableEmojiPicker`.
 * 60 emojis = 6 pages x 10 (2 rows of 5). [HorizontalPager] gives native
 * horizontal paging; page dots sit below. Selection haptic on tap.
 */
@Composable
fun SwipeableEmojiPicker(
    selectedEmoji: String,
    onSelect: (String) -> Unit,
    selectedColor: Color,
    modifier: Modifier = Modifier,
) {
    val haptics = LocalHapticFeedback.current
    val pageCount = (EMOJIS.size + EMOJIS_PER_PAGE - 1) / EMOJIS_PER_PAGE

    val initialPage = EMOJIS.indexOf(selectedEmoji).let { if (it >= 0) it / EMOJIS_PER_PAGE else 0 }
    val pagerState = rememberPagerState(initialPage = initialPage) { pageCount }

    Column(
        modifier = modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        HorizontalPager(
            state = pagerState,
            modifier = Modifier.fillMaxWidth().height(132.dp),
            pageSpacing = 0.dp,
        ) { pageIdx ->
            val start = pageIdx * EMOJIS_PER_PAGE
            val end = minOf(start + EMOJIS_PER_PAGE, EMOJIS.size)
            val pageEmojis = EMOJIS.subList(start, end)
            Column(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                emojiRow(pageEmojis.take(5), selectedEmoji, selectedColor) {
                    haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                    onSelect(it)
                }
                emojiRow(pageEmojis.drop(5), selectedEmoji, selectedColor) {
                    haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                    onSelect(it)
                }
            }
        }

        Row(
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            repeat(pageCount) { idx ->
                val active = idx == pagerState.currentPage
                Box(
                    modifier = Modifier
                        .size(if (active) 8.dp else 6.dp)
                        .clip(CircleShape)
                        .background(if (active) selectedColor else AppColors.appBorder.copy(alpha = 0.5f)),
                )
            }
        }
    }
}

@Composable
private fun emojiRow(
    row: List<String>,
    selectedEmoji: String,
    selectedColor: Color,
    onSelect: (String) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        row.forEach { emoji ->
            val selected = selectedEmoji == emoji
            Box(
                modifier = Modifier
                    .weight(1f)
                    .sizeIn(maxWidth = 52.dp, maxHeight = 52.dp)
                    .aspectRatio(1f)
                    .clip(RoundedCornerShape(12.dp))
                    .background(
                        if (selected) selectedColor.copy(alpha = 0.2f)
                        else AppColors.appBorder.copy(alpha = 0.25f),
                    )
                    .border(
                        if (selected) 2.dp else 1.dp,
                        if (selected) selectedColor else AppColors.appBorder,
                        RoundedCornerShape(12.dp),
                    )
                    .clickableNoRipple { onSelect(emoji) },
                contentAlignment = Alignment.Center,
            ) {
                Text(text = emoji, fontSize = 22.sp)
            }
        }
    }
}

private const val EMOJIS_PER_PAGE = 10

/** 60 emojis = 6 pages of 10. Source: iOS `SwipeableEmojiPicker.AGENT_EMOJIS`. */
private val EMOJIS: List<String> = listOf(
    // Page 1 - Classic & Power
    "🤖", "🧠", "🎯", "🔥", "💎",
    "🦅", "🐺", "🦁", "⚡", "🚀",
    // Page 2 - Animals
    "🐲", "🦈", "🐍", "🦉", "🐻",
    "🦍", "🦊", "🐝", "🦜", "🦢",
    // Page 3 - More Animals
    "🐎", "🦄", "🦭", "🐢", "🦎",
    "🦞", "👻", "💀", "👽", "🦹",
    // Page 4 - Power & Sports
    "💥", "🏆", "👑", "🌟", "🔮",
    "🎰", "🎲", "♟️", "🏀", "🏈",
    // Page 5 - Sports & Objects
    "⚽", "⚾", "🎾", "💡", "💰",
    "💸", "🛡️", "🔑", "🏹", "💪",
    // Page 6 - Nature & Misc
    "🌊", "🌋", "🌩️", "❄️", "☄️",
    "🌞", "🌙", "🌌", "🧊", "🎆",
)

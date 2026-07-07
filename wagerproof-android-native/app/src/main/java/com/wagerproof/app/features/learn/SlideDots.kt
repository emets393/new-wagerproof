package com.wagerproof.app.features.learn

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.stores.LearnWagerProofStore

/**
 * Port of iOS `SlideProgressIndicator.swift`. Row of tappable dots — active dot
 * 8dp brand green, inactive 6dp at 30% white (dark theme is the app default).
 */
@Composable
fun SlideDots(
    currentSlide: Int,
    onDotPress: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        repeat(LearnWagerProofStore.Topic.totalSlides) { index ->
            val isActive = index == currentSlide
            // 12dp hit target regardless of dot size (matches iOS -6 inset).
            Box(
                Modifier
                    .size(12.dp)
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                    ) { onDotPress(index) },
                contentAlignment = Alignment.Center,
            ) {
                Box(
                    Modifier
                        .size(if (isActive) 8.dp else 6.dp)
                        .clip(CircleShape)
                        .background(if (isActive) AppColors.appPrimary else Color.White.copy(alpha = 0.3f)),
                )
            }
        }
    }
}

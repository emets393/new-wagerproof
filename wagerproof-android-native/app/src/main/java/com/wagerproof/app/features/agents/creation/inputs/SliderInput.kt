package com.wagerproof.app.features.agents.creation.inputs

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.tokens.AppColors
import kotlin.math.roundToInt

/**
 * Discrete 5-step slider used across Step 3 / 4. Port of iOS `SliderInput`.
 * [value] is 1..5; [labels] holds five entries (index 0 == value 1). Header
 * shows the label + description and a badge of the active step label; below the
 * track sit 5 equal-width tap-to-jump step labels. Slider tint = brand green
 * (appPrimary). Selection haptic fires on each integer change.
 */
@Composable
fun SliderInput(
    value: Int,
    onValueChange: (Int) -> Unit,
    label: String,
    labels: List<String>,
    modifier: Modifier = Modifier,
    description: String? = null,
) {
    val haptics = LocalHapticFeedback.current
    val clamped = value.coerceIn(1, 5)
    val currentLabel = labels.getOrElse(clamped - 1) { "" }

    Column(modifier = modifier.fillMaxWidth().padding(vertical = 6.dp)) {
        Row(verticalAlignment = Alignment.Top) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = label,
                    color = AppColors.appTextPrimary,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                )
                if (description != null) {
                    Text(
                        text = description,
                        color = AppColors.appTextSecondary,
                        fontSize = 13.sp,
                    )
                }
            }
            Spacer(Modifier.width(12.dp))
            Text(
                text = currentLabel,
                color = AppColors.appPrimary,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier
                    .clip(RoundedCornerShape(50))
                    .background(AppColors.appBorder.copy(alpha = 0.5f))
                    .padding(horizontal = 12.dp, vertical = 6.dp),
            )
        }

        // Native discrete slider — 1..5 with 3 intermediate steps == 5 stops.
        Slider(
            value = clamped.toFloat(),
            onValueChange = { raw ->
                val next = raw.roundToInt().coerceIn(1, 5)
                if (next != clamped) {
                    haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                    onValueChange(next)
                }
            },
            valueRange = 1f..5f,
            steps = 3,
            colors = SliderDefaults.colors(
                thumbColor = AppColors.appPrimary,
                activeTrackColor = AppColors.appPrimary,
                inactiveTrackColor = AppColors.appBorder,
                activeTickColor = Color.Transparent,
                inactiveTickColor = Color.Transparent,
            ),
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            labels.forEachIndexed { idx, stepLabel ->
                val active = (idx + 1) == clamped
                Text(
                    text = stepLabel,
                    color = if (active) AppColors.appPrimary else AppColors.appTextSecondary,
                    fontSize = 10.sp,
                    fontWeight = if (active) FontWeight.SemiBold else FontWeight.Normal,
                    textAlign = TextAlign.Center,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier
                        .weight(1f)
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null,
                        ) {
                            if (idx + 1 != clamped) onValueChange(idx + 1)
                        },
                )
            }
        }
    }
}

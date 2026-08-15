package com.wagerproof.core.design.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors

/**
 * The "Pick Signals" row under a market card's recommendation.
 *
 * Port of `Wagerproof/Features/GameWidgets/PickSignalPills.swift` and
 * `src/features/games/detail/signals/PickSignalsSection.tsx`.
 *
 * ## Why one header instead of two groups
 * The old layout printed "Supports this pick" and "Contradicts this pick" as
 * separate headed groups, which buried the only thing a reader has to do here —
 * open one — under a taxonomy. There is now a single labelled affordance, with
 * stance carried by the pill: amber triangle argues against the pick, neutral
 * circle backs it. The legend says so in words so colour isn't load bearing.
 */
data class PickSignalPillModel(
    val id: String,
    val title: String,
    /** Argues AGAINST the card's pick — drives the amber tint and the triangle. */
    val contradicts: Boolean,
)

@Composable
fun PickSignalsSection(
    signals: List<PickSignalPillModel>,
    onSelect: (PickSignalPillModel) -> Unit,
    modifier: Modifier = Modifier,
    /** Game-level lists aren't attached to a pick, so they name themselves. */
    title: String = "PICK SIGNALS",
) {
    if (signals.isEmpty()) return

    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.Bottom,
        ) {
            Text(
                title,
                color = AppColors.appTextSecondary,
                fontSize = 10.sp,
                fontWeight = FontWeight.Black,
            )
            Text(
                "(tap for details)",
                color = AppColors.appTextMuted,
                fontSize = 9.sp,
                fontWeight = FontWeight.Black,
            )
        }

        // Stance is otherwise colour-only, which fails for anyone who can't
        // separate amber from the neutral pills.
        if (signals.any { it.contradicts }) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(5.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                AppIcon.fromSystemName("exclamationmark.triangle.fill")?.let {
                    Icon(
                        it.imageVector,
                        null,
                        tint = AppColors.appAccentAmber,
                        modifier = Modifier.size(9.dp),
                    )
                }
                Text(
                    "Amber signals argue against this pick",
                    color = AppColors.appTextMuted,
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }

        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(7.dp),
            verticalArrangement = Arrangement.spacedBy(7.dp),
        ) {
            signals.forEach { PickSignalPill(it) { onSelect(it) } }
        }
    }
}

@Composable
private fun PickSignalPill(model: PickSignalPillModel, onTap: () -> Unit) {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    // Compose has no `.interactive()` glass, so the squeeze is what makes the
    // pill answer the finger.
    val scale by animateFloatAsState(
        targetValue = if (pressed) 0.94f else 1f,
        animationSpec = spring(dampingRatio = 0.62f, stiffness = 900f),
        label = "signalPillPress",
    )

    val tint = if (model.contradicts) AppColors.appAccentAmber else null
    val icon = if (model.contradicts) "exclamationmark.triangle.fill" else "exclamationmark.circle.fill"

    Row(
        Modifier
            .scale(scale)
            // Colour rides the ICON, not the fill: supporting pills take plain
            // glass so the amber ones are the only coloured thing in the row.
            .liquidGlassCapsule(tint = tint)
            .then(
                if (tint != null) {
                    Modifier.border(1.dp, tint.copy(alpha = 0.45f), CircleShape)
                } else {
                    Modifier.border(0.8.dp, AppColors.appBorder.copy(alpha = 0.35f), CircleShape)
                }
            )
            .clickable(interactionSource = interaction, indication = null, onClick = onTap)
            // Stance has to be spoken, not just tinted — matches the iOS
            // accessibility label and the web aria-label.
            .semantics {
                contentDescription = "${model.title}. " +
                    (if (model.contradicts) "Contradicts this pick" else "Supports this pick") +
                    ". Tap for backtest."
            }
            .padding(horizontal = 13.dp, vertical = 9.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        AppIcon.fromSystemName(icon)?.let {
            Icon(
                it.imageVector,
                null,
                tint = tint ?: AppColors.appTextSecondary,
                modifier = Modifier.size(11.dp),
            )
        }
        Text(
            model.title,
            color = AppColors.appTextPrimary,
            fontSize = 12.sp,
            fontWeight = FontWeight.Black,
            maxLines = 1,
        )
    }
}

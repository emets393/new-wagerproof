package com.wagerproof.app.features.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.components.liquidGlassCapsule
import com.wagerproof.core.design.tokens.AppColors

/** Gap between the capsule edge and the segments — the concentric-corner inset. */
private val SEGMENT_INSET = 4.dp

/** Inner content height. Matches the 32dp icon buttons that sit beside the segments. */
private val SEGMENT_HEIGHT = 32.dp

/**
 * The floating Liquid Glass segmented control that heads Games, Scoreboard and
 * Agents. iOS gets one look for free from `.pickerStyle(.segmented)` inside a
 * `LiquidGlassCapsule`; Android has to hand-roll it, so all three call sites go
 * through this ONE composable — three hand-rolled copies is exactly how they
 * drifted into three different fills and corner radii.
 *
 * Two rules the copies used to break:
 *  - **Same translucency as the search capsule.** Both come from
 *    `liquidGlassCapsule`, so a picker stacked above a [QuickFilterField] reads
 *    as the same material rather than two competing greys.
 *  - **Concentric corners.** The selection thumb's radius is the container's
 *    radius minus [SEGMENT_INSET]. Because the container is a capsule and the
 *    thumb fills the inset height, that works out to a capsule as well — a
 *    fixed 8dp box inside a 20dp capsule reads as a rectangle in a pill.
 *
 * The THUMB animates, not per-segment backgrounds: that's what makes selection
 * read as one pill sliding rather than two cross-fading blocks.
 *
 * [trailing] renders INSIDE the capsule (the sort/filter menu buttons), matching
 * iOS's `HStack { Picker; menu }.modifier(LiquidGlassCapsule())`.
 */
@Composable
fun GlassSegmentedPicker(
    labels: List<String>,
    selectedIndex: Int,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
    activeLabelColor: Color = AppColors.appTextPrimary,
    // Five-sport bars (Games, Scoreboard) need a notch down or NCAAB ellipsizes.
    labelFontSize: TextUnit = 13.sp,
    trailing: (@Composable RowScope.() -> Unit)? = null,
) {
    if (labels.isEmpty()) return
    val haptics = LocalHapticFeedback.current
    val thumbPosition by animateFloatAsState(
        targetValue = selectedIndex.coerceIn(0, labels.lastIndex).toFloat(),
        animationSpec = spring(dampingRatio = 0.82f, stiffness = 520f),
        label = "glass-segment-thumb",
    )
    val thumbColor = AppColors.appPrimary.copy(alpha = 0.20f)

    Row(
        modifier
            .liquidGlassCapsule(null)
            .padding(SEGMENT_INSET),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(SEGMENT_INSET),
    ) {
        Row(
            Modifier
                .weight(1f)
                .height(SEGMENT_HEIGHT)
                .drawBehind {
                    val segmentWidth = size.width / labels.size
                    drawRoundRect(
                        color = thumbColor,
                        topLeft = Offset(segmentWidth * thumbPosition, 0f),
                        size = Size(segmentWidth, size.height),
                        // Container radius (height/2 + inset) minus the inset.
                        cornerRadius = CornerRadius(size.height / 2f),
                    )
                },
        ) {
            labels.forEachIndexed { index, label ->
                val active = index == selectedIndex
                Box(
                    Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .clip(CircleShape)
                        .clickable {
                            // iOS .sensoryFeedback(.selection, trigger: selection).
                            haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                            onSelect(index)
                        },
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        label,
                        color = if (active) activeLabelColor else AppColors.appTextSecondary,
                        fontSize = labelFontSize,
                        fontWeight = if (active) FontWeight.SemiBold else FontWeight.Medium,
                        maxLines = 1,
                    )
                }
            }
        }
        trailing?.invoke(this)
    }
}

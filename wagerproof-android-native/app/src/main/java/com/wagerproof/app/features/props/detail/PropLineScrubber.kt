package com.wagerproof.app.features.props.detail

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.snapping.rememberSnapFlingBehavior
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.props.RollingNumber
import com.wagerproof.core.design.components.liquidGlassBackground
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.MLBPlayerProps
import com.wagerproof.core.models.MLBPlayerPropLineEntry
import kotlin.math.abs

/**
 * Permanent bottom line scrubber — a Liquid Glass bar that replaces the tab bar
 * on the prop detail page. The ladder of alternate lines is a hand-built
 * snap-to-tick horizontal scroll wheel ([LazyRow] + [rememberSnapFlingBehavior]
 * with symmetric half-width content padding, so a tick always settles centered
 * under the fixed appPrimary caret). Scrubbing drives everything upstream in
 * real time; the readout digits roll via the numericText transition.
 * Port of iOS `PropLineScrubber.swift`.
 */
@Composable
fun PropLineScrubber(
    lines: List<MLBPlayerPropLineEntry>,
    selectedLine: Double,
    onLineChange: (Double) -> Unit,
    modifier: Modifier = Modifier,
) {
    val activeEntry = lines.firstOrNull { it.line == selectedLine }
    val shape = RoundedCornerShape(28.dp)

    Column(
        modifier
            .padding(horizontal = 12.dp)
            .fillMaxWidth()
            .liquidGlassBackground(shape)
            .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.5f), shape)
            .padding(horizontal = 16.dp)
            .padding(top = 12.dp, bottom = 10.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        // Readout
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
            Column {
                Text("LINE", color = AppColors.appTextMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                RollingNumber(
                    value = MLBPlayerProps.formatLine(selectedLine),
                    fontSize = 22.sp,
                    color = AppColors.appTextPrimary,
                    fontWeight = FontWeight.Black,
                )
            }
            Spacer(Modifier.weight(1f))
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                OddsChip("O", activeEntry?.over, AppColors.appPrimary)
                OddsChip("U", activeEntry?.under, AppColors.appTextSecondary)
            }
        }

        Wheel(lines = lines, selectedLine = selectedLine, onLineChange = onLineChange)
    }
}

@Composable
private fun OddsChip(prefix: String, odds: Int?, tint: Color) {
    Row(
        Modifier
            .clip(CircleShape)
            .background(AppColors.appSurfaceMuted.copy(alpha = 0.5f))
            .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.5f), CircleShape)
            .padding(horizontal = 10.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(prefix, color = AppColors.appTextMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold)
        RollingNumber(
            value = MLBPlayerProps.formatOdds(odds),
            fontSize = 13.sp,
            color = tint,
            fontWeight = FontWeight.Black,
            fontFamily = FontFamily.Monospace,
        )
    }
}

private val TickWidth = 58.dp
private val WheelHeight = 54.dp

@Composable
private fun Wheel(
    lines: List<MLBPlayerPropLineEntry>,
    selectedLine: Double,
    onLineChange: (Double) -> Unit,
) {
    val haptics = LocalHapticFeedback.current
    val listState = rememberLazyListState()
    val fling = rememberSnapFlingBehavior(listState)

    // The tick nearest the viewport center is the selected line.
    val centeredIndex by remember {
        derivedStateOf {
            val info = listState.layoutInfo
            if (info.visibleItemsInfo.isEmpty()) return@derivedStateOf 0
            val center = (info.viewportStartOffset + info.viewportEndOffset) / 2f
            info.visibleItemsInfo.minByOrNull { abs((it.offset + it.size / 2f) - center) }?.index ?: 0
        }
    }

    // Scrub → upstream (live). Guarded so an external selection doesn't loop.
    LaunchedEffect(centeredIndex) {
        val line = lines.getOrNull(centeredIndex)?.line ?: return@LaunchedEffect
        if (line != selectedLine) {
            haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
            onLineChange(line)
        }
    }

    // External selection (initial line, per-market memory) → center that tick.
    LaunchedEffect(selectedLine) {
        val idx = lines.indexOfFirst { it.line == selectedLine }
        if (idx >= 0 && idx != centeredIndex && !listState.isScrollInProgress) {
            listState.animateScrollToItem(idx)
        }
    }

    BoxWithConstraints(Modifier.fillMaxWidth().height(WheelHeight)) {
        val sidePad = (maxWidth - TickWidth) / 2
        Box(Modifier.fillMaxWidth().height(WheelHeight)) {
            LazyRow(
                state = listState,
                flingBehavior = fling,
                contentPadding = PaddingValues(horizontal = if (sidePad > 0.dp) sidePad else 0.dp),
                horizontalArrangement = Arrangement.spacedBy(0.dp),
            ) {
                itemsIndexed(lines) { index, entry ->
                    val isCentered = index == centeredIndex
                    Tick(
                        entry = entry,
                        isCentered = isCentered,
                        onTap = {
                            haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                            onLineChange(entry.line)
                        },
                    )
                }
            }
            // Fixed center caret the wheel scrubs under.
            Box(
                Modifier
                    .align(Alignment.TopCenter)
                    .size(width = 3.dp, height = 16.dp)
                    .clip(CircleShape)
                    .background(AppColors.appPrimary),
            )
        }
    }
}

@Composable
private fun Tick(entry: MLBPlayerPropLineEntry, isCentered: Boolean, onTap: () -> Unit) {
    val scale by animateFloatAsState(if (isCentered) 1f else 0.78f, tween(200), label = "tickScale")
    val alpha = if (isCentered) 1f else 0.4f
    Column(
        Modifier
            .width(TickWidth)
            .height(WheelHeight)
            .clickable { onTap() }
            .padding(top = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Box(
            Modifier
                .width(2.dp)
                .height(if (isCentered) 22.dp else 14.dp)
                .clip(RoundedCornerShape(1.dp))
                .background(if (isCentered) AppColors.appPrimary else AppColors.appBorderStrong),
        )
        Text(
            MLBPlayerProps.formatLine(entry.line),
            color = if (isCentered) AppColors.appPrimary else AppColors.appTextSecondary.copy(alpha = alpha),
            fontSize = if (isCentered) 17.sp else 14.sp,
            fontWeight = if (isCentered) FontWeight.Black else FontWeight.SemiBold,
            modifier = Modifier.scale(scale),
        )
    }
}

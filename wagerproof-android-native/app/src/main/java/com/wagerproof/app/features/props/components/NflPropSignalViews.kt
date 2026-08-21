package com.wagerproof.app.features.props.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.NFLPropSignalDefinition
import com.wagerproof.core.models.NFLPropSignalDefinitions
import com.wagerproof.core.models.SignalPerformance
import com.wagerproof.core.models.SignalSeasonRecordDisplay

private val SignalOrange = Color(0xFFF97316)

/** Compact prop-signal rows shown beneath an NFL feed card when the market fired flags. */
@Composable
fun NFLPropSignalFeedStrip(flags: List<String>) {
    val signals = NFLPropSignalDefinitions.resolve(flags)
    if (signals.isEmpty()) return
    val actionable = signals.filter { !it.isAntiSignal }
    val anti = signals.filter { it.isAntiSignal }
    val shape = RoundedCornerShape(14.dp)

    Column(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(AppColors.appSurfaceElevated.copy(alpha = 0.55f))
            .border(0.6.dp, AppColors.appBorder.copy(alpha = 0.45f), shape)
            .padding(horizontal = 10.dp, vertical = 9.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Icon(AppIcon.BOLT_FILL.imageVector, null, tint = SignalOrange, modifier = Modifier.size(11.dp))
            Text(
                if (signals.size == 1) "1 Prop Signal" else "${signals.size} Prop Signals",
                color = SignalOrange, fontSize = 11.sp, fontWeight = FontWeight.Black,
            )
        }
        if (actionable.isNotEmpty()) SignalGroup("Supports this prop", actionable, muted = false)
        if (anti.isNotEmpty()) SignalGroup("Avoid this prop", anti, muted = true)
    }
}

@Composable
private fun SignalGroup(title: String, signals: List<NFLPropSignalDefinition>, muted: Boolean) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(title, color = if (muted) AppColors.appAccentAmber else AppColors.appTextMuted, fontSize = 9.sp, fontWeight = FontWeight.Black)
        signals.forEach { SignalCompactRow(it, muted) }
    }
}

@Composable
private fun SignalCompactRow(signal: NFLPropSignalDefinition, muted: Boolean) {
    val tint = if (muted) AppColors.appAccentAmber else AppColors.appAccentBlue
    val shape = RoundedCornerShape(10.dp)
    Row(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(tint.copy(alpha = if (muted) 0.12f else 0.16f))
            .border(0.8.dp, tint.copy(alpha = if (muted) 0.45f else 0.38f), shape)
            .padding(horizontal = 10.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(
            (if (muted) AppIcon.fromSystemName("exclamationmark.triangle.fill") else AppIcon.fromSystemName("info.circle.fill"))?.imageVector
                ?: AppIcon.INFO_CIRCLE_FILL.imageVector,
            null, tint = tint, modifier = Modifier.size(11.dp),
        )
        Column {
            Text(signal.displayName, color = tint, fontSize = 11.sp, fontWeight = FontWeight.Black, maxLines = 1)
            Text(signal.betDirection, color = tint.copy(alpha = 0.75f), fontSize = 9.sp, fontWeight = FontWeight.ExtraBold)
        }
    }
}

/** Detail-page variant: an adaptive grid of tappable signal buttons. */
@Composable
fun NFLPropSignalGroup(
    flags: List<String>,
    onSelect: (NFLPropSignalDefinition) -> Unit,
) {
    val signals = NFLPropSignalDefinitions.resolve(flags)
    if (signals.isEmpty()) return
    val actionable = signals.filter { !it.isAntiSignal }
    val anti = signals.filter { it.isAntiSignal }
    Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
        if (actionable.isNotEmpty()) SignalButtonGroup("Supports this prop", actionable, muted = false, onSelect)
        if (anti.isNotEmpty()) SignalButtonGroup("Avoid this prop", anti, muted = true, onSelect)
    }
}

@Composable
private fun SignalButtonGroup(
    title: String,
    signals: List<NFLPropSignalDefinition>,
    muted: Boolean,
    onSelect: (NFLPropSignalDefinition) -> Unit,
) {
    val color = if (muted) AppColors.appAccentAmber else AppColors.appAccentBlue
    Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
        Text(title, color = if (muted) AppColors.appAccentAmber else AppColors.appTextMuted, fontSize = 9.sp, fontWeight = FontWeight.Black)
        // Full-width stacked rows so titles like "Featured WR" aren't truncated.
        Column(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            signals.forEach { signal ->
                SignalButton(signal, muted, color, onSelect)
            }
        }
    }
}

@Composable
private fun SignalButton(
    signal: NFLPropSignalDefinition,
    muted: Boolean,
    color: Color,
    onSelect: (NFLPropSignalDefinition) -> Unit,
) {
    val shape = RoundedCornerShape(12.dp)
    Row(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(color.copy(alpha = if (muted) 0.10f else 0.14f))
            .border(1.dp, color.copy(alpha = if (muted) 0.45f else 0.38f), shape)
            .clickable { onSelect(signal) }
            .padding(horizontal = 12.dp, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(
            (if (muted) AppIcon.fromSystemName("exclamationmark.triangle.fill") else AppIcon.fromSystemName("info.circle.fill"))?.imageVector
                ?: AppIcon.INFO_CIRCLE_FILL.imageVector,
            null, tint = color, modifier = Modifier.size(13.dp),
        )
        Column(Modifier.weight(1f)) {
            Text(
                signal.displayName,
                color = color,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 2,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(signal.betDirection, color = color.copy(alpha = 0.78f), fontSize = 11.sp, fontWeight = FontWeight.ExtraBold)
            }
        }
        Icon(
            AppIcon.CHEVRON_RIGHT.imageVector,
            null,
            tint = color.copy(alpha = 0.85f),
            modifier = Modifier.size(14.dp),
        )
    }
}

/**
 * THE prop-signal sheet — renders BOTH the all-time backtest hit
 * (`signal.typicalHit`) AND the season-to-date record ([SignalSeasonRecordDisplay]),
 * kept visually separate. Port of iOS `NFLPropSignalDetailSheet`.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NFLPropSignalDetailSheet(
    signal: NFLPropSignalDefinition,
    seasonRecord: SignalPerformance?,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = AppColors.appSurface,
    ) {
        Column(
            Modifier
                .verticalScroll(rememberScrollState())
                .padding(20.dp)
                .padding(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(signal.displayName, color = AppColors.appTextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Black)
            if (signal.oneLiner.isNotEmpty()) {
                Text(signal.oneLiner, color = AppColors.appTextSecondary, fontSize = 14.sp, fontWeight = FontWeight.Medium)
            }
            SignalBlock("Definition", signal.definition)
            SignalBlock("Why It Works", signal.whyItWorks)
            SignalBlock("Bet Direction", signal.betDirection)
            SignalPerformanceStats(backtestHit = signal.typicalHit, seasonDisplay = SignalSeasonRecordDisplay(seasonRecord))
            if (signal.isAntiSignal) {
                Text(
                    "This is an anti-signal — the backtest says to avoid betting this market when it fires.",
                    color = AppColors.appAccentAmber, fontSize = 13.sp, fontWeight = FontWeight.Medium,
                )
            }
        }
    }
}

@Composable
private fun SignalBlock(title: String, body: String) {
    if (body.isEmpty()) return
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(title.uppercase(), color = AppColors.appTextMuted, fontSize = 10.sp, fontWeight = FontWeight.Black)
        Text(body, color = AppColors.appTextPrimary, fontSize = 14.sp)
    }
}

/**
 * The all-time backtest hit and the season-to-date record, side by side but
 * clearly separated (see memory: keep the two signal records distinct).
 */
@Composable
private fun SignalPerformanceStats(backtestHit: String?, seasonDisplay: SignalSeasonRecordDisplay) {
    val shape = RoundedCornerShape(14.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(AppColors.appSurfaceElevated)
            .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.5f), shape)
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text("ALL-TIME BACKTEST", color = AppColors.appTextMuted, fontSize = 10.sp, fontWeight = FontWeight.Black)
            Text(
                backtestHit ?: "—",
                color = AppColors.appTextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold,
            )
        }
        Box(Modifier.fillMaxWidth().height(0.5.dp).background(AppColors.appBorder.copy(alpha = 0.5f)))
        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text("THIS SEASON", color = AppColors.appTextMuted, fontSize = 10.sp, fontWeight = FontWeight.Black)
            val toneColor = when (seasonDisplay.tone) {
                SignalSeasonRecordDisplay.Tone.POSITIVE -> AppColors.appWin
                SignalSeasonRecordDisplay.Tone.NEGATIVE -> AppColors.appLoss
                SignalSeasonRecordDisplay.Tone.NEUTRAL -> AppColors.appTextPrimary
                SignalSeasonRecordDisplay.Tone.EMPTY -> AppColors.appTextMuted
            }
            Text(seasonDisplay.detail, color = toneColor, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            if (seasonDisplay.isSmallSample) {
                Text("Small sample — read with caution.", color = AppColors.appTextMuted, fontSize = 11.sp)
            }
        }
    }
}

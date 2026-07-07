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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import com.wagerproof.app.features.props.NFLPlayerPropSelection
import com.wagerproof.app.features.props.NFLPropFeedItem
import com.wagerproof.app.features.props.PropsFormatting
import com.wagerproof.app.features.props.nflTeamColors
import com.wagerproof.app.features.shared.InitialsDisc
import com.wagerproof.app.features.shared.RemoteImage
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.NFLPlayerProps
import com.wagerproof.core.models.NFLPropMarket
import com.wagerproof.core.models.NFLPropPlayer
import com.wagerproof.core.models.NFLPropSignalDefinition
import com.wagerproof.core.models.NFLPropSignalDefinitions
import com.wagerproof.core.models.NFLTeamAssets
import com.wagerproof.core.models.NFLTeams
import com.wagerproof.core.models.SignalPerformance
import com.wagerproof.core.models.SignalSeasonRecordDisplay

private val SignalOrange = Color(0xFFF97316)

/**
 * NFL player-prop feed card — port of iOS `NFLPropPlayerCard.swift`. Mirrors
 * [PropPlayerCard]'s chrome; anytime-TD markets render a single yes-price pill
 * with an implied-probability caption instead of O/U pills. Appends a compact
 * prop-signal strip when the displayed market fired P-flags.
 */
@Composable
fun NflPropPlayerCard(
    item: NFLPropFeedItem,
    onSelect: (NFLPlayerPropSelection) -> Unit,
    modifier: Modifier = Modifier,
) {
    val haptics = LocalHapticFeedback.current
    val player = item.player
    val headline: NFLPropMarket? = item.displayMarket
    val (primary, secondary) = nflTeamColors(player.team ?: "")
    val shape = RoundedCornerShape(26.dp)

    Column(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .background(AppColors.appSurfaceElevated.copy(alpha = 0.55f))
            .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.5f), shape)
            .clickable {
                haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                onSelect(item.selection)
            }
            .padding(start = 12.dp, end = 14.dp, top = 9.dp, bottom = 9.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            PropTeamAvatarNFL(
                content = {
                    NFLPlayerHeadshot(player.playerName, player.playerId, player.headshotUrl, 40.dp)
                },
                teamLogoUrl = player.team?.let { NFLTeamAssets.logo(it) },
                primary = primary,
                secondary = secondary,
            )
            Spacer(Modifier.width(10.dp))
            Column {
                Text(player.playerName, color = AppColors.appTextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                Text(subtitle(player), color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Medium, maxLines = 1)
            }
            Spacer(Modifier.weight(1f))
            OverUnderBlock(headline)
            Spacer(Modifier.width(10.dp))
            Column(horizontalAlignment = Alignment.End) {
                Text("L10 TREND", color = AppColors.appTextMuted, fontSize = 8.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(3.dp))
                RecentFormStrip(
                    strip = headline?.miniStrip?.map { FormBar(it.cleared, it.value) } ?: emptyList(),
                    line = headline?.clearThreshold ?: 1.0,
                    modifier = Modifier.size(74.dp, 46.dp),
                )
            }
        }

        Box(Modifier.fillMaxWidth().height(0.5.dp).background(AppColors.appBorder.copy(alpha = 0.5f)))

        Row(verticalAlignment = Alignment.CenterVertically) {
            InfoItem(item.metricLabel, headline?.label ?: "-", AppColors.appPrimary)
            Spacer(Modifier.width(16.dp))
            InfoItem("L10", l10Label(headline), AppColors.appTextPrimary)
            Spacer(Modifier.width(16.dp))
            InfoItem("HIT", hitLabel(headline), hitColorNfl(headline))
            Spacer(Modifier.weight(1f))
            TimePill(player.slotLabel ?: PropsFormatting.dateLabel(player.gameDate))
        }

        val flags = headline?.flags
        if (!flags.isNullOrEmpty()) {
            NFLPropSignalFeedStrip(flags)
        }
    }
}

private fun subtitle(player: NFLPropPlayer): String {
    val opp = player.opponentLabel
    val pos = player.position
    return if (!pos.isNullOrEmpty()) {
        if (opp.isEmpty()) pos else "$pos · $opp"
    } else {
        opp
    }
}

@Composable
private fun OverUnderBlock(headline: NFLPropMarket?) {
    if (headline?.isYesNo == true) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
            OuPill("TD", "", NFLPlayerProps.formatOdds(headline.overPrice), AppColors.appPrimary)
            headline.closeYesProb?.let { p ->
                Text("${NFLPlayerProps.formatPct(p)} implied", color = AppColors.appTextMuted, fontSize = 9.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    } else {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
            OuPill("O", NFLPlayerProps.formatLine(headline?.closeLine), NFLPlayerProps.formatOdds(headline?.overPrice), AppColors.appPrimary)
            OuPill("U", NFLPlayerProps.formatLine(headline?.closeLine), NFLPlayerProps.formatOdds(headline?.underPrice), AppColors.appTextSecondary)
        }
    }
}

private fun l10Label(headline: NFLPropMarket?): String {
    val m = headline ?: return "-"
    val (hits, n) = m.l10Hits
    if (n <= 0) return "-"
    return "$hits/$n Over"
}

private fun hitLabel(headline: NFLPropMarket?): String {
    val rate = headline?.l10HitRate ?: return "-"
    return "${Math.round(rate * 100).toInt()}%"
}

private fun hitColorNfl(headline: NFLPropMarket?): Color {
    val rate = headline?.l10HitRate ?: return AppColors.appTextMuted
    val pct = rate * 100
    return when {
        pct >= 70 -> AppColors.appPrimary
        pct >= 55 -> Color(0xFFEAB308)
        else -> AppColors.appTextSecondary
    }
}

// MARK: - Prop signal UI (P-flags)

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
        // Two-column grid approximates iOS's adaptive(min:118) layout.
        val rows = signals.chunked(2)
        rows.forEach { pair ->
            Row(horizontalArrangement = Arrangement.spacedBy(7.dp), modifier = Modifier.fillMaxWidth()) {
                pair.forEach { signal ->
                    Box(Modifier.weight(1f)) { SignalButton(signal, muted, color, onSelect) }
                }
                if (pair.size == 1) Spacer(Modifier.weight(1f))
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
            .background(color.copy(alpha = if (muted) 0.12f else 0.18f))
            .border(1.1.dp, color.copy(alpha = if (muted) 0.55f else 0.46f), shape)
            .clickable { onSelect(signal) }
            .padding(start = 10.dp, end = 7.dp, top = 8.dp, bottom = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(
            (if (muted) AppIcon.fromSystemName("exclamationmark.triangle.fill") else AppIcon.fromSystemName("info.circle.fill"))?.imageVector
                ?: AppIcon.INFO_CIRCLE_FILL.imageVector,
            null, tint = color, modifier = Modifier.size(12.dp),
        )
        Column(Modifier.weight(1f)) {
            Text(signal.displayName, color = color, fontSize = 11.sp, fontWeight = FontWeight.Black, maxLines = 1)
            Text(signal.betDirection, color = color.copy(alpha = 0.72f), fontSize = 8.sp, fontWeight = FontWeight.ExtraBold, maxLines = 1)
        }
        Box(
            Modifier.size(18.dp).clip(CircleShape).background(color),
            contentAlignment = Alignment.Center,
        ) {
            Icon(AppIcon.CHEVRON_UP_FORWARD.imageVector, null, tint = AppColors.appSurface, modifier = Modifier.size(9.dp))
        }
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

/**
 * NFL headshot with an initials-disc fallback. Prefers `headshotUrl`; otherwise
 * the numeric ESPN id, else initials. Port of iOS `NFLPlayerHeadshot`.
 */
@Composable
fun NFLPlayerHeadshot(
    playerName: String,
    playerId: String?,
    headshotUrl: String?,
    size: androidx.compose.ui.unit.Dp,
) {
    val url = headshotUrl ?: NFLTeams.headshotUrl(playerId)
    val initials = playerName.split(" ").mapNotNull { it.firstOrNull() }.take(2).joinToString("").uppercase()
    Box(Modifier.size(size).clip(CircleShape), contentAlignment = Alignment.Center) {
        RemoteImage(
            url = url,
            contentDescription = playerName,
            modifier = Modifier.size(size),
            contentScale = ContentScale.Crop,
            loading = { InitialsDisc(initials, size) },
            error = { InitialsDisc(initials, size) },
        )
    }
}

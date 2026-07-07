package com.wagerproof.app.features.props

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.props.components.PlayerHeadshot
import com.wagerproof.app.features.shared.InitialsDisc
import com.wagerproof.app.features.shared.RemoteImage
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.MLBPlayerPropBestPick
import com.wagerproof.core.models.MLBPlayerPropGrade
import com.wagerproof.core.models.MLBPlayerPropGradeSummary
import com.wagerproof.core.models.MLBPlayerPropPerformanceFormatting
import com.wagerproof.core.models.MLBPlayerPropPerformanceTotals
import com.wagerproof.core.models.MLBPlayerPropPickResult
import com.wagerproof.core.models.MLBPlayerPropPickTier
import com.wagerproof.core.models.MLBPlayerPropTierSummary
import com.wagerproof.core.models.MLBPlayerProps
import com.wagerproof.core.models.MLBTeams
import com.wagerproof.core.services.MLBPlayerPropsService
import com.wagerproof.core.stores.LoadState
import com.wagerproof.core.stores.MLBPlayerPropPicksStore
import com.wagerproof.core.stores.PropsStore
import kotlinx.coroutines.launch

/**
 * Best MLB player-props hub — today's AI-ranked picks + graded performance.
 * Port of iOS `MLBBestPicksView.swift`. Tapping a pick resolves its detail
 * payload (3-level fallback) and opens `PlayerPropDetailScreen` on the pick's
 * line.
 */
@Composable
fun MlbBestPicksScreen(
    store: MLBPlayerPropPicksStore,
    propsStore: PropsStore,
    onOpenDetail: (PlayerPropSelection, Double?) -> Unit,
    onBack: () -> Unit,
) {
    BackHandler(onBack = onBack)
    val scope = rememberCoroutineScope()
    var segment by remember { mutableStateOf(Segment.PERFORMANCE) }
    var resolvingPickId by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        if (store.loadState is LoadState.Idle) store.refresh()
        propsStore.refreshMLB()
    }

    Column(Modifier.fillMaxSize().background(AppColors.appSurface)) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(Modifier.size(36.dp).clip(CircleShape).clickable(onClick = onBack), contentAlignment = Alignment.Center) {
                Icon(AppIcon.CHEVRON_LEFT.imageVector, "Back", tint = AppColors.appTextPrimary, modifier = Modifier.size(18.dp))
            }
            Text("Best MLB Props", color = AppColors.appTextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Bold)
        }

        Column(
            Modifier.verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            HeaderCard()
            SegmentPicker(segment) { segment = it }

            val ls = store.loadState
            val empty = store.summary.isEmpty() && store.todaysPicks.isEmpty()
            when {
                (ls is LoadState.Idle || ls is LoadState.Loading) && empty -> LoadingPlaceholder()
                ls is LoadState.Failed && empty -> ErrorState(ls.message) { scope.launch { store.refresh(force = true) } }
                else -> when (segment) {
                    Segment.PERFORMANCE -> PerformanceContent(store)
                    Segment.TODAYS_PICKS -> TodaysPicksContent(
                        store = store,
                        resolvingPickId = resolvingPickId,
                        onPick = { pick ->
                            if (resolvingPickId != null) return@TodaysPicksContent
                            scope.launch {
                                resolvingPickId = pick.id
                                try {
                                    val sel = resolvePick(pick, propsStore)
                                    if (sel != null) onOpenDetail(sel, pick.line)
                                } finally {
                                    resolvingPickId = null
                                }
                            }
                        },
                    )
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

private enum class Segment(val label: String) {
    PERFORMANCE("Performance"),
    TODAYS_PICKS("Today's Picks"),
}

private suspend fun resolvePick(pick: MLBPlayerPropBestPick, propsStore: PropsStore): PlayerPropSelection? {
    PlayerPropFeed.selection(pick, propsStore.matchups)?.let { return it }
    propsStore.refreshMLB(force = true)
    PlayerPropFeed.selection(pick, propsStore.matchups)?.let { return it }
    val rows = runCatching { MLBPlayerPropsService.shared.fetchProps(pick.gamePk) }.getOrNull() ?: return null
    return PlayerPropFeed.selection(
        pick = pick,
        props = rows,
        officialDate = pick.reportDate,
        gameTimeEt = propsStore.matchups.firstOrNull { it.gamePk == pick.gamePk }?.gameTimeEt,
    )
}

@Composable
private fun HeaderCard() {
    Column(
        Modifier
            .fillMaxWidth()
            .background(AppColors.appSurfaceElevated, RoundedCornerShape(16.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Icon(AppIcon.SPARKLES.imageVector, null, tint = AppColors.appPrimary, modifier = Modifier.size(16.dp))
            Text("Algorithm Best Picks", color = AppColors.appTextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Black)
        }
        Text(
            "Ranked props combining L10 hit rate, day/night splits, opposing archetype, and recent form. Stakes: Lean 0.5u · Strong 1.0u · Elite 1.5u.",
            color = AppColors.appTextSecondary, fontSize = 13.sp,
        )
    }
}

@Composable
private fun SegmentPicker(active: Segment, onSelect: (Segment) -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).background(AppColors.appSurfaceMuted.copy(alpha = 0.6f)).padding(2.dp),
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Segment.entries.forEach { seg ->
            val selected = seg == active
            Box(
                Modifier.weight(1f).clip(RoundedCornerShape(6.dp))
                    .background(if (selected) AppColors.appSurfaceElevated else Color.Transparent)
                    .clickable { onSelect(seg) }.padding(vertical = 8.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(seg.label, color = if (selected) AppColors.appTextPrimary else AppColors.appTextSecondary, fontSize = 13.sp, fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium)
            }
        }
    }
}

// MARK: - Performance

@Composable
private fun PerformanceContent(store: MLBPlayerPropPicksStore) {
    val overall = store.overall
    if (overall.settled == 0 && store.summary.isEmpty()) {
        EmptyCard("No graded picks yet", "Picks lock when games start; results populate after games settle.")
        return
    }
    KpiGrid(overall)
    store.tierGroups.forEach { TierSection(it) }
    if (store.recentHistory.isNotEmpty()) HistorySection(store.recentHistory)
}

@Composable
private fun KpiGrid(overall: MLBPlayerPropPerformanceTotals) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            KpiTile("Settled", "${overall.settled}", "${overall.won}-${overall.lost}-${overall.push} W-L-P", AppColors.appTextPrimary, Modifier.weight(1f))
            KpiTile("Win Rate", MLBPlayerPropPerformanceFormatting.formatPct(overall.winPct), "excludes pushes", AppColors.appTextPrimary, Modifier.weight(1f))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            KpiTile("Units Won", MLBPlayerPropPerformanceFormatting.formatUnits(overall.unitsWon), "on ${MLBPlayerPropPerformanceFormatting.formatUnits(overall.unitsStaked, signed = false)} staked", unitsColor(overall.unitsWon), Modifier.weight(1f))
            KpiTile("ROI", MLBPlayerPropPerformanceFormatting.formatPct(overall.roiPct), "units ÷ stake", unitsColor(overall.unitsWon), Modifier.weight(1f))
        }
    }
}

@Composable
private fun KpiTile(title: String, value: String, sub: String, valueColor: Color, modifier: Modifier) {
    Column(
        modifier.background(AppColors.appSurfaceElevated, RoundedCornerShape(14.dp)).padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(title.uppercase(), color = AppColors.appTextSecondary, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
        Text(value, color = valueColor, fontSize = 22.sp, fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace)
        Text(sub, color = AppColors.appTextMuted, fontSize = 11.sp, maxLines = 2)
    }
}

@Composable
private fun TierSection(group: MLBPlayerPropTierSummary) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
            Text("${group.tier.emoji} ${group.tier.label}", color = AppColors.appTextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.weight(1f))
            Text(
                "${group.totals.settled} settled · ${MLBPlayerPropPerformanceFormatting.formatUnits(group.totals.unitsWon)} · ${MLBPlayerPropPerformanceFormatting.formatPct(group.totals.roiPct)} ROI",
                color = AppColors.appTextSecondary, fontSize = 11.sp, textAlign = TextAlign.End,
            )
        }
        Column(
            Modifier.fillMaxWidth().background(AppColors.appSurfaceElevated, RoundedCornerShape(14.dp)).border(0.5.dp, AppColors.appBorder.copy(alpha = 0.35f), RoundedCornerShape(14.dp)),
        ) {
            MarketHeaderRow()
            group.markets.forEachIndexed { i, row ->
                MarketRow(row)
                if (i != group.markets.lastIndex) {
                    Box(Modifier.fillMaxWidth().height(0.5.dp).background(AppColors.appBorder.copy(alpha = 0.35f)))
                }
            }
        }
    }
}

private val ColWlp = 46.dp
private val ColUnits = 54.dp
private val ColRoi = 62.dp

@Composable
private fun MarketHeaderRow() {
    Row(
        Modifier.fillMaxWidth().background(AppColors.appSurfaceMuted.copy(alpha = 0.35f)).padding(horizontal = 12.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        HeaderCell("MARKET", Modifier.weight(1f), TextAlign.Start)
        HeaderCell("W-L-P", Modifier.width(ColWlp), TextAlign.End)
        HeaderCell("UNITS", Modifier.width(ColUnits), TextAlign.End)
        HeaderCell("ROI", Modifier.width(ColRoi), TextAlign.End)
    }
}

@Composable
private fun HeaderCell(text: String, modifier: Modifier, align: TextAlign) {
    Text(text, color = AppColors.appTextMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold, textAlign = align, modifier = modifier)
}

@Composable
private fun MarketRow(row: MLBPlayerPropGradeSummary) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(MLBPlayerProps.marketEmoji(row.market), fontSize = 12.sp)
            Text(row.marketLabel, color = AppColors.appTextPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
        }
        Text("${row.picksWon}-${row.picksLost}-${row.picksPush}", color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Medium, fontFamily = FontFamily.Monospace, textAlign = TextAlign.End, modifier = Modifier.width(ColWlp))
        Text(MLBPlayerPropPerformanceFormatting.formatUnits(row.unitsWon), color = unitsColor(row.unitsWon), fontSize = 11.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, textAlign = TextAlign.End, modifier = Modifier.width(ColUnits))
        Text(MLBPlayerPropPerformanceFormatting.formatPct(row.roiPct), color = unitsColor(row.unitsWon), fontSize = 11.sp, fontWeight = FontWeight.SemiBold, fontFamily = FontFamily.Monospace, textAlign = TextAlign.End, modifier = Modifier.width(ColRoi))
    }
}

@Composable
private fun HistorySection(history: List<MLBPlayerPropGrade>) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Recent Graded Picks", color = AppColors.appTextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Bold)
        history.forEach { HistoryRow(it) }
    }
}

@Composable
private fun HistoryRow(grade: MLBPlayerPropGrade) {
    Column(
        Modifier.fillMaxWidth().background(AppColors.appSurfaceElevated, RoundedCornerShape(14.dp)).padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            PlayerAvatar(grade.playerId, grade.teamName, 40.dp, 18.dp)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(grade.playerName ?: "Player", color = AppColors.appTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                grade.teamName?.takeIf { it.isNotEmpty() }?.let {
                    Text(it, color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Medium, maxLines = 1)
                }
                Text(grade.reportDate, color = AppColors.appTextMuted, fontSize = 11.sp)
            }
            ResultBadge(grade.result)
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(MLBPlayerProps.marketEmoji(grade.market), fontSize = 13.sp)
            Text(
                "${grade.marketLabel ?: MLBPlayerProps.marketLabel(grade.market)} ${if (grade.side == "under") "U" else "O"} ${MLBPlayerProps.formatLine(grade.line)}",
                color = AppColors.appTextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Medium,
            )
            grade.tier?.let { tier ->
                Text(
                    "${tier.emoji} ${tier.label}",
                    color = AppColors.appPrimary, fontSize = 10.sp, fontWeight = FontWeight.Bold,
                    modifier = Modifier.clip(CircleShape).background(AppColors.appPrimary.copy(alpha = 0.12f)).padding(horizontal = 6.dp, vertical = 3.dp),
                )
            }
        }
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            grade.actualValue?.let {
                Text("Actual: ${MLBPlayerProps.formatBarValue(it)}", color = AppColors.appTextMuted, fontSize = 11.sp)
            }
            Spacer(Modifier.weight(1f))
            Text(MLBPlayerPropPerformanceFormatting.formatUnits(grade.unitsWon), color = unitsColor(grade.unitsWon), fontSize = 13.sp, fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace)
        }
    }
}

// MARK: - Today's picks

@Composable
private fun TodaysPicksContent(
    store: MLBPlayerPropPicksStore,
    resolvingPickId: String?,
    onPick: (MLBPlayerPropBestPick) -> Unit,
) {
    if (store.todaysPicks.isEmpty()) {
        EmptyCard("No qualified picks right now", "The slate may not have enough sample yet — check back closer to first pitch.")
        return
    }
    if (store.batterPicks.isNotEmpty()) PicksSection("🥎 Batter Picks", store.batterPicks, resolvingPickId, onPick)
    if (store.pitcherPicks.isNotEmpty()) PicksSection("⚾ Pitcher Picks", store.pitcherPicks, resolvingPickId, onPick)
}

@Composable
private fun PicksSection(title: String, picks: List<MLBPlayerPropBestPick>, resolvingPickId: String?, onPick: (MLBPlayerPropBestPick) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(title, color = AppColors.appTextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Bold)
        picks.forEach { PickCard(it, resolvingPickId == it.id, onPick) }
    }
}

@Composable
private fun PickCard(pick: MLBPlayerPropBestPick, resolving: Boolean, onPick: (MLBPlayerPropBestPick) -> Unit) {
    val shape = RoundedCornerShape(16.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(tierBackground(pick.tier))
            .border(1.dp, tierBorder(pick.tier), shape)
            .clickable(enabled = !resolving) { onPick(pick) }
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            PlayerAvatar(pick.playerId, pick.teamName, 52.dp, 22.dp)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    TierPill(pick.tier, pick.score)
                    if (pick.locked) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                            Icon(AppIcon.LOCK_FILL.imageVector, null, tint = AppColors.appTextSecondary, modifier = Modifier.size(9.dp))
                            Text("Locked", color = AppColors.appTextSecondary, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                    if (resolving) CircularProgressIndicator(strokeWidth = 2.dp, modifier = Modifier.size(14.dp))
                }
                Text(pick.playerName, color = AppColors.appTextPrimary, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                Text(
                    "${pick.teamName ?: ""} · ${pick.gameLabel} · ${if (pick.isDay) "☀️ Day" else "🌙 Night"}",
                    color = AppColors.appTextSecondary, fontSize = 11.sp, maxLines = 2,
                )
            }
            Icon(AppIcon.CHEVRON_RIGHT.imageVector, null, tint = AppColors.appTextMuted, modifier = Modifier.size(13.dp))
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("${MLBPlayerProps.marketEmoji(pick.market)} ${pick.marketLabel}", color = AppColors.appTextPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            Text(
                "${if (pick.side == "over") "Over" else "Under"} ${MLBPlayerProps.formatLine(pick.line)} ${MLBPlayerProps.formatOdds(if (pick.side == "over") pick.overOdds else pick.underOdds)}",
                color = AppColors.appPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold,
            )
            Spacer(Modifier.weight(1f))
            val pct = pick.l10Pct
            val over = pick.l10Over
            val games = pick.l10Games
            if (pct != null && over != null && games != null) {
                Text("$pct% L10 · $over/$games", color = AppColors.appPrimary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
            }
        }
        if (pick.rationale.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                pick.rationale.take(3).forEach { line ->
                    Text("• $line", color = AppColors.appTextSecondary, fontSize = 11.sp)
                }
            }
        }
    }
}

@Composable
private fun TierPill(tier: MLBPlayerPropPickTier, score: Int) {
    val bg = when (tier) {
        MLBPlayerPropPickTier.ELITE -> AppColors.appPrimary
        MLBPlayerPropPickTier.STRONG -> AppColors.appPrimary.copy(alpha = 0.85f)
        MLBPlayerPropPickTier.LEAN -> AppColors.appSurfaceMuted
    }
    val fg = if (tier == MLBPlayerPropPickTier.LEAN) AppColors.appTextPrimary else Color.White
    Text(
        "${tier.emoji} ${tier.label.uppercase()} · $score",
        color = fg, fontSize = 10.sp, fontWeight = FontWeight.Black,
        modifier = Modifier.clip(CircleShape).background(bg).padding(horizontal = 8.dp, vertical = 4.dp),
    )
}

// MARK: - Shared

@Composable
private fun PlayerAvatar(playerId: Int, teamName: String?, headshotSize: androidx.compose.ui.unit.Dp, badgeSize: androidx.compose.ui.unit.Dp) {
    val team = teamName ?: ""
    val teamInfo = if (team.isEmpty()) null else MLBTeams.info(team)
    val frame = headshotSize + 8.dp
    Box(Modifier.size(frame), contentAlignment = Alignment.Center) {
        PlayerHeadshot(playerId = playerId, size = headshotSize, modifier = Modifier.align(Alignment.TopStart).padding(2.dp))
        Box(
            Modifier.align(Alignment.BottomEnd).size(badgeSize).clip(CircleShape).background(AppColors.appSurfaceMuted).border(1.5.dp, AppColors.appSurfaceElevated, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            RemoteImage(
                url = teamInfo?.logoUrl,
                contentDescription = team,
                modifier = Modifier.size(badgeSize),
                contentScale = ContentScale.Fit,
                error = { InitialsDisc((teamInfo?.team ?: team.take(3)).uppercase(), badgeSize) },
            )
        }
    }
}

@Composable
private fun ResultBadge(result: MLBPlayerPropPickResult?) {
    val color = when (result) {
        MLBPlayerPropPickResult.WON -> AppColors.appWin
        MLBPlayerPropPickResult.LOST -> AppColors.appLoss
        else -> AppColors.appTextMuted
    }
    Text(
        (result?.raw ?: "—").uppercase(),
        color = color, fontSize = 10.sp, fontWeight = FontWeight.Black,
        modifier = Modifier.clip(CircleShape).background(color.copy(alpha = 0.12f)).padding(horizontal = 8.dp, vertical = 4.dp),
    )
}

@Composable
private fun EmptyCard(title: String, subtitle: String) {
    Column(
        Modifier.fillMaxWidth().background(AppColors.appSurfaceElevated, RoundedCornerShape(16.dp)).padding(horizontal = 16.dp, vertical = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(title, color = AppColors.appTextPrimary, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
        Text(subtitle, color = AppColors.appTextSecondary, fontSize = 12.sp, textAlign = TextAlign.Center)
    }
}

@Composable
private fun LoadingPlaceholder() {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        repeat(3) {
            Box(Modifier.fillMaxWidth().height(72.dp).clip(RoundedCornerShape(14.dp)).background(AppColors.appSurfaceMuted.copy(alpha = 0.5f)))
        }
    }
}

@Composable
private fun ErrorState(message: String, onRetry: () -> Unit) {
    Column(
        Modifier.fillMaxWidth().padding(vertical = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(AppIcon.EXCLAMATION_TRIANGLE.imageVector, null, tint = AppColors.appLoss, modifier = Modifier.size(36.dp))
        Text("Couldn't load", color = AppColors.appTextPrimary, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
        Text(message, color = AppColors.appTextSecondary, fontSize = 13.sp, textAlign = TextAlign.Center)
        Box(
            Modifier.clip(RoundedCornerShape(10.dp)).background(AppColors.appPrimary).clickable(onClick = onRetry).padding(horizontal = 20.dp, vertical = 10.dp),
        ) {
            Text("Retry", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

private fun unitsColor(value: Double?): Color {
    if (value == null || !value.isFinite()) return AppColors.appTextMuted
    return when {
        value > 0 -> AppColors.appWin
        value < 0 -> AppColors.appLoss
        else -> AppColors.appTextMuted
    }
}

private fun tierBackground(tier: MLBPlayerPropPickTier): Color = when (tier) {
    MLBPlayerPropPickTier.ELITE -> AppColors.appPrimary.copy(alpha = 0.1f)
    MLBPlayerPropPickTier.STRONG -> AppColors.appPrimary.copy(alpha = 0.05f)
    MLBPlayerPropPickTier.LEAN -> AppColors.appSurfaceElevated
}

private fun tierBorder(tier: MLBPlayerPropPickTier): Color = when (tier) {
    MLBPlayerPropPickTier.ELITE -> AppColors.appPrimary.copy(alpha = 0.55f)
    MLBPlayerPropPickTier.STRONG -> AppColors.appPrimary.copy(alpha = 0.3f)
    MLBPlayerPropPickTier.LEAN -> AppColors.appBorder.copy(alpha = 0.45f)
}

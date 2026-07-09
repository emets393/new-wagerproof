package com.wagerproof.app.features.cfb

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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.components.CollapsingWidgetScroll
import com.wagerproof.app.features.components.TeamAuraBackground
import com.wagerproof.app.features.components.WidgetCollapsingSection
import com.wagerproof.app.features.components.polymarket.PolymarketWidget
import com.wagerproof.app.features.gamecards.CFBTeamColors
import com.wagerproof.app.features.gamecards.GameCardFormatting
import com.wagerproof.app.features.gamecards.GameCardTeamAvatar
import com.wagerproof.app.features.gamecards.SportsbookLogoStyle
import com.wagerproof.app.features.gamecards.SportsbookLogoView
import com.wagerproof.app.features.gamewidgets.SignalPerformanceStatsSection
import com.wagerproof.app.features.paywall.ProContentSection
import com.wagerproof.app.features.agents.components.AgentPickRationaleWidget
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.CFBDryRunFlag
import com.wagerproof.core.models.CFBPrediction
import com.wagerproof.core.models.CFBSignalDefinition
import com.wagerproof.core.models.CFBTeamAssets
import com.wagerproof.core.services.CFBSignalDefinitionsService
import com.wagerproof.core.services.SignalPerformanceService
import com.wagerproof.core.services.SignalSport
import com.wagerproof.core.models.SignalPerformance
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import java.util.Locale
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

private val MammothTint = Color(0xFFF97316)
private val MammothGold = Color(0xFFFACC15)

/**
 * CFB Week-7 dry-run detail page: custom collapsing hero + a seven-market bet
 * board enriched by `cfb_dryrun_picks` plus model flags. Port of iOS
 * `CFBGameBottomSheet`: posted recommendations, best-book lines, pick-level
 * conviction, and synthetic signal-key rows override the merged-game fallback.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CFBGameDetailPage(
    game: CFBPrediction,
    topInset: Dp,
    bottomInset: Dp,
) {
    val awayColors = remember(game.awayTeam) { CFBTeamColors.colorPair(game.awayTeam) }
    val homeColors = remember(game.homeTeam) { CFBTeamColors.colorPair(game.homeTeam) }

    var signalDefs by remember { mutableStateOf<Map<String, CFBSignalDefinition>>(emptyMap()) }
    var trendsByTeam by remember { mutableStateOf<Map<String, CFBTeamTrendRow>>(emptyMap()) }
    var perfByKey by remember { mutableStateOf<Map<String, SignalPerformance>>(emptyMap()) }
    var dryRunPicks by remember(game.gameId) { mutableStateOf<List<CFBDryrunPickRow>>(emptyList()) }

    var selectedSignal by remember { mutableStateOf<CFBDryRunFlag?>(null) }
    var selectedTrend by remember { mutableStateOf<TrendDetailSelection?>(null) }

    LaunchedEffect(game.gameId) {
        coroutineScope {
            val defs = async { CFBSignalDefinitionsService.shared.definitionsBySource() }
            val trends = async { loadTeamTrends(game) }
            val performance = async { SignalPerformanceService.shared.performances(SignalSport.CFB, game.season ?: 2025) }
            val picks = async {
                if ((game.runId ?: "").contains("dryrun", ignoreCase = true)) {
                    loadCFBDryrunPicksResult(game.gameId)
                } else null
            }
            signalDefs = defs.await()
            trendsByTeam = trends.await()
            perfByKey = performance.await()
            picks.await()?.onSuccess { dryRunPicks = it }
        }
    }

    val rows = remember(game.gameId) { buildMarketRows(game) }

    CollapsingWidgetScroll(
        heroMaxHeight = 238.dp,
        heroMinHeight = 124.dp,
        transparentPage = true,
        heroTopInset = topInset,
        bottomInset = bottomInset,
        background = { progress ->
            TeamAuraBackground(awayColors.primary, homeColors.primary, progress)
        },
        hero = { progress ->
            CFBHero(game, awayColors, homeColors, progress)
        },
    ) {
        item {
            WidgetCollapsingSection(
                title = "Market Odds",
                icon = AppIcon.fromSystemName("chart.bar.fill"),
                iconTint = AppColors.appPrimary,
            ) {
                PolymarketWidget(
                    league = "cfb",
                    awayTeam = game.awayTeam,
                    homeTeam = game.homeTeam,
                    awayColors = awayColors,
                    homeColors = homeColors,
                    awayAbbr = CFBTeamAssets.abbr(game.awayTeam),
                    homeAbbr = CFBTeamAssets.abbr(game.homeTeam),
                )
            }
        }

        item {
            WidgetCollapsingSection(
                title = "Line Movement",
                icon = AppIcon.fromSystemName("chart.line.uptrend.xyaxis"),
                iconTint = AppColors.appPrimary,
            ) {
                CFBLineMovementSection(game)
            }
        }

        items(rows, key = { it.id }) { row ->
            val pick = cfbDryRunPickForRow(game, row, dryRunPicks)
            val buckets = signalBuckets(game, row, signalDefs, pick)
            WidgetCollapsingSection(
                title = row.sectionTitle,
                showsHeader = false,
                bodyPadding = 4.dp,
            ) {
                ProContentSection(
                    title = row.sectionTitle,
                    minHeight = if (buckets.isEmpty) 132.dp else 210.dp,
                ) {
                    MarketRowBody(
                        game = game,
                        row = row,
                        pick = pick,
                        buckets = buckets,
                        trendsByTeam = trendsByTeam,
                        onSignalTap = { selectedSignal = it },
                        onTrendTap = { team, trend -> selectedTrend = TrendDetailSelection(team, row.id, trend) },
                    )
                }
            }
        }

        item { HonestySection() }

        item {
            AgentPickRationaleWidget(
                gameKeys = listOf(game.gameId, game.trainingKey, game.uniqueId, "${game.awayTeam}_${game.homeTeam}"),
                modifier = Modifier.padding(horizontal = 16.dp).padding(bottom = 12.dp),
            )
        }
    }

    selectedSignal?.let { flag ->
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = false)
        ModalBottomSheet(onDismissRequest = { selectedSignal = null }, sheetState = sheetState) {
            SignalDefinitionSheet(flag, signalDefs, perfByKey)
        }
    }

    selectedTrend?.let { sel ->
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(onDismissRequest = { selectedTrend = null }, sheetState = sheetState) {
            TrendDetailSheet(sel)
        }
    }
}

// MARK: - Hero

@Composable
private fun CFBHero(
    game: CFBPrediction,
    awayColors: com.wagerproof.app.features.gamecards.TeamColorPair,
    homeColors: com.wagerproof.app.features.gamecards.TeamColorPair,
    progress: Float,
) {
    val logoSize = lerp(58f, 30f, progress).dp
    val detail = max(0f, 1f - progress * 1.9f)
    val mlReveal = min(1f, max(0f, (progress - 0.35f) / 0.4f))

    Column(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(top = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(lerp(12f, 6f, progress).dp),
    ) {
        // Date + glass time capsule.
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(
                GameCardFormatting.formatCompactDate(game.kickoff ?: game.gameDate),
                color = AppColors.appTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold,
            )
            Text(
                GameCardFormatting.convertTimeToEST(game.kickoff ?: game.gameTime),
                modifier = Modifier
                    .background(AppColors.appSurfaceElevated.copy(alpha = 0.7f), CircleShape)
                    .padding(horizontal = 10.dp, vertical = 4.dp),
                color = AppColors.appTextSecondary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold,
            )
        }

        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(lerp(14f, 10f, progress).dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            HeroTeamColumn(game.awayTeam, game.awayRank, awayColors, logoSize, detail, game.awayMl, mlReveal, Modifier.weight(1f))
            HeroLinesColumn(game, detail, progress, Modifier.weight(1f))
            HeroTeamColumn(game.homeTeam, game.homeRank, homeColors, logoSize, detail, game.homeMl, mlReveal, Modifier.weight(1f))
        }

        if (detail > 0.18f) {
            HeroWeatherRow(game, Modifier.padding(top = 2.dp))
        }
    }
}

@Composable
private fun HeroTeamColumn(
    team: String,
    rank: Int?,
    colors: com.wagerproof.app.features.gamecards.TeamColorPair,
    size: Dp,
    nameOpacity: Float,
    ml: Int?,
    mlReveal: Float,
    modifier: Modifier = Modifier,
) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Box(contentAlignment = Alignment.BottomEnd) {
            GameCardTeamAvatar(sport = "cfb", team = team, diameter = size, colors = colors)
            if (rank != null && nameOpacity > 0.08f) {
                Box(
                    Modifier
                        .alpha(nameOpacity)
                        .background(Color(0xFF22C55E), CircleShape)
                        .padding(horizontal = 5.dp, vertical = 2.dp),
                ) {
                    Text("#$rank", color = AppColors.appSurface, fontSize = 9.sp, fontWeight = FontWeight.Black)
                }
            }
        }
        Text(
            CFBTeamAssets.abbr(team),
            color = AppColors.appTextPrimary,
            fontSize = 14.sp,
            lineHeight = 15.sp,
            fontWeight = FontWeight.Black,
            maxLines = 1,
        )
        Box(Modifier.height(15.dp), contentAlignment = Alignment.Center) {
            Text(
                team,
                modifier = Modifier.alpha(nameOpacity),
                color = AppColors.appTextPrimary,
                fontSize = 10.sp,
                fontWeight = FontWeight.Medium,
                textAlign = TextAlign.Center,
                maxLines = 1,
            )
            Text(
                GameCardFormatting.formatMoneyline(ml),
                modifier = Modifier.alpha(mlReveal),
                color = AppColors.appTextPrimary,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
            )
        }
    }
}

@Composable
private fun HeroLinesColumn(game: CFBPrediction, detail: Float, progress: Float, modifier: Modifier = Modifier) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(lerp(6f, 2f, progress).dp)) {
        if (detail > 0.04f) {
            HeroLineRow("ML", "${GameCardFormatting.formatMoneyline(game.awayMl)} / ${GameCardFormatting.formatMoneyline(game.homeMl)}", detail)
        }
        HeroLineRow("Spread", "${GameCardFormatting.formatSpread(game.awaySpread)} / ${GameCardFormatting.formatSpread(game.homeSpread)}")
        HeroLineRow("O/U", fmtHalf(game.overLine))
        game.predictedScore?.let { score ->
            HeroLineRow(
                "Model",
                "${CFBTeamAssets.abbr(game.awayTeam)} ${fmt1(score.away)} · ${CFBTeamAssets.abbr(game.homeTeam)} ${fmt1(score.home)}",
            )
        }
    }
}

@Composable
private fun HeroLineRow(label: String, value: String, alpha: Float = 1f) {
    Column(Modifier.alpha(alpha), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(label.uppercase(Locale.US), color = AppColors.appTextSecondary, fontSize = 9.sp, fontWeight = FontWeight.SemiBold)
        Text(value, color = AppColors.appTextPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
    }
}

@Composable
private fun HeroWeatherRow(game: CFBPrediction, modifier: Modifier = Modifier) {
    if (game.wxIndoors == true) {
        Row(modifier, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
            WeatherChip("building.2.fill", "Indoor / Dome", Color(0xFFA78BFA))
        }
        return
    }
    val temp = game.wxTempF ?: game.temperature
    val wind = game.wxWindMph ?: game.windSpeed
    val condition = weatherCondition(game)
    if (condition == null && temp == null && wind == null) return
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        condition?.let { WeatherChip(it.second, it.first, it.third) }
        temp?.let { WeatherChip("thermometer.medium", "${it.toInt()}°", tempTint(it)) }
        wind?.let { WeatherChip("wind", "${it.toInt()} mph", Color(0xFF60A5FA)) }
    }
}

@Composable
private fun WeatherChip(systemImage: String, text: String, tint: Color) {
    Row(
        Modifier
            .background(tint.copy(alpha = 0.13f), CircleShape)
            .border(0.6.dp, tint.copy(alpha = 0.32f), CircleShape)
            .padding(horizontal = 10.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(3.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        (AppIcon.fromSystemName(systemImage) ?: AppIcon.fromSystemName("wind"))?.let {
            Icon(it.imageVector, null, tint = tint, modifier = Modifier.size(12.dp))
        }
        Text(text, color = AppColors.appTextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Black, maxLines = 1)
    }
}

// MARK: - Market row body

@Composable
private fun MarketRowBody(
    game: CFBPrediction,
    row: CFBMarketRow,
    pick: CFBDryrunPickRow?,
    buckets: SignalBuckets,
    trendsByTeam: Map<String, CFBTeamTrendRow>,
    onSignalTap: (CFBDryRunFlag) -> Unit,
    onTrendTap: (String, CFBTeamTrendRow) -> Unit,
) {
    val mammoth = isMammothPick(pick)
    val direction = pickDirection(pick?.pickSide) ?: pickDirection(pick?.pickLabel) ?: pickDirection(row.pick)
    val cardTint = if (mammoth) MammothTint else directionTint(direction, row.tint)

    Column(Modifier.padding(4.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        // Title row.
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (row.id == "tt-home" || row.id == "tt-away") {
                val team = if (row.id == "tt-home") game.homeTeam else game.awayTeam
                GameCardTeamAvatar("cfb", team, 18.dp, colors = CFBTeamColors.colorPair(team))
            }
            Text(row.sectionTitle, color = AppColors.appTextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Black)
            if (mammoth) MammothBadge()
            if (row.isDisplayOnly || pick?.displayOnly == true) {
                Text(
                    "Display only",
                    modifier = Modifier
                        .background(AppColors.appTextSecondary.copy(alpha = 0.10f), CircleShape)
                        .padding(horizontal = 7.dp, vertical = 3.dp),
                    color = AppColors.appTextSecondary, fontSize = 9.sp, fontWeight = FontWeight.Black,
                )
            }
            Spacer(Modifier.weight(1f))
            Text(
                pick?.recommendation ?: row.pick,
                color = when {
                    mammoth -> MammothTint
                    pick?.hasPlay == false || pick?.displayOnly == true -> AppColors.appTextSecondary
                    row.isNoPlay -> AppColors.appAccentAmber
                    else -> row.tint
                },
                fontSize = 13.sp, fontWeight = FontWeight.Black, maxLines = 1,
            )
        }

        // Recommendation card (comparison boxes + pick line).
        RecommendationCard(game, row, pick, mammoth, cardTint, direction)

        // Signal buckets.
        if (!buckets.isEmpty) {
            Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
                if (buckets.supporting.isNotEmpty()) {
                    SignalGroup("Supports this pick", buckets.supporting, muted = false, onSignalTap)
                }
                if (buckets.contradicting.isNotEmpty()) {
                    SignalGroup("Contradicts this pick", buckets.contradicting, muted = true, onSignalTap)
                }
            }
        }

        // Team trends strip.
        TeamTrendStrip(game, row, trendsByTeam, onTrendTap)
    }
}

@Composable
private fun RecommendationCard(
    game: CFBPrediction,
    row: CFBMarketRow,
    pick: CFBDryrunPickRow?,
    mammoth: Boolean,
    cardTint: Color,
    direction: String?,
) {
    val bg = if (mammoth) {
        Brush.linearGradient(listOf(MammothTint.copy(alpha = 0.28f), MammothGold.copy(alpha = 0.13f), AppColors.appSurfaceElevated.copy(alpha = 0.72f)))
    } else {
        Brush.linearGradient(listOf(cardTint.copy(alpha = 0.12f), cardTint.copy(alpha = 0.12f)))
    }
    val shape = RoundedCornerShape(16.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .background(bg, shape)
            .border(if (mammoth) 1.4.dp else 0.8.dp, if (mammoth) MammothTint.copy(alpha = 0.72f) else row.tint.copy(alpha = 0.20f), shape)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        if (row.showComparison) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                ComparisonBox(
                    row.vegasLabel,
                    pick?.let { formatMarketLine(it.bestLine ?: it.vegasLine, row) } ?: row.vegas,
                    AppColors.appTextPrimary,
                    false,
                    Modifier.weight(1f),
                )
                AppIcon.fromSystemName("arrow.right")?.let {
                    Icon(it.imageVector, null, tint = AppColors.appTextMuted, modifier = Modifier.size(14.dp))
                }
                ComparisonBox(
                    row.modelLabel,
                    pick?.let { formatMarketLine(it.resolvedModelLine, row) } ?: row.model,
                    cardTint,
                    true,
                    Modifier.weight(1f),
                )
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            PickIcon(game, row, pick?.pickTeam, direction, cardTint)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                if (mammoth) {
                    Row(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalAlignment = Alignment.CenterVertically) {
                        AppIcon.fromSystemName("flame.fill")?.let {
                            Icon(it.imageVector, null, tint = MammothTint, modifier = Modifier.size(9.dp))
                        }
                        Text("Rare 5u mammoth spot", color = MammothTint, fontSize = 9.sp, fontWeight = FontWeight.Black)
                    }
                }
                Text(pick?.pickLabel ?: row.pickTitle, color = cardTint, fontSize = 13.sp, fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace, maxLines = 1)
                BestBookRow(pick, row)
            }
        }
    }
}

@Composable
private fun BestBookRow(pick: CFBDryrunPickRow?, row: CFBMarketRow) {
    if (pick == null) {
        Text(
            row.pickSubtitle,
            color = AppColors.appTextMuted,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            maxLines = if (row.isDisplayOnly) 1 else 2,
        )
        return
    }
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
        SportsbookLogoView(
            bookKey = pick.bestBook ?: pick.bestBookName ?: "",
            logoURL = pick.bestBookLogo,
            style = SportsbookLogoStyle.COMPACT,
        )
        Text(
            buildString {
                append(pick.bestBookName ?: pick.bestBook ?: "Best book")
                append(" ${formatMarketLine(pick.bestLine, row)}")
                formatOdds(pick.bestOdds).takeIf(String::isNotEmpty)?.let { append(" $it") }
            },
            color = AppColors.appTextSecondary,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            maxLines = 1,
        )
    }
}

private fun isMammothPick(pick: CFBDryrunPickRow?): Boolean =
    pick?.isMammoth == true ||
        pick?.conviction.equals("mammoth", ignoreCase = true) ||
        pick?.recommendation?.contains("MAMMOTH", ignoreCase = true) == true

private fun formatMarketLine(value: Double?, row: CFBMarketRow): String {
    value ?: return "—"
    return when (row.id) {
        "spread", "h1-spread" -> GameCardFormatting.formatSpread(value)
        "moneyline", "h1-ml" -> formatOdds(value)
        else -> fmtHalf(value)
    }
}

private fun formatOdds(value: Double?): String {
    value ?: return ""
    val rounded = value.roundToInt()
    return if (rounded > 0) "+$rounded" else rounded.toString()
}

@Composable
private fun ComparisonBox(label: String, value: String, tint: Color, highlighted: Boolean, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(12.dp)
    Column(
        modifier
            .background(if (highlighted) tint.copy(alpha = 0.14f) else AppColors.appSurfaceElevated.copy(alpha = 0.65f), shape)
            .border(0.8.dp, (if (highlighted) tint else AppColors.appBorder).copy(alpha = 0.25f), shape)
            .padding(vertical = 11.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(label.uppercase(Locale.US), color = AppColors.appTextMuted, fontSize = 9.sp, fontWeight = FontWeight.Black)
        Text(value, color = tint, fontSize = 20.sp, fontWeight = FontWeight.Black)
    }
}

@Composable
private fun PickIcon(game: CFBPrediction, row: CFBMarketRow, teamNameOverride: String?, direction: String?, tint: Color) {
    when {
        direction != null -> {
            val icon = if (direction == "UNDER") AppIcon.fromSystemName("arrow.down.circle.fill") ?: AppIcon.fromSystemName("arrow.down")
            else AppIcon.fromSystemName("arrow.up.circle.fill")
            Box(Modifier.size(42.dp).background(tint.copy(alpha = 0.12f), CircleShape), contentAlignment = Alignment.Center) {
                icon?.let { Icon(it.imageVector, null, tint = tint, modifier = Modifier.size(22.dp)) }
            }
        }
        teamNameOverride != null || row.pickTeamName != null -> {
            val team = teamNameOverride ?: row.pickTeamName ?: return
            GameCardTeamAvatar("cfb", team, 42.dp, colors = CFBTeamColors.colorPair(team))
        }
        else -> {
            Box(Modifier.size(42.dp).background(tint.copy(alpha = 0.12f), CircleShape), contentAlignment = Alignment.Center) {
                AppIcon.fromSystemName(row.iconName)?.let { Icon(it.imageVector, null, tint = tint, modifier = Modifier.size(22.dp)) }
            }
        }
    }
}

@Composable
private fun MammothBadge() {
    Row(
        Modifier
            .background(Brush.horizontalGradient(listOf(MammothTint, MammothGold)), CircleShape)
            .padding(horizontal = 7.dp, vertical = 3.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        AppIcon.fromSystemName("flame.fill")?.let { Icon(it.imageVector, null, tint = AppColors.appSurface, modifier = Modifier.size(8.dp)) }
        Text("MAMMOTH", color = AppColors.appSurface, fontSize = 8.sp, fontWeight = FontWeight.Black)
    }
}

@Composable
private fun SignalGroup(title: String, signals: List<CFBDryRunFlag>, muted: Boolean, onTap: (CFBDryRunFlag) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
        Text(title, color = if (muted) AppColors.appAccentAmber else AppColors.appTextMuted, fontSize = 9.sp, fontWeight = FontWeight.Black)
        signals.forEach { SignalButton(it, muted, onTap) }
    }
}

@Composable
private fun SignalButton(flag: CFBDryRunFlag, muted: Boolean, onTap: (CFBDryRunFlag) -> Unit) {
    val color = if (muted) AppColors.appAccentAmber else tierColor(flag.convictionTier)
    val shape = RoundedCornerShape(12.dp)
    Row(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(color.copy(alpha = if (muted) 0.12f else 0.18f))
            .border(1.1.dp, color.copy(alpha = if (muted) 0.55f else 0.46f), shape)
            .clickable { onTap(flag) }
            .padding(start = 10.dp, end = 7.dp, top = 8.dp, bottom = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        AppIcon.fromSystemName("info.circle.fill")?.let { Icon(it.imageVector, null, tint = color, modifier = Modifier.size(12.dp)) }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(flag.signalDefinition?.displayName ?: flag.source, color = color, fontSize = 11.sp, fontWeight = FontWeight.Black, maxLines = 1)
            Text("Tap for details", color = color.copy(alpha = 0.72f), fontSize = 8.sp, fontWeight = FontWeight.Black, maxLines = 1)
        }
        Box(Modifier.size(18.dp).background(color, CircleShape), contentAlignment = Alignment.Center) {
            AppIcon.fromSystemName("chevron.up.forward")?.let { Icon(it.imageVector, null, tint = AppColors.appSurface, modifier = Modifier.size(9.dp)) }
        }
    }
}

// MARK: - Team trend strip

@Composable
private fun TeamTrendStrip(
    game: CFBPrediction,
    row: CFBMarketRow,
    trendsByTeam: Map<String, CFBTeamTrendRow>,
    onTrendTap: (String, CFBTeamTrendRow) -> Unit,
) {
    val away = trendsByTeam[game.awayTeam]
    val home = trendsByTeam[game.homeTeam]
    val show = when (row.id) {
        "tt-home" -> home != null
        "tt-away" -> away != null
        else -> away != null || home != null
    }
    if (!show) return
    val shape = RoundedCornerShape(14.dp)
    Column(
        Modifier
            .background(AppColors.appSurfaceElevated.copy(alpha = 0.42f), shape)
            .border(0.7.dp, AppColors.appBorder.copy(alpha = 0.28f), shape)
            .padding(10.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            AppIcon.fromSystemName("chart.bar.xaxis")?.let { Icon(it.imageVector, null, tint = AppColors.appTextSecondary, modifier = Modifier.size(9.dp)) }
            Text("Team Trends", color = AppColors.appTextSecondary, fontSize = 9.sp, fontWeight = FontWeight.Black)
            (away ?: home)?.let { Text(it.sampleLabel, color = AppColors.appTextMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold) }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            when (row.id) {
                "tt-home" -> TrendCard(game.homeTeam, home, row, Modifier.weight(1f), onTrendTap)
                "tt-away" -> TrendCard(game.awayTeam, away, row, Modifier.weight(1f), onTrendTap)
                else -> {
                    TrendCard(game.awayTeam, away, row, Modifier.weight(1f), onTrendTap)
                    TrendCard(game.homeTeam, home, row, Modifier.weight(1f), onTrendTap)
                }
            }
        }
    }
}

@Composable
private fun TrendCard(
    team: String,
    trend: CFBTeamTrendRow?,
    row: CFBMarketRow,
    modifier: Modifier = Modifier,
    onTrendTap: (String, CFBTeamTrendRow) -> Unit,
) {
    val metric = trendMetric(row.id, trend)
    val shape = RoundedCornerShape(12.dp)
    var mod = modifier
        .background(AppColors.appSurface.copy(alpha = 0.42f), shape)
        .border(0.7.dp, metric.tint.copy(alpha = 0.18f), shape)
    if (trend != null) mod = mod.clickable { onTrendTap(team, trend) }
    Column(mod.padding(8.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            GameCardTeamAvatar("cfb", team, 20.dp, colors = CFBTeamColors.colorPair(team))
            Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
                Text(CFBTeamAssets.abbr(team), color = AppColors.appTextPrimary, fontSize = 10.sp, fontWeight = FontWeight.Black)
                Text(metric.label, color = AppColors.appTextMuted, fontSize = 8.sp, fontWeight = FontWeight.Black)
            }
            Spacer(Modifier.weight(1f))
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(1.dp)) {
                Text("SEASON", color = AppColors.appTextMuted, fontSize = 7.sp, fontWeight = FontWeight.Black)
                Text(metric.value, color = metric.tint, fontSize = 11.sp, fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace, maxLines = 1)
            }
        }
        TrendChips(metric.chips)
        if (trend != null) {
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("Tap to expand", color = AppColors.appTextMuted, fontSize = 8.sp, fontWeight = FontWeight.Black)
                AppIcon.fromSystemName("chevron.up.forward")?.let { Icon(it.imageVector, null, tint = AppColors.appTextMuted, modifier = Modifier.size(8.dp)) }
            }
        }
    }
}

@Composable
private fun TrendChips(chips: List<String>) {
    Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
        if (chips.isNotEmpty()) {
            Text("L${min(chips.size, 5)}", color = AppColors.appTextMuted, fontSize = 8.sp, fontWeight = FontWeight.Black)
            chips.take(5).forEach { chip ->
                Box(Modifier.size(17.dp).background(trendChipColor(chip), CircleShape), contentAlignment = Alignment.Center) {
                    Text(chip.uppercase(Locale.US), color = AppColors.appSurface, fontSize = 8.sp, fontWeight = FontWeight.Black)
                }
            }
        } else {
            Text("No L5", color = AppColors.appTextMuted, fontSize = 8.sp, fontWeight = FontWeight.Bold)
        }
    }
}

// MARK: - Honesty section

@Composable
private fun HonestySection() {
    WidgetCollapsingSection(
        title = "Display Notes",
        icon = AppIcon.fromSystemName("checkmark.shield.fill"),
        iconTint = AppColors.appAccentBlue,
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            HonestyNote("Full-game moneyline is context only for CFB, never a surfaced pick.")
            HonestyNote("If spread edge is capped, the board shows model off-market and no play.")
            HonestyNote("Tracking flags are paper-trade/small-sample spots, separated from active picks.")
        }
    }
}

@Composable
private fun HonestyNote(text: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        AppIcon.fromSystemName("info.circle.fill")?.let { Icon(it.imageVector, null, tint = AppColors.appAccentBlue, modifier = Modifier.size(12.dp)) }
        Text(text, color = AppColors.appTextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Medium)
    }
}

// MARK: - Signal sheet

@Composable
private fun SignalDefinitionSheet(
    flag: CFBDryRunFlag,
    signalDefs: Map<String, CFBSignalDefinition>,
    perfByKey: Map<String, SignalPerformance>,
) {
    val def = flag.signalDefinition ?: CFBSignalDefinitionsService.definition(flag.source, signalDefs)
    val color = tierColor(flag.convictionTier)
    Column(Modifier.fillMaxWidth().padding(18.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(36.dp).background(color.copy(alpha = 0.14f), CircleShape), contentAlignment = Alignment.Center) {
                AppIcon.fromSystemName("bolt.fill")?.let { Icon(it.imageVector, null, tint = color, modifier = Modifier.size(16.dp)) }
            }
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(def?.displayName ?: flag.source, color = AppColors.appTextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Black)
                Text(
                    def?.oneLiner ?: "${marketLabel(flag.market)} · ${flag.side} ${flag.line?.let { fmt1(it) } ?: ""}".trim(),
                    color = AppColors.appTextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Bold,
                )
            }
        }
        if (def != null) {
            def.definition?.let { DefinitionLine("What it means", it) }
            def.whyItWorks?.let { DefinitionLine("Why it works", it) }
            def.betDirection?.let { DefinitionLine("Bet direction", it) }
            SignalPerformanceStatsSection(
                backtestHit = def.typicalHit,
                seasonPerformance = signalPerformanceFor(flag, signalDefs, perfByKey),
            )
        } else {
            Text("Signal definition unavailable.", color = AppColors.appTextSecondary, fontSize = 14.sp, fontWeight = FontWeight.Medium)
        }
    }
}

@Composable
private fun DefinitionLine(label: String, value: String) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(label.uppercase(Locale.US), color = AppColors.appTextMuted, fontSize = 8.sp, fontWeight = FontWeight.Black)
        Text(value, color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Medium)
    }
}

// MARK: - Trend detail sheet

@Composable
private fun TrendDetailSheet(sel: TrendDetailSelection) {
    val rows = trendDetailRows(sel)
    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            GameCardTeamAvatar("cfb", sel.team, 34.dp, colors = CFBTeamColors.colorPair(sel.team))
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text("${CFBTeamAssets.abbr(sel.team)} ${trendDetailTitle(sel.rowId)}", color = AppColors.appTextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Black)
                Text("Season game log · newest first", color = AppColors.appTextMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
        }
        if (rows.isEmpty()) {
            Text("No posted rows for this trend type.", color = AppColors.appTextMuted, fontSize = 13.sp, fontWeight = FontWeight.Bold, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
        } else {
            // Game logs are short (~12 rows); a plain column avoids nesting a
            // LazyColumn inside the wrap-height bottom sheet (infinite constraint).
            Column { rows.forEach { r -> TrendDetailRow(r) } }
        }
    }
}

@Composable
private fun TrendDetailRow(r: TrendDetailGameRow) {
    Row(
        Modifier.fillMaxWidth().padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(r.date, color = AppColors.appTextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, modifier = Modifier.width(48.dp))
        Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            if (r.locationMarker.isNotEmpty()) {
                Text(r.locationMarker, color = AppColors.appTextMuted, fontSize = 10.sp, fontWeight = FontWeight.Black)
            }
            GameCardTeamAvatar("cfb", r.opponent, 22.dp, colors = CFBTeamColors.colorPair(r.opponent))
            Text(CFBTeamAssets.abbr(r.opponent), color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Black, maxLines = 1)
        }
        Text(r.line, color = AppColors.appTextSecondary, fontSize = 13.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, modifier = Modifier.width(56.dp))
        Box(Modifier.width(42.dp)) {
            Text(
                r.result.uppercase(Locale.US),
                modifier = Modifier.background(trendChipColor(r.result), CircleShape).padding(horizontal = 8.dp, vertical = 4.dp),
                color = AppColors.appSurface, fontSize = 11.sp, fontWeight = FontWeight.Black,
            )
        }
        r.margin?.let {
            Text(signed(it), color = marginColor(it), fontSize = 13.sp, fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace, modifier = Modifier.width(64.dp))
        }
    }
    Box(Modifier.fillMaxWidth().height(0.7.dp).background(AppColors.appBorder.copy(alpha = 0.22f)))
}

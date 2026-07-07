package com.wagerproof.app.features.nfl

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.agents.components.AgentPickRationaleWidget
import com.wagerproof.app.features.components.CollapsingWidgetScroll
import com.wagerproof.app.features.components.TeamAuraBackground
import com.wagerproof.app.features.components.WidgetCollapsingSection
import com.wagerproof.app.features.components.polymarket.PolymarketWidget
import com.wagerproof.app.features.gamecards.GameCardFormatting
import com.wagerproof.app.features.gamecards.GameCardTeamAvatar
import com.wagerproof.app.features.gamecards.HeroStat
import com.wagerproof.app.features.gamecards.MatchupGlassHero
import com.wagerproof.app.features.gamecards.MatchupHeroSide
import com.wagerproof.app.features.gamecards.SportsbookLogoStyle
import com.wagerproof.app.features.gamecards.SportsbookLogoView
import com.wagerproof.app.features.gamewidgets.SignalPerformanceStatsSection
import com.wagerproof.app.features.paywall.ProContentSection
import com.wagerproof.app.features.shared.hexColor
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.NFLPrediction
import com.wagerproof.core.models.NFLTeamAssets
import com.wagerproof.core.models.SignalPerformance
import com.wagerproof.core.services.NFLTeamsService
import com.wagerproof.core.services.SignalPerformanceService
import com.wagerproof.core.services.SignalSport
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.roundToInt

/**
 * NFL game-detail page — port of iOS `NFLGameBottomSheet` (dry-run contract).
 * Section order: Market Odds → one prediction section per pick group
 * (spread, total, team_total, moneyline, h1_spread, h1_total, h1_ml) →
 * Matchup History → Agent rationale. Signal + trend detail bottom sheets.
 *
 * Data loads only when `runId` contains "dryrun" (parity with iOS) from
 * `nfl_dryrun_picks` / `nfl_signal_defs` / `nfl_team_trends` /
 * `nfl_matchup_history` + `SignalPerformanceService`.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NFLGameDetailPage(
    game: NFLPrediction,
    topInset: Dp,
    bottomInset: Dp,
) {
    val awayColors = remember(game.awayTeam) { NFLTeamColors.colorPair(game.awayTeam) }
    val homeColors = remember(game.homeTeam) { NFLTeamColors.colorPair(game.homeTeam) }
    val awayAbbr = game.awayAb ?: NFLTeamAssets.abbr(game.awayTeam)
    val homeAbbr = game.homeAb ?: NFLTeamAssets.abbr(game.homeTeam)

    var picks by remember { mutableStateOf<List<NFLDryrunPickRow>>(emptyList()) }
    var signalsByKey by remember { mutableStateOf<Map<String, NFLSignalDefinition>>(emptyMap()) }
    var perfByKey by remember { mutableStateOf<Map<String, SignalPerformance>>(emptyMap()) }
    var trendsByAbbr by remember { mutableStateOf<Map<String, NFLTeamTrendRow>>(emptyMap()) }
    var matchupHistory by remember { mutableStateOf<List<NFLMatchupHistoryRow>>(emptyList()) }

    var selectedSignal by remember { mutableStateOf<NFLSignalDefinition?>(null) }
    var selectedTrend by remember { mutableStateOf<NFLTrendDetailSelection?>(null) }

    LaunchedEffect(game.gameId) {
        // iOS gates ALL detail data on the dry-run pipeline; legacy rows show
        // the empty-picks state instead.
        if (!(game.runId ?: "").contains("dryrun", ignoreCase = true)) return@LaunchedEffect
        NFLTeamsService.ensureLoaded()
        coroutineScope {
            val picksTask = async { loadNFLDryrunPicks(game.gameId) }
            val signalsTask = async { loadNFLSignalDefs() }
            val trendsTask = async { loadNFLTeamTrends(awayAbbr, homeAbbr) }
            val historyTask = async { loadNFLMatchupHistory(awayAbbr, homeAbbr) }
            val perfTask = async { SignalPerformanceService.shared.performances(SignalSport.NFL, game.season ?: 2025) }
            picks = picksTask.await()
            signalsByKey = signalsTask.await()
            trendsByAbbr = trendsTask.await()
            matchupHistory = historyTask.await()
            perfByKey = perfTask.await()
        }
    }

    val hasWeather = game.wxIndoors == true || game.wxSummary != null || game.wxTempF != null || game.wxWindMph != null
    val groups = groupedPicks(picks)

    CollapsingWidgetScroll(
        heroMaxHeight = if (hasWeather) 246.dp else 206.dp,
        heroMinHeight = 122.dp,
        transparentPage = true,
        heroTopInset = topInset,
        bottomInset = bottomInset,
        background = { progress ->
            TeamAuraBackground(awayColors.primary, homeColors.primary, progress)
        },
        hero = { progress ->
            NFLHero(game, awayAbbr, homeAbbr, awayColors, homeColors, progress)
        },
    ) {
        item {
            WidgetCollapsingSection(
                title = "Market Odds",
                icon = AppIcon.fromSystemName("chart.bar.fill"),
                iconTint = AppColors.appPrimary,
            ) {
                PolymarketWidget(
                    league = "nfl",
                    awayTeam = game.awayTeam,
                    homeTeam = game.homeTeam,
                    awayColors = awayColors,
                    homeColors = homeColors,
                    awayAbbr = awayAbbr,
                    homeAbbr = homeAbbr,
                )
            }
        }

        if (groups.isEmpty()) {
            item {
                WidgetCollapsingSection("NFL Predictions", icon = AppIcon.fromSystemName("football.fill"), iconTint = AppColors.appPrimary) {
                    ProContentSection(title = "NFL Predictions", minHeight = 88.dp) {
                        Column(
                            Modifier.fillMaxWidth().padding(vertical = 18.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            AppIcon.fromSystemName("football")?.let {
                                Icon(it.imageVector, null, tint = AppColors.appTextSecondary, modifier = Modifier.size(28.dp))
                            }
                            Text("No dry-run picks", color = AppColors.appTextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                            Text(
                                "Picks load from nfl_dryrun_picks for this game.",
                                color = AppColors.appTextSecondary, fontSize = 12.sp, textAlign = TextAlign.Center,
                            )
                        }
                    }
                }
            }
        } else {
            items(groups, key = { it.id }) { group ->
                WidgetCollapsingSection(
                    title = group.title,
                    showsHeader = false,
                    bodyPadding = 14.dp,
                ) {
                    ProContentSection(title = group.title, minHeight = 154.dp) {
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            group.picks.forEach { pick ->
                                PickRow(
                                    game = game,
                                    pick = pick,
                                    group = group,
                                    awayAbbr = awayAbbr,
                                    homeAbbr = homeAbbr,
                                    signalsByKey = signalsByKey,
                                    onSignalTap = { selectedSignal = it },
                                )
                            }
                            trendKind(group.cardGroup)?.let { kind ->
                                TeamTrendStrip(
                                    game = game,
                                    group = group,
                                    kind = kind,
                                    awayAbbr = awayAbbr,
                                    homeAbbr = homeAbbr,
                                    trendsByAbbr = trendsByAbbr,
                                    onTrendTap = { selectedTrend = it },
                                )
                            }
                        }
                    }
                }
            }
        }

        item {
            WidgetCollapsingSection(
                title = "Matchup History",
                icon = AppIcon.fromSystemName("person.2.fill"),
                iconTint = AppColors.appAccentBlue,
                bodyPadding = 14.dp,
            ) {
                ProContentSection(title = "Matchup History", minHeight = if (matchupHistory.isEmpty()) 80.dp else 220.dp) {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        if (matchupHistory.isEmpty()) {
                            Text(
                                "No recent head-to-head games found.",
                                color = AppColors.appTextSecondary, fontSize = 13.sp, fontWeight = FontWeight.Medium,
                                textAlign = TextAlign.Center,
                                modifier = Modifier.fillMaxWidth().padding(vertical = 18.dp),
                            )
                        } else {
                            matchupHistory.forEach { row -> MatchupHistoryRowView(row) }
                        }
                    }
                }
            }
        }

        item {
            AgentPickRationaleWidget(
                gameKeys = listOf(game.trainingKey, game.uniqueId, "${game.awayTeam}_${game.homeTeam}"),
                modifier = Modifier.padding(horizontal = 16.dp).padding(bottom = 12.dp),
            )
        }
    }

    selectedSignal?.let { signal ->
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = false)
        ModalBottomSheet(onDismissRequest = { selectedSignal = null }, sheetState = sheetState) {
            SignalDefinitionSheet(signal, perfByKey)
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
private fun NFLHero(
    game: NFLPrediction,
    awayAbbr: String,
    homeAbbr: String,
    awayColors: com.wagerproof.app.features.gamecards.TeamColorPair,
    homeColors: com.wagerproof.app.features.gamecards.TeamColorPair,
    p: Float,
) {
    val detail = (1f - p * 1.9f).coerceIn(0f, 1f)
    Column(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(top = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(lerp(12f, 6f, p).dp),
    ) {
        // Centered date + glass time capsule.
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

        MatchupGlassHero(
            away = MatchupHeroSide(
                logoURL = NFLTeamAssets.logo(game.awayTeam),
                abbr = awayAbbr,
                colors = awayColors,
                moneyline = game.awayMl,
            ),
            home = MatchupHeroSide(
                logoURL = NFLTeamAssets.logo(game.homeTeam),
                abbr = homeAbbr,
                colors = homeColors,
                moneyline = game.homeMl,
            ),
            progress = p,
            expandedStats = listOf(
                HeroStat("ML", GameCardFormatting.formatMoneyline(game.awayMl), GameCardFormatting.formatMoneyline(game.homeMl)),
                HeroStat("Spread", GameCardFormatting.formatSpread(game.awaySpread), GameCardFormatting.formatSpread(game.homeSpread)),
                HeroStat("O/U", fmtHalf(game.overLine), ""),
            ),
            collapsedStats = listOf(
                HeroStat("Spread", GameCardFormatting.formatSpread(game.awaySpread), GameCardFormatting.formatSpread(game.homeSpread)),
                HeroStat("O/U", fmtHalf(game.overLine), ""),
            ),
            fusedTitle = "$awayAbbr @ $homeAbbr",
        )

        if (detail > 0.08f) {
            HeroWeatherRow(game, Modifier.alpha(detail).padding(top = 2.dp))
        }
    }
}

@Composable
private fun HeroWeatherRow(game: NFLPrediction, modifier: Modifier = Modifier) {
    // FIDELITY-WAIVER #291: SF weather glyphs (cloud.rain.fill etc.) aren't in
    // the Android AppIcon set — condition chips fall back to available icons.
    if (game.wxIndoors == true) {
        Row(modifier, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            WeatherChip("building.2.crop.circle", "INDOOR", game.wxSummary ?: "Game in Dome/Indoor", AppColors.appAccentBlue)
        }
        return
    }
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        weatherConditionDisplay(game)?.let { (icon, title, tint) ->
            WeatherConditionChip(icon, title, tint)
        }
        game.wxTempF?.let { temp ->
            WeatherChip("thermometer.medium", "TEMP", "${temp.roundToInt()}°F", temperatureTint(temp))
        }
        game.wxWindMph?.let { wind ->
            WeatherChip("wind", "WIND", "${wind.roundToInt()} mph", if (wind >= 15) AppColors.appAccentAmber else AppColors.appAccentBlue)
        }
    }
}

@Composable
private fun WeatherConditionChip(systemImage: String, text: String, tint: Color) {
    Row(
        Modifier
            .background(tint.copy(alpha = 0.12f), CircleShape)
            .border(1.dp, tint.copy(alpha = 0.22f), CircleShape)
            .padding(horizontal = 12.dp, vertical = 9.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        (AppIcon.fromSystemName(systemImage) ?: AppIcon.fromSystemName("wind"))?.let {
            Icon(it.imageVector, null, tint = tint, modifier = Modifier.size(17.dp))
        }
        Text(text, color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Black, maxLines = 1)
    }
}

@Composable
private fun WeatherChip(systemImage: String, title: String, value: String, tint: Color) {
    Row(
        Modifier
            .background(tint.copy(alpha = 0.12f), CircleShape)
            .border(1.dp, tint.copy(alpha = 0.22f), CircleShape)
            .padding(horizontal = 10.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        (AppIcon.fromSystemName(systemImage) ?: AppIcon.fromSystemName("wind"))?.let {
            Icon(it.imageVector, null, tint = tint, modifier = Modifier.size(16.dp))
        }
        Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(title, color = AppColors.appTextSecondary, fontSize = 8.sp, fontWeight = FontWeight.Black)
            Text(value, color = AppColors.appTextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 1)
        }
    }
}

/** wxIcon/wxSummary keyword → (icon, title, tint), mirrors iOS mapping. */
private fun weatherConditionDisplay(game: NFLPrediction): Triple<String, String, Color>? {
    val icon = (game.wxIcon ?: "").lowercase(Locale.US)
    val summary = game.wxSummary?.lowercase(Locale.US) ?: ""
    val key = icon.ifEmpty { summary }
    val amber = AppColors.appAccentAmber
    val blue = AppColors.appAccentBlue
    val gray = AppColors.appTextSecondary
    return when {
        key.contains("indoor") || key.contains("dome") -> Triple("building.2.crop.circle", "Indoor", blue)
        key.contains("thunder") || key.contains("storm") -> Triple("bolt.fill", "Storms", amber)
        key.contains("rain") || key.contains("shower") -> Triple("wind", "Rain", blue)
        key.contains("snow") || key.contains("sleet") -> Triple("wind", "Snow", blue)
        key.contains("fog") || key.contains("mist") -> Triple("wind", "Fog", gray)
        key.contains("wind") -> Triple("wind", "Windy", amber)
        key.contains("cold") -> Triple("thermometer.medium", "Cold", blue)
        key.contains("cloud") || key.contains("overcast") -> Triple("wind", "Cloudy", gray)
        key.contains("partly") -> Triple("sparkles", "Partly", amber)
        key.contains("clear") || key.contains("sun") -> Triple("sparkles", "Clear", amber)
        icon.isEmpty() && summary.isEmpty() -> null
        else -> Triple("wind", "Weather", blue)
    }
}

private fun temperatureTint(temp: Double): Color = when {
    temp <= 35 -> AppColors.appAccentBlue
    temp >= 80 -> AppColors.appAccentRed
    else -> AppColors.appAccentAmber
}

// MARK: - Pick rows

@Composable
private fun PickRow(
    game: NFLPrediction,
    pick: NFLDryrunPickRow,
    group: NFLPickGroup,
    awayAbbr: String,
    homeAbbr: String,
    signalsByKey: Map<String, NFLSignalDefinition>,
    onSignalTap: (NFLSignalDefinition) -> Unit,
) {
    val shape = RoundedCornerShape(16.dp)
    val hasPlay = pick.hasPlay == true
    val mammoth = hasPlay && pick.isMammoth == true
    val bg = when {
        mammoth -> hexColor(0xF97316).copy(alpha = 0.12f)
        hasPlay -> nflConvictionColor(pick.conviction).copy(alpha = 0.10f)
        else -> AppColors.appSurfaceMuted.copy(alpha = 0.32f)
    }
    val stroke = when {
        mammoth -> hexColor(0xF97316).copy(alpha = 0.45f)
        hasPlay -> nflConvictionColor(pick.conviction).copy(alpha = 0.30f)
        else -> Color.White.copy(alpha = 0.08f)
    }

    Column(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(bg)
            .border(if (hasPlay) 1.2.dp else 0.8.dp, stroke, shape)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            // Group icon disc.
            Box(Modifier.size(34.dp).background(group.tint.copy(alpha = 0.12f), CircleShape), contentAlignment = Alignment.Center) {
                AppIcon.fromSystemName(group.systemImage)?.let {
                    Icon(it.imageVector, null, tint = group.tint, modifier = Modifier.size(16.dp))
                }
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(group.title, color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Black)
                    Spacer(Modifier.weight(1f))
                    RecommendationBadge(pick)
                }
                PickHeaderLabel(game, pick)
                if (pick.displayOnly == true) {
                    Text(
                        "Display Only",
                        modifier = Modifier
                            .background(AppColors.appSurfaceMuted.copy(alpha = 0.55f), CircleShape)
                            .padding(horizontal = 7.dp, vertical = 3.dp),
                        color = AppColors.appTextSecondary, fontSize = 9.sp, fontWeight = FontWeight.Black,
                    )
                }
            }
        }

        if (!isMoneylineCard(pick)) {
            MetricGrid(pick)
        } else {
            MetricBox(
                label = "Best Odds",
                value = GameCardFormatting.formatMoneyline((pick.bestOdds ?: pick.vegasPrice)?.roundToInt()),
                tint = AppColors.appAccentBlue,
                highlighted = true,
            )
        }

        if (hasBestBook(pick)) {
            BestBookRow(pick)
        }

        SignalGroups(game, pick, awayAbbr, homeAbbr, signalsByKey, onSignalTap)
    }
}

@Composable
private fun PickHeaderLabel(game: NFLPrediction, pick: NFLDryrunPickRow) {
    val team = pick.pickTeam
    when {
        shouldShowTeamHeader(pick) && team != null -> {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                GameCardTeamAvatar(sport = "nfl", team = team, diameter = 28.dp, colors = NFLTeamColors.colorPair(team))
                Text(
                    teamPickHeaderText(pick, team),
                    color = AppColors.appTextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Black, maxLines = 1,
                )
            }
        }
        isTotalHeader(pick) && overUnderDirection(pick) != null -> {
            val direction = overUnderDirection(pick)
            // UNDER = red, OVER = green — deliberate in pick cards (differs from
            // the blue insight-badge convention).
            val tint = if (direction == "UNDER") AppColors.appAccentRed else AppColors.appPrimary
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                val icon = AppIcon.fromSystemName(if (direction == "UNDER") "arrow.down.circle.fill" else "arrow.up.circle.fill")
                    ?: AppIcon.fromSystemName(if (direction == "UNDER") "arrow.down" else "arrow.up")
                icon?.let { Icon(it.imageVector, null, tint = tint, modifier = Modifier.size(24.dp)) }
                Text(
                    displayPickLabel(pick),
                    color = AppColors.appTextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Black, maxLines = 1,
                )
            }
        }
        else -> {
            Text(
                displayPickLabel(pick),
                color = AppColors.appTextPrimary, fontSize = 19.sp, fontWeight = FontWeight.Black, maxLines = 2,
            )
        }
    }
}

@Composable
private fun RecommendationBadge(pick: NFLDryrunPickRow) {
    val tint = if (pick.hasPlay == true) nflConvictionColor(pick.conviction) else AppColors.appTextSecondary
    Text(
        pick.recommendation ?: "No Bet",
        modifier = Modifier
            .background(tint.copy(alpha = 0.12f), CircleShape)
            .border(1.dp, tint.copy(alpha = 0.22f), CircleShape)
            .padding(horizontal = 8.dp, vertical = 4.dp),
        color = tint, fontSize = 10.sp, fontWeight = FontWeight.Black,
    )
}

@Composable
private fun MetricGrid(pick: NFLDryrunPickRow) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Box(Modifier.weight(1f)) {
            MetricBox(
                label = if (pick.bestLine == null) "Vegas Line" else "Best Line",
                value = formatPickLine(pick.bestLine ?: pick.vegasLine, pick),
                tint = AppColors.appTextPrimary,
            )
        }
        AppIcon.fromSystemName("arrow.right")?.let {
            Icon(it.imageVector, null, tint = AppColors.appTextMuted, modifier = Modifier.size(14.dp))
        }
        Box(Modifier.weight(1f)) {
            MetricBox(
                label = modelLabel(pick),
                value = modelMetricValue(pick),
                tint = AppColors.appPrimary,
                highlighted = true,
            )
        }
    }
}

@Composable
private fun MetricBox(label: String, value: String, tint: Color, highlighted: Boolean = false) {
    val shape = RoundedCornerShape(12.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(if (highlighted) tint.copy(alpha = 0.14f) else AppColors.appSurfaceElevated.copy(alpha = 0.65f))
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
private fun BestBookRow(pick: NFLDryrunPickRow) {
    val shape = RoundedCornerShape(12.dp)
    Row(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(AppColors.appPrimary.copy(alpha = 0.08f))
            .border(1.dp, AppColors.appPrimary.copy(alpha = 0.18f), shape)
            .padding(10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        SportsbookLogoView(
            bookKey = pick.bestBook ?: pick.bestBookName ?: "",
            logoURL = pick.bestBookLogo,
            style = SportsbookLogoStyle.REGULAR,
        )
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text("BEST BOOK", color = AppColors.appTextSecondary, fontSize = 9.sp, fontWeight = FontWeight.Black)
            Text(
                pick.bestBookName ?: pick.bestBook ?: "Best Available",
                color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold,
            )
        }
        Text(
            bestBookValue(pick),
            color = AppColors.appPrimary, fontSize = 15.sp, fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace,
        )
    }
}

// MARK: - Signals

@Composable
private fun SignalGroups(
    game: NFLPrediction,
    pick: NFLDryrunPickRow,
    awayAbbr: String,
    homeAbbr: String,
    signalsByKey: Map<String, NFLSignalDefinition>,
    onSignalTap: (NFLSignalDefinition) -> Unit,
) {
    val resolved = signalDisplays(game, pick, awayAbbr, homeAbbr, signalsByKey)
    if (resolved.isEmpty()) return
    val supporting = resolved.filter { it.stance != "counter" }
    val contradicting = resolved.filter { it.stance == "counter" }
    Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
        if (supporting.isNotEmpty()) {
            SignalGroup("Supports this pick", supporting, muted = false, onSignalTap)
        }
        if (contradicting.isNotEmpty()) {
            SignalGroup("Contradicts this pick", contradicting, muted = true, onSignalTap)
        }
    }
}

@Composable
private fun SignalGroup(title: String, signals: List<NFLSignalDisplay>, muted: Boolean, onTap: (NFLSignalDefinition) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
        Text(title, color = if (muted) AppColors.appAccentAmber else AppColors.appTextMuted, fontSize = 9.sp, fontWeight = FontWeight.Black)
        // iOS uses an adaptive LazyVGrid (min 118pt) — approximated with 2-up rows.
        signals.chunked(2).forEach { rowSignals ->
            Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                rowSignals.forEach { signal ->
                    SignalButton(signal, muted, Modifier.weight(1f), onTap)
                }
                if (rowSignals.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun SignalButton(signal: NFLSignalDisplay, muted: Boolean, modifier: Modifier = Modifier, onTap: (NFLSignalDefinition) -> Unit) {
    val color = if (muted) AppColors.appAccentAmber else AppColors.appAccentBlue
    val shape = RoundedCornerShape(12.dp)
    Row(
        modifier
            .clip(shape)
            .background(color.copy(alpha = if (muted) 0.12f else 0.18f))
            .border(1.1.dp, color.copy(alpha = if (muted) 0.55f else 0.46f), shape)
            .clickable { onTap(signalContextDefinition(signal)) }
            .padding(start = 10.dp, end = 7.dp, top = 8.dp, bottom = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        AppIcon.fromSystemName("info.circle.fill")?.let {
            Icon(it.imageVector, null, tint = color, modifier = Modifier.size(12.dp))
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(signal.displayName, color = color, fontSize = 11.sp, fontWeight = FontWeight.Black, maxLines = 1)
            Text(
                signal.action ?: signal.team ?: "Tap for details",
                color = color.copy(alpha = 0.72f), fontSize = 8.sp, fontWeight = FontWeight.Black, maxLines = 1,
            )
        }
        Box(Modifier.size(18.dp).background(color, CircleShape), contentAlignment = Alignment.Center) {
            AppIcon.fromSystemName("chevron.up.forward")?.let {
                Icon(it.imageVector, null, tint = AppColors.appSurface, modifier = Modifier.size(9.dp))
            }
        }
    }
}

/** Merge tap context (action/team) into the definition shown by the sheet. */
private fun signalContextDefinition(signal: NFLSignalDisplay): NFLSignalDefinition {
    val definition = signal.definition
    return NFLSignalDefinition(
        signalKey = signal.key,
        displayName = signal.displayName,
        oneLiner = definition?.oneLiner ?: signal.action ?: signal.team,
        definition = definition?.definition,
        whyItWorks = definition?.whyItWorks,
        betDirection = signal.action ?: signal.label ?: definition?.betDirection,
        typicalHit = definition?.typicalHit ?: signal.tier,
    )
}

private fun signalDisplays(
    game: NFLPrediction,
    pick: NFLDryrunPickRow,
    awayAbbr: String,
    homeAbbr: String,
    signalsByKey: Map<String, NFLSignalDefinition>,
): List<NFLSignalDisplay> {
    if (pick.signals.isNotEmpty()) {
        return pick.signals.map { row ->
            val definition = signalsByKey[row.key]
            NFLSignalDisplay(
                key = row.key,
                displayName = definition?.displayName ?: row.label ?: row.key,
                team = row.team,
                label = row.label,
                action = row.action,
                stance = if (row.stance?.lowercase() == "counter") "counter" else "support",
                tier = row.tier,
                definition = definition,
            )
        }
    }
    return pick.signalKeys.mapNotNull { key ->
        val definition = signalsByKey[key] ?: return@mapNotNull null
        NFLSignalDisplay(
            key = key,
            displayName = definition.displayName ?: key,
            team = null,
            label = null,
            action = null,
            stance = if (signalSupportsPick(game, definition, pick, awayAbbr, homeAbbr)) "support" else "counter",
            tier = null,
            definition = definition,
        )
    }
}

/**
 * Stance heuristic used only when the pick row lacks explicit per-signal
 * stances: FADE HOME/AWAY, OVER/UNDER, HOME/AWAY side and team-name matching;
 * unclassified defaults to supporting (mirrors iOS `signalSupportsPick`).
 */
private fun signalSupportsPick(
    game: NFLPrediction,
    signal: NFLSignalDefinition,
    pick: NFLDryrunPickRow,
    awayAbbr: String,
    homeAbbr: String,
): Boolean {
    val pickSide = (pick.pickSide ?: "").uppercase(Locale.US)
    val pickLabel = (pick.pickLabel ?: "").uppercase(Locale.US)
    val pickTeam = (pick.pickTeam ?: "").uppercase(Locale.US)
    val direction = (signal.betDirection ?: signal.oneLiner ?: signal.definition ?: "").uppercase(Locale.US)
    val awayUpper = game.awayTeam.uppercase(Locale.US)
    val homeUpper = game.homeTeam.uppercase(Locale.US)

    if (direction.contains("FADE HOME")) {
        return pickSide == "AWAY" || pickTeam == awayUpper || pickLabel.contains(awayAbbr)
    }
    if (direction.contains("FADE AWAY")) {
        return pickSide == "HOME" || pickTeam == homeUpper || pickLabel.contains(homeAbbr)
    }
    if (direction.contains("OVER") || direction.contains("UNDER")) {
        if (pickSide == "OVER" || pickLabel.contains("OVER")) return direction.contains("OVER")
        if (pickSide == "UNDER" || pickLabel.contains("UNDER")) return direction.contains("UNDER")
    }
    if (direction.contains("HOME") || direction.contains("AWAY")) {
        if (pickSide == "HOME") return direction.contains("HOME") && !direction.contains("FADE HOME")
        if (pickSide == "AWAY") return direction.contains("AWAY") && !direction.contains("FADE AWAY")
    }
    if (pickTeam.isNotEmpty()) {
        if (direction.contains(homeUpper) || direction.contains(homeAbbr)) return pickTeam == homeUpper
        if (direction.contains(awayUpper) || direction.contains(awayAbbr)) return pickTeam == awayUpper
    }
    return true
}

// MARK: - Team trends

@Composable
private fun TeamTrendStrip(
    game: NFLPrediction,
    group: NFLPickGroup,
    kind: NFLTrendKind,
    awayAbbr: String,
    homeAbbr: String,
    trendsByAbbr: Map<String, NFLTeamTrendRow>,
    onTrendTap: (NFLTrendDetailSelection) -> Unit,
) {
    val trends = if (group.cardGroup == "team_total") {
        group.picks.mapNotNull { pick ->
            teamAbbrFor(game, pick.pickTeam, awayAbbr, homeAbbr)?.let { trendsByAbbr[it] }
        }
    } else {
        listOfNotNull(trendsByAbbr[awayAbbr], trendsByAbbr[homeAbbr])
    }
    if (trends.isEmpty()) return

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Team Trends", color = AppColors.appTextSecondary, fontSize = 10.sp, fontWeight = FontWeight.Black)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            trends.forEach { trend ->
                TrendCard(trend, kind, Modifier.weight(1f)) { onTrendTap(NFLTrendDetailSelection(trend, kind)) }
            }
        }
    }
}

@Composable
private fun TrendCard(trend: NFLTeamTrendRow, kind: NFLTrendKind, modifier: Modifier = Modifier, onTap: () -> Unit) {
    val shape = RoundedCornerShape(14.dp)
    Column(
        modifier
            .clip(shape)
            .background(AppColors.appSurfaceMuted.copy(alpha = 0.45f))
            .border(1.dp, Color.White.copy(alpha = 0.08f), shape)
            .clickable(onClick = onTap)
            .padding(10.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            GameCardTeamAvatar(sport = "nfl", team = trend.teamAbbr, diameter = 22.dp, colors = NFLTeamColors.colorPair(trend.teamAbbr))
            Text(trend.teamAbbr, color = AppColors.appTextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Black)
            Spacer(Modifier.weight(1f))
            AppIcon.fromSystemName("chevron.up.forward")?.let {
                Icon(it.imageVector, null, tint = AppColors.appTextSecondary, modifier = Modifier.size(9.dp))
            }
        }
        Text(
            trendSeasonText(trend, kind),
            color = AppColors.appTextPrimary, fontSize = 11.sp, fontWeight = FontWeight.Bold, maxLines = 1,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
            val chips = lastChips(trend, kind)
            Text("L${chips.size}", color = AppColors.appTextSecondary, fontSize = 9.sp, fontWeight = FontWeight.Black)
            chips.forEach { chip -> TrendResultChip(chip) }
        }
    }
}

@Composable
private fun TrendResultChip(raw: String) {
    val value = raw.uppercase(Locale.US)
    Box(Modifier.size(21.dp).background(nflTrendChipColor(value), CircleShape), contentAlignment = Alignment.Center) {
        Text(value, color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Black)
    }
}

// MARK: - Matchup history

@Composable
private fun MatchupHistoryRowView(row: NFLMatchupHistoryRow) {
    val shape = RoundedCornerShape(14.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(AppColors.appSurfaceMuted.copy(alpha = 0.4f))
            .border(1.dp, Color.White.copy(alpha = 0.08f), shape)
            .padding(11.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(matchupHistoryDateLabel(row), color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Black)
            Spacer(Modifier.weight(1f))
            if (row.neutralSite == true) {
                Text("Neutral", color = AppColors.appAccentBlue, fontSize = 9.sp, fontWeight = FontWeight.Black)
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            MatchupTeam(row.awayTeam, row.awayScore)
            Text("@", color = AppColors.appTextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Black)
            MatchupTeam(row.homeTeam, row.homeScore)
            Spacer(Modifier.weight(1f))
            Text(
                "Total ${row.totalPoints ?: ((row.awayScore ?: 0) + (row.homeScore ?: 0))}",
                color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Bold,
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            HistoryPill("Winner", row.winnerTeam ?: "—", AppColors.appPrimary)
            HistoryPill(
                "Covered",
                row.coverTeam ?: row.atsResult ?: "Push",
                if (row.coverTeam == null) AppColors.appTextSecondary else hexColor(0x22C55E),
            )
            HistoryPill("O/U", row.ouResult ?: "—", ouColor(row.ouResult))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            val closing = "Spread ${GameCardFormatting.formatSpread(row.closingSpreadHome)}" +
                "  Total ${fmtHalf(row.closingTotal)}" +
                "  ML ${GameCardFormatting.formatMoneyline(row.closingMlAway)} / ${GameCardFormatting.formatMoneyline(row.closingMlHome)}"
            Text(closing, color = AppColors.appTextSecondary, fontSize = 10.sp, fontWeight = FontWeight.Bold, maxLines = 1)
        }
    }
}

@Composable
private fun MatchupTeam(abbr: String, score: Int?) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        GameCardTeamAvatar(sport = "nfl", team = abbr, diameter = 24.dp, colors = NFLTeamColors.colorPair(abbr))
        Text(abbr, color = AppColors.appTextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Black)
        Text(score?.toString() ?: "—", color = AppColors.appTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Black)
    }
}

@Composable
private fun HistoryPill(label: String, value: String, color: Color) {
    Row(
        Modifier
            .background(color.copy(alpha = 0.1f), CircleShape)
            .padding(horizontal = 7.dp, vertical = 5.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label.uppercase(Locale.US), color = AppColors.appTextSecondary, fontSize = 8.sp, fontWeight = FontWeight.Black)
        Text(value.uppercase(Locale.US), color = color, fontSize = 10.sp, fontWeight = FontWeight.Black)
    }
}

// MARK: - Signal definition sheet

@Composable
private fun SignalDefinitionSheet(signal: NFLSignalDefinition, perfByKey: Map<String, SignalPerformance>) {
    Column(
        Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Text(signal.displayName ?: signal.signalKey, color = AppColors.appTextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Black)
        signal.oneLiner?.let {
            Text(it, color = AppColors.appPrimary, fontSize = 14.sp, fontWeight = FontWeight.Bold)
        }
        SignalBlock("Definition", signal.definition)
        SignalBlock("Why It Works", signal.whyItWorks)
        SignalBlock("Bet Direction", signal.betDirection)
        SignalPerformanceStatsSection(
            backtestHit = signal.typicalHit,
            seasonPerformance = perfByKey[signal.signalKey],
        )
        Spacer(Modifier.size(12.dp))
    }
}

@Composable
private fun SignalBlock(title: String, body: String?) {
    if (body.isNullOrEmpty()) return
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(AppColors.appSurfaceMuted.copy(alpha = 0.45f))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(title.uppercase(Locale.US), color = AppColors.appTextSecondary, fontSize = 10.sp, fontWeight = FontWeight.Black)
        Text(body, color = AppColors.appTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Medium)
    }
}

// MARK: - Trend detail sheet

@Composable
private fun TrendDetailSheet(sel: NFLTrendDetailSelection) {
    val rows = detailRows(sel)
    Column(
        Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            GameCardTeamAvatar(sport = "nfl", team = sel.team.teamAbbr, diameter = 38.dp, colors = NFLTeamColors.colorPair(sel.team.teamAbbr))
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text("${sel.team.teamAbbr} ${sel.kind.title}", color = AppColors.appTextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Black)
                Text("Season game log, newest first", color = AppColors.appTextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Medium)
            }
        }
        Column {
            TrendDetailHeader(sel.kind)
            if (rows.isEmpty()) {
                Text(
                    "No posted rows for this trend type.",
                    color = AppColors.appTextMuted, fontSize = 13.sp, fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(vertical = 16.dp),
                )
            } else {
                rows.forEach { row -> TrendDetailRowView(row) }
            }
        }
        Spacer(Modifier.size(12.dp))
    }
}

@Composable
private fun TrendDetailHeader(kind: NFLTrendKind) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(AppColors.appSurfaceMuted.copy(alpha = 0.7f))
            .padding(vertical = 8.dp, horizontal = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(7.dp),
    ) {
        TableHeaderCell("Date", Modifier.width(42.dp))
        TableHeaderCell("Opp", Modifier.width(92.dp), TextAlign.Start)
        TableHeaderCell(kind.lineHeader, Modifier.width(50.dp))
        TableHeaderCell(kind.resultHeader, Modifier.width(42.dp))
        TableHeaderCell(kind.marginHeader, Modifier.weight(1f))
    }
}

@Composable
private fun TableHeaderCell(text: String, modifier: Modifier, align: TextAlign = TextAlign.Center) {
    Text(
        text.uppercase(Locale.US),
        color = AppColors.appTextSecondary, fontSize = 9.sp, fontWeight = FontWeight.Black,
        textAlign = align, maxLines = 1, modifier = modifier,
    )
}

@Composable
private fun TrendDetailRowView(row: NFLTrendGameDetailRow) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(AppColors.appSurface.copy(alpha = 0.55f))
            .padding(vertical = 9.dp, horizontal = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(7.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        TableValueCell(trendDateText(row.date), Modifier.width(42.dp))
        Row(Modifier.width(92.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                row.locationMarker,
                color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Black,
                textAlign = TextAlign.End, modifier = Modifier.width(16.dp),
            )
            GameCardTeamAvatar(sport = "nfl", team = row.opponent, diameter = 20.dp, colors = NFLTeamColors.colorPair(row.opponent))
            Text(row.opponent, color = AppColors.appTextPrimary, fontSize = 10.sp, fontWeight = FontWeight.Black, maxLines = 1)
        }
        TableValueCell(row.lineText, Modifier.width(50.dp))
        Box(Modifier.width(42.dp), contentAlignment = Alignment.Center) { TrendResultChip(row.result) }
        TableValueCell(formatSigned(row.margin), Modifier.weight(1f), marginColor(row.margin))
    }
}

@Composable
private fun TableValueCell(text: String, modifier: Modifier, color: Color = AppColors.appTextPrimary) {
    Text(
        text,
        color = color, fontSize = 10.sp, fontWeight = FontWeight.Bold,
        textAlign = TextAlign.Center, maxLines = 1, modifier = modifier,
    )
}

// MARK: - Grouping / formatting logic (mirrors iOS helpers 1:1)

private fun groupedPicks(picks: List<NFLDryrunPickRow>): List<NFLPickGroup> {
    val order = listOf("spread", "total", "team_total", "moneyline", "h1_spread", "h1_total", "h1_ml")
    return order.mapNotNull { group ->
        val rows = picks.filter { it.cardGroup == group }.sortedBy { it.sortOrder ?: 0 }
        if (rows.isEmpty()) null else NFLPickGroup(group, rows)
    }
}

private fun isMoneylineCard(pick: NFLDryrunPickRow): Boolean =
    pick.cardGroup == "moneyline" || pick.cardGroup == "h1_ml"

private fun modelLabel(pick: NFLDryrunPickRow): String = when (pick.cardGroup) {
    "spread", "h1_spread" -> "Model Line"
    "moneyline", "h1_ml" -> "Win Prob"
    "team_total" -> "Proj Pts"
    else -> "Model"
}

private fun modelMetricValue(pick: NFLDryrunPickRow): String {
    if (pick.cardGroup == "spread" || pick.cardGroup == "h1_spread") {
        return formatPickLine(pick.modelLine ?: pick.modelNumber, pick)
    }
    val value = pick.modelNumber ?: return "—"
    return if (isMoneylineCard(pick)) "${(value * 100).roundToInt()}%" else roundedStr(value)
}

private fun displayPickLabel(pick: NFLDryrunPickRow): String {
    if (pick.cardGroup != "spread" && pick.cardGroup != "h1_spread") {
        return pick.pickLabel ?: pick.recommendation ?: "No Bet"
    }
    val team = pick.pickTeam ?: return pick.pickLabel ?: pick.recommendation ?: "No Bet"
    val prefix = if (pick.cardGroup == "h1_spread") "$team 1H" else team
    return "$prefix ${formatPickLine(pick.bestLine ?: pick.vegasLine, pick)}"
}

private fun shouldShowTeamHeader(pick: NFLDryrunPickRow): Boolean = when (pick.cardGroup) {
    "spread", "h1_spread", "team_total", "moneyline", "h1_ml" -> pick.pickTeam != null
    else -> false
}

private fun isTotalHeader(pick: NFLDryrunPickRow): Boolean =
    pick.cardGroup == "total" || pick.cardGroup == "h1_total"

private fun overUnderDirection(pick: NFLDryrunPickRow): String? {
    val side = (pick.pickSide ?: pick.pickLabel ?: "").uppercase(Locale.US)
    return when {
        side.contains("UNDER") -> "UNDER"
        side.contains("OVER") -> "OVER"
        else -> null
    }
}

private fun teamPickHeaderText(pick: NFLDryrunPickRow, team: String): String {
    val name = teamNickname(team)
    return when (pick.cardGroup) {
        "spread" -> "$name ${formatPickLine(pick.bestLine ?: pick.vegasLine, pick)}"
        "h1_spread" -> "$name 1H ${formatPickLine(pick.bestLine ?: pick.vegasLine, pick)}"
        "team_total" -> {
            val direction = overUnderDirection(pick)
            if (direction != null) {
                "$name ${direction.lowercase(Locale.US).replaceFirstChar { it.uppercase() }} ${formatPickLine(pick.bestLine ?: pick.vegasLine, pick)}"
            } else {
                displayPickLabel(pick).replace(team, name)
            }
        }
        "moneyline" -> "$name ML"
        "h1_ml" -> "$name 1H ML"
        else -> displayPickLabel(pick)
    }
}

private fun teamNickname(team: String): String {
    val abbr = NFLTeamAssets.abbr(team)
    NFLTeamAssets.byAbbr[abbr.uppercase(Locale.US)]?.nick?.takeIf { it.isNotEmpty() }?.let { return it }
    return team.split(" ").lastOrNull { it.isNotEmpty() } ?: team
}

private fun formatPickLine(value: Double?, pick: NFLDryrunPickRow): String {
    value ?: return "—"
    if (pick.cardGroup == "spread" || pick.cardGroup == "h1_spread") {
        return GameCardFormatting.formatSpread(value)
    }
    return fmtHalf(value)
}

private fun roundedStr(value: Double): String =
    if (value == value.toLong().toDouble()) value.toLong().toString() else String.format(Locale.US, "%.1f", value)

private fun formatSigned(value: Double?): String {
    value ?: return "—"
    return "${if (value >= 0) "+" else ""}${String.format(Locale.US, "%.1f", value)}"
}

private fun bestBookValue(pick: NFLDryrunPickRow): String {
    if (isMoneylineCard(pick)) {
        return GameCardFormatting.formatMoneyline(pick.bestOdds?.roundToInt())
    }
    val line = formatPickLine(pick.bestLine, pick)
    val odds = GameCardFormatting.formatMoneyline(pick.bestOdds?.roundToInt())
    return "$line $odds"
}

private fun hasBestBook(pick: NFLDryrunPickRow): Boolean =
    pick.bestBook != null || pick.bestBookName != null || pick.bestBookLogo != null ||
        pick.bestLine != null || pick.bestOdds != null

private fun marginColor(value: Double?): Color = when {
    value == null -> AppColors.appTextSecondary
    value > 0 -> hexColor(0x22C55E)
    value < 0 -> AppColors.appAccentRed
    else -> AppColors.appTextSecondary
}

private fun ouColor(raw: String?): Color = when ((raw ?: "").uppercase(Locale.US)) {
    "OVER" -> hexColor(0x22C55E)
    "UNDER" -> AppColors.appAccentRed
    else -> AppColors.appTextSecondary
}

private fun trendKind(cardGroup: String): NFLTrendKind? = when (cardGroup) {
    "spread" -> NFLTrendKind.SPREAD
    "total" -> NFLTrendKind.TOTAL
    "team_total" -> NFLTrendKind.TEAM_TOTAL
    "h1_spread" -> NFLTrendKind.H1_SPREAD
    "h1_total" -> NFLTrendKind.H1_TOTAL
    else -> null
}

private fun trendSeasonText(trend: NFLTeamTrendRow, kind: NFLTrendKind): String = when (kind) {
    NFLTrendKind.SPREAD ->
        "Season ATS ${trend.atsW ?: 0}-${trend.atsL ?: 0}-${trend.atsP ?: 0} ${percentStr(trend.atsPct)}"
    NFLTrendKind.TOTAL ->
        "Season O/U ${trend.ouO ?: 0}-${trend.ouU ?: 0} ${percentStr(trend.overPct)}"
    NFLTrendKind.TEAM_TOTAL ->
        "Season TT Over ${trend.ttO ?: 0}-${trend.ttU ?: 0} ${percentStr(trend.ttOverPct)}"
    NFLTrendKind.MONEYLINE ->
        "Season SU ${trend.suRecord ?: "${trend.suW ?: 0}-${trend.suL ?: 0}"}"
    NFLTrendKind.H1_SPREAD ->
        "Season 1H ATS ${trend.h1AtsW ?: 0}-${trend.h1AtsL ?: 0}-${trend.h1AtsP ?: 0} ${percentStr(trend.h1AtsPct)}"
    NFLTrendKind.H1_TOTAL ->
        "Season 1H O/U ${trend.h1OuO ?: 0}-${trend.h1OuU ?: 0} ${percentStr(trend.h1OverPct)}"
}

private fun lastChips(trend: NFLTeamTrendRow, kind: NFLTrendKind): List<String> = when (kind) {
    NFLTrendKind.SPREAD -> trend.last5Ats.take(5)
    NFLTrendKind.H1_SPREAD -> trend.gameLog.mapNotNull { it.h1Ats }.take(5)
    NFLTrendKind.TOTAL -> trend.last5Ou.take(5)
    NFLTrendKind.H1_TOTAL -> trend.gameLog.mapNotNull { it.h1Ou }.take(5)
    NFLTrendKind.TEAM_TOTAL -> trend.gameLog.mapNotNull { it.tt }.take(5)
    NFLTrendKind.MONEYLINE -> trend.last5Su.take(5)
}

private fun detailRows(sel: NFLTrendDetailSelection): List<NFLTrendGameDetailRow> =
    sel.team.gameLog.mapNotNull { log ->
        val result: String?
        val line: Double?
        val margin: Double?
        when (sel.kind) {
            NFLTrendKind.SPREAD -> { result = log.ats; line = log.spread; margin = log.coverMargin }
            NFLTrendKind.TOTAL -> { result = log.ou; line = log.total; margin = log.ouMargin }
            NFLTrendKind.TEAM_TOTAL -> { result = log.tt; line = log.ttLine; margin = log.ttMargin }
            NFLTrendKind.MONEYLINE -> { result = log.su; line = null; margin = null }
            NFLTrendKind.H1_SPREAD -> { result = log.h1Ats; line = log.h1Spread; margin = log.h1CoverMargin }
            NFLTrendKind.H1_TOTAL -> { result = log.h1Ou; line = log.h1Total; margin = log.h1OuMargin }
        }
        if (result.isNullOrEmpty()) return@mapNotNull null
        NFLTrendGameDetailRow(
            date = log.date,
            opponent = log.opp ?: "",
            locationMarker = if (log.isHome == false) "@" else "",
            lineText = line?.let { fmtHalf(it) } ?: "—",
            result = result,
            margin = margin,
        )
    }

private fun teamAbbrFor(game: NFLPrediction, team: String?, awayAbbr: String, homeAbbr: String): String? {
    team ?: return null
    if (team == game.homeTeam) return homeAbbr
    if (team == game.awayTeam) return awayAbbr
    return NFLTeamAssets.abbr(team)
}

private fun percentStr(value: Double?): String =
    value?.let { "${(it * 100).roundToInt()}%" } ?: "—"

private fun trendDateText(raw: String?): String {
    if (raw.isNullOrEmpty()) return "—"
    for (pattern in listOf("yyyy-MM-dd", "yyyy-MM-dd HH:mm:ss")) {
        runCatching {
            val date = LocalDate.parse(raw.take(10), DateTimeFormatter.ofPattern(pattern.take(10)))
            return date.format(DateTimeFormatter.ofPattern("MM/dd"))
        }
    }
    return shortDate(raw)
}

private fun shortDate(raw: String?): String {
    if (raw.isNullOrEmpty()) return "—"
    return if (raw.length >= 10) raw.substring(5, 10).replace("-", "/") else raw
}

private fun matchupHistoryDateLabel(row: NFLMatchupHistoryRow): String {
    val season = row.season?.toString() ?: row.date?.takeIf { it.length >= 4 }?.take(4)
    season ?: return shortDate(row.date)
    return "$season Season - ${shortDate(row.date)}"
}

private fun fmtHalf(value: Double?): String {
    val r = GameCardFormatting.roundToNearestHalf(value) ?: return "—"
    return if (r % 1.0 == 0.0) r.toInt().toString() else String.format(Locale.US, "%.1f", r)
}

private fun lerp(a: Float, b: Float, t: Float): Float = a + (b - a) * t.coerceIn(0f, 1f)

package com.wagerproof.app.features.mlb

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
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
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.agents.components.AgentPickRationaleWidget
import com.wagerproof.app.features.components.CollapsingWidgetScroll
import com.wagerproof.app.features.components.TeamAuraBackground
import com.wagerproof.app.features.components.WidgetCollapsingSection
import com.wagerproof.app.features.components.WidgetHeaderAccessory
import com.wagerproof.app.features.components.polymarket.PolymarketWidget
import com.wagerproof.app.features.gamecards.HeroStat
import com.wagerproof.app.features.gamecards.MatchupGlassHero
import com.wagerproof.app.features.gamecards.MatchupHeroSide
import com.wagerproof.app.features.gamewidgets.InsightWidgetSkeleton
import com.wagerproof.app.features.gamewidgets.TrendSignalRow
import com.wagerproof.app.features.mlb.f5.F5SplitsDetailSheet
import com.wagerproof.app.features.mlb.f5.F5SplitsInsightWidget
import com.wagerproof.app.features.mlb.props.MLBMatchupPropsWidget
import com.wagerproof.app.features.mlb.props.MatchupPropsDetailSheet
import com.wagerproof.app.features.outliers.BettingTrendsDetailSheet
import com.wagerproof.app.features.outliers.BettingTrendsInsightWidget
import com.wagerproof.app.features.outliers.MLBTrendsMatrixAdapter
import com.wagerproof.app.features.outliers.TrendsGuide
import com.wagerproof.app.features.paywall.ProContentSection
import com.wagerproof.app.features.props.PlayerPropSelection
import com.wagerproof.app.features.shared.hexColor
import com.wagerproof.core.design.components.liquidGlassBackground
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.MLBF5Insight
import com.wagerproof.core.models.MLBF5Matchup
import com.wagerproof.core.models.MLBGame
import com.wagerproof.core.models.MLBGameTrends
import com.wagerproof.core.models.MLBPropMatchup
import com.wagerproof.core.models.MLBSignalItem
import com.wagerproof.core.models.MLBTrendsInsight
import com.wagerproof.core.models.TrendsSignal
import com.wagerproof.core.stores.MLBBettingTrendsStore
import com.wagerproof.core.stores.MLBBucketAccuracyStore
import com.wagerproof.core.stores.MLBBucketHelper
import com.wagerproof.core.stores.MLBF5SplitsStore
import com.wagerproof.core.stores.MLBRegressionReportStore
import com.wagerproof.core.stores.PropsStore
import java.util.Locale
import kotlin.math.abs

private enum class ProjectionView { FULL, F5 }

private sealed interface MLBInsightDetail {
    data class Props(val matchup: MLBPropMatchup) : MLBInsightDetail
    data class F5(val matchup: MLBF5Matchup) : MLBInsightDetail
}

/**
 * MLB matchup detail at feature/UI parity with iOS `MLBGameBottomSheet`.
 * Stores are injected by [MLBGameCarousel], so every page consumes one slate
 * fetch and first-hydrate skeletons never flash again after a cache stamp.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MLBGameDetailPage(
    game: MLBGame,
    topInset: Dp,
    bottomInset: Dp,
    trendsStore: MLBBettingTrendsStore,
    f5Store: MLBF5SplitsStore,
    propsStore: PropsStore,
    accuracyStore: MLBBucketAccuracyStore,
    regressionStore: MLBRegressionReportStore,
    onSelectProp: (PlayerPropSelection) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (game.isPostponed == true) {
        PostponedPage(game, topInset, bottomInset, modifier)
        return
    }

    var projection by remember(game.id) { mutableStateOf(ProjectionView.FULL) }
    var mlExpanded by remember(game.id) { mutableStateOf(false) }
    var ouExpanded by remember(game.id) { mutableStateOf(false) }
    var trendsDetailOpen by remember(game.id) { mutableStateOf(false) }
    var insightDetail by remember(game.id) { mutableStateOf<MLBInsightDetail?>(null) }

    val awayName = game.awayTeamName ?: game.awayTeam ?: "Away"
    val homeName = game.homeTeamName ?: game.homeTeam ?: "Home"
    val awayColors = mlbTeamColorPair(awayName.ifEmpty { game.awayAbbr })
    val homeColors = mlbTeamColorPair(homeName.ifEmpty { game.homeAbbr })
    val hasWeather = game.temperatureF != null || game.sky != null || game.windSpeedMph != null
    val trends = trendsStore.trends(game.gamePk)
    val trendsSummary = trends?.let(MLBTrendsInsight::summary)
    val mlTrendSignals = trendsSummary?.signals.orEmpty().filter { it.kind is TrendsSignal.Kind.Side }.take(2)
    val totalTrendSignals = trendsSummary?.signals.orEmpty().filter {
        it.kind is TrendsSignal.Kind.Over || it.kind is TrendsSignal.Kind.Under
    }.take(2)

    CollapsingWidgetScroll(
        heroMaxHeight = if (hasWeather) 272.dp else 236.dp,
        heroMinHeight = 122.dp,
        heroTopInset = topInset,
        bottomInset = bottomInset,
        transparentPage = true,
        modifier = modifier.fillMaxSize(),
        background = { progress -> TeamAuraBackground(awayColors.primary, homeColors.primary, progress) },
        hero = { progress -> MLBHero(game, progress, awayColors, homeColors, hasWeather) },
    ) {
        item {
            WidgetCollapsingSection("Market Odds", icon = AppIcon.CHART_BAR_FILL, iconTint = AppColors.appPrimary) {
                PolymarketWidget(
                    league = "mlb",
                    awayTeam = awayName,
                    homeTeam = homeName,
                    awayColors = awayColors,
                    homeColors = homeColors,
                    awayAbbr = game.awayAbbr,
                    homeAbbr = game.homeAbbr,
                )
            }
        }

        if (game.fullGameRuns != null || game.f5Runs != null) {
            item {
                ProjectedScoreSection(game, projection) { projection = it }
            }
        }

        moneylineProjection(game, projection)?.let { pick ->
            item {
                MoneylineSection(
                    game = game,
                    projection = projection,
                    pick = pick,
                    expanded = mlExpanded,
                    accuracyStore = accuracyStore,
                    trends = mlTrendSignals,
                    onToggle = { mlExpanded = !mlExpanded },
                )
            }
        }

        totalProjection(game, projection)?.let { pick ->
            item {
                TotalSection(
                    projection = projection,
                    pick = pick,
                    expanded = ouExpanded,
                    accuracyStore = accuracyStore,
                    trends = totalTrendSignals,
                    onToggle = { ouExpanded = !ouExpanded },
                )
            }
        }

        val f5Matchup = f5Store.matchup(game.gamePk)
        val f5Summary = f5Matchup?.let(MLBF5Insight::summary)
        if (f5Matchup != null && f5Summary != null) {
            item {
                F5SplitsInsightWidget(f5Summary, onExpand = { insightDetail = MLBInsightDetail.F5(f5Matchup) })
            }
        } else if (f5Store.isLoading && f5Store.lastFetched == null) {
            item {
                WidgetCollapsingSection("First-5 Innings", icon = AppIcon.BASEBALL_DIAMOND_BASES) {
                    InsightWidgetSkeleton()
                }
            }
        }

        val regressionPicks = regressionStore.suggestedPicks(game.gamePk)
        if (regressionPicks.isNotEmpty()) {
            item {
                WidgetCollapsingSection(
                    if (regressionPicks.size > 1) "Regression Report Picks" else "Regression Report Pick",
                    icon = AppIcon.CHART_BAR_XAXIS,
                    iconTint = hexColor(0xA855F7L),
                ) {
                    ProContentSection(title = "Regression Picks", minHeight = 120.dp) {
                        MLBRegressionPicksSection(game = game, picks = regressionPicks)
                    }
                }
            }
        }

        val propsMatchup = propsStore.matchup(game.gamePk)
        if (propsMatchup != null) {
            item {
                MLBMatchupPropsWidget(
                    matchup = propsMatchup,
                    onSelect = onSelectProp,
                    onExpand = { insightDetail = MLBInsightDetail.Props(propsMatchup) },
                )
            }
        } else if (propsStore.isLoadingMLB && !propsStore.hasLoadedMLB) {
            item {
                WidgetCollapsingSection("Player Props", icon = AppIcon.FIGURE_BASEBALL) {
                    InsightWidgetSkeleton()
                }
            }
        }

        if (trends != null) {
            item {
                BettingTrendsInsightWidget(
                    summary = MLBTrendsInsight.summary(trends),
                    awayAbbr = game.awayAbbr,
                    homeAbbr = game.homeAbbr,
                    accent = MLBTrendsMatrixAdapter.accent,
                    onExpand = { trendsDetailOpen = true },
                )
            }
        } else if (trendsStore.loading && trendsStore.lastFetched == null) {
            item {
                WidgetCollapsingSection(
                    "Betting Trends",
                    icon = AppIcon.CHART_LINE_UPTREND,
                    iconTint = hexColor(0x8B5CF6L),
                ) { InsightWidgetSkeleton() }
            }
        }

        item { SignalsSection(game.signals) }

        item {
            AgentPickRationaleWidget(
                gameKeys = listOf(
                    game.gamePk.toString(),
                    "${game.awayAbbr}_${game.homeAbbr}",
                    if (game.awayTeamName != null && game.homeTeamName != null) {
                        "${game.awayTeamName}_${game.homeTeamName}"
                    } else null,
                ),
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
            )
        }
    }

    if (trendsDetailOpen && trends != null) {
        BettingTrendsDetailSheet(
            awayName = trends.awayTeam.teamName,
            homeName = trends.homeTeam.teamName,
            timeDisplay = MLBTrendsMatrixAdapter.timeDisplay(trends),
            stripeColors = MLBTrendsMatrixAdapter.stripeColors(trends),
            accent = MLBTrendsMatrixAdapter.accent,
            sections = MLBTrendsMatrixAdapter.sections(trends),
            guide = TrendsGuide.mlb,
            avatar = MLBTrendsMatrixAdapter.avatarProvider(trends),
            onDismiss = { trendsDetailOpen = false },
        )
    }

    insightDetail?.let { detail ->
        val state = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(
            onDismissRequest = { insightDetail = null },
            sheetState = state,
            containerColor = AppColors.appSurface,
            dragHandle = null,
        ) {
            Box(Modifier.fillMaxWidth().fillMaxHeight(0.94f)) {
                when (detail) {
                    is MLBInsightDetail.F5 -> F5SplitsDetailSheet(detail.matchup)
                    is MLBInsightDetail.Props -> MatchupPropsDetailSheet(
                        matchup = detail.matchup,
                        onSelect = {
                            insightDetail = null
                            onSelectProp(it)
                        },
                    )
                }
                Icon(
                    AppIcon.XMARK.imageVector,
                    contentDescription = "Close",
                    tint = AppColors.appTextPrimary,
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(12.dp)
                        .size(34.dp)
                        .clip(CircleShape)
                        .background(AppColors.appSurfaceElevated.copy(alpha = 0.9f))
                        .clickable { insightDetail = null }
                        .padding(8.dp),
                )
            }
        }
    }
}

@Composable
private fun PostponedPage(game: MLBGame, topInset: Dp, bottomInset: Dp, modifier: Modifier) {
    Box(
        modifier.fillMaxSize().background(AppColors.appSurface).padding(top = topInset + 64.dp, bottom = bottomInset, start = 16.dp, end = 16.dp),
        contentAlignment = Alignment.TopCenter,
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(AppColors.appSurfaceElevated)
                .border(1.dp, AppColors.appBorder, RoundedCornerShape(16.dp))
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("${game.awayAbbr} @ ${game.homeAbbr}", color = AppColors.appTextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Bold)
            Row(
                Modifier.clip(RoundedCornerShape(10.dp)).background(AppColors.appAccentRed.copy(alpha = 0.15f)).padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Icon(AppIcon.EXCLAMATION_TRIANGLE.imageVector, null, tint = AppColors.appAccentRed, modifier = Modifier.size(18.dp))
                Text("Postponed", color = AppColors.appAccentRed, fontSize = 14.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun MLBHero(
    game: MLBGame,
    progress: Float,
    awayColors: com.wagerproof.app.features.gamecards.TeamColorPair,
    homeColors: com.wagerproof.app.features.gamecards.TeamColorPair,
    hasWeather: Boolean,
) {
    val detail = (1f - progress * 1.9f).coerceIn(0f, 1f)
    val awayName = game.awayTeamName ?: game.awayTeam ?: "Away"
    val homeName = game.homeTeamName ?: game.homeTeam ?: "Home"
    Column(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(top = 8.dp),
        verticalArrangement = Arrangement.spacedBy(lerp(12f, 6f, progress).dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(MLBFormatting.dateLabel(game.officialDate), color = AppColors.appTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            Text(
                MLBFormatting.gameTime(game.gameTimeEt),
                color = AppColors.appTextSecondary,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.liquidGlassBackground(CircleShape).padding(horizontal = 10.dp, vertical = 4.dp),
            )
            Spacer(Modifier.weight(1f))
            game.isFinalPrediction?.let { final -> PredictionStatusPill(final) }
        }
        MatchupGlassHero(
            away = MatchupHeroSide(game.awayLogoUrl, game.awayAbbr, awayColors, game.awayMl),
            home = MatchupHeroSide(game.homeLogoUrl, game.homeAbbr, homeColors, game.homeMl),
            progress = progress,
            expandedStats = listOf(
                HeroStat("ML", "${MLBFormatting.moneyline(game.awayMl)} / ${MLBFormatting.moneyline(game.homeMl)}"),
                HeroStat("Run Line", "${MLBFormatting.spread(game.awaySpread)} / ${MLBFormatting.spread(game.homeSpread)}"),
                HeroStat("O/U", MLBFormatting.line(game.totalLine)),
            ),
            collapsedStats = listOf(
                HeroStat("Run Line", "${MLBFormatting.spread(game.awaySpread)} / ${MLBFormatting.spread(game.homeSpread)}"),
                HeroStat("O/U", MLBFormatting.line(game.totalLine)),
            ),
            fusedTitle = "${game.awayAbbr} @ ${game.homeAbbr}",
        )
        if ((game.awaySpName != null || game.homeSpName != null) && detail > 0.04f) {
            StartingPitchers(game, Modifier.alpha(detail))
        }
        if (hasWeather && detail > 0.08f) {
            WeatherRow(game, Modifier.alpha(detail))
        }
    }
}

@Composable
private fun PredictionStatusPill(final: Boolean) {
    val tint = if (final) AppColors.appPrimary else hexColor(0xF59E0BL)
    Row(
        Modifier.clip(CircleShape).background(tint.copy(alpha = 0.16f)).border(0.5.dp, tint.copy(alpha = 0.3f), CircleShape).padding(horizontal = 8.dp, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        if (final) Icon(AppIcon.LOCK_FILL.imageVector, null, tint = tint, modifier = Modifier.size(10.dp))
        Text(if (final) "Final" else "Preliminary", color = tint, fontSize = 10.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun StartingPitchers(game: MLBGame, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxWidth()) {
        Box(Modifier.fillMaxWidth().height(0.5.dp).background(AppColors.appBorder.copy(alpha = 0.4f)))
        Row(
            Modifier.fillMaxWidth().padding(top = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            StarterCell(game.awaySpName, game.awaySpConfirmed, Modifier.weight(1f))
            StarterCell(game.homeSpName, game.homeSpConfirmed, Modifier.weight(1f))
        }
    }
}

@Composable
private fun StarterCell(name: String?, confirmed: Boolean?, modifier: Modifier) {
    Row(modifier, horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
        Text("SP", color = AppColors.appTextSecondary, fontSize = 10.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.width(4.dp))
        Text(name ?: "TBD", color = AppColors.appTextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Medium, maxLines = 1)
        Spacer(Modifier.width(4.dp))
        Text(if (confirmed == true) "✓" else "TBD", color = if (confirmed == true) AppColors.appPrimary else AppColors.appAccentAmber, fontSize = 11.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun WeatherRow(game: MLBGame, modifier: Modifier = Modifier) {
    Row(modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
        game.sky?.let { WeatherChip(it, skyIcon(it), AppColors.appPrimary) }
        game.temperatureF?.let { temp ->
            Spacer(Modifier.width(8.dp))
            WeatherChip("TEMP\n${temp.toInt()}°F", AppIcon.fromSystemName("thermometer.medium") ?: AppIcon.TARGET, temperatureTint(temp))
        }
        game.windSpeedMph?.let { wind ->
            Spacer(Modifier.width(8.dp))
            WeatherChip("${(game.windDirection ?: "WIND").uppercase()}\n${wind.toInt()} mph", AppIcon.fromSystemName("wind") ?: AppIcon.CHART_LINE_UPTREND, if (wind >= 15) AppColors.appAccentAmber else AppColors.appAccentBlue)
        }
    }
}

@Composable
private fun WeatherChip(text: String, icon: AppIcon, tint: Color) {
    Row(
        Modifier.clip(CircleShape).background(tint.copy(alpha = 0.12f)).border(1.dp, tint.copy(alpha = 0.22f), CircleShape).padding(horizontal = 10.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Icon(icon.imageVector, null, tint = tint, modifier = Modifier.size(16.dp))
        Text(text, color = AppColors.appTextPrimary, fontSize = 11.sp, fontWeight = FontWeight.Bold, lineHeight = 12.sp, maxLines = 2)
    }
}

@Composable
private fun ProjectedScoreSection(game: MLBGame, projection: ProjectionView, onProjection: (ProjectionView) -> Unit) {
    WidgetCollapsingSection("Projected Score", icon = AppIcon.SPORTSCOURT, iconTint = AppColors.appPrimary) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
            ProjectionToggle(projection, onProjection)
            val scores = when (projection) {
                ProjectionView.FULL -> game.fullGameRuns?.let { it.away to it.home }
                ProjectionView.F5 -> game.f5Runs?.let { it.away to it.home }
            }
            if (scores == null) {
                Text(
                    "Projection unavailable for ${if (projection == ProjectionView.FULL) "full game" else "1st 5"}",
                    color = AppColors.appTextSecondary,
                    fontSize = 13.sp,
                    fontStyle = FontStyle.Italic,
                )
            } else {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    MLBTeamLogo(game.awayLogoUrl, game.awayAbbr, game.awayTeamName.orEmpty(), 36.dp)
                    Text(fmt1(scores.first), color = AppColors.appTextPrimary, fontSize = 28.sp, fontWeight = FontWeight.Black)
                    Text("–", color = AppColors.appTextSecondary, fontSize = 24.sp, fontWeight = FontWeight.Light)
                    Text(fmt1(scores.second), color = AppColors.appTextPrimary, fontSize = 28.sp, fontWeight = FontWeight.Black)
                    MLBTeamLogo(game.homeLogoUrl, game.homeAbbr, game.homeTeamName.orEmpty(), 36.dp)
                }
            }
        }
    }
}

@Composable
private fun ProjectionToggle(projection: ProjectionView, onProjection: (ProjectionView) -> Unit) {
    Row(Modifier.clip(RoundedCornerShape(10.dp)).background(AppColors.appSurfaceMuted).padding(3.dp)) {
        ProjectionToggleButton("Full Game", projection == ProjectionView.FULL) { onProjection(ProjectionView.FULL) }
        ProjectionToggleButton("1st 5", projection == ProjectionView.F5) { onProjection(ProjectionView.F5) }
    }
}

@Composable
private fun ProjectionToggleButton(label: String, active: Boolean, onClick: () -> Unit) {
    Text(
        label,
        color = if (active) Color.White else AppColors.appTextSecondary,
        fontSize = 12.sp,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier.clip(RoundedCornerShape(8.dp)).background(if (active) AppColors.appPrimary else Color.Transparent).clickable(onClick = onClick).padding(horizontal = 14.dp, vertical = 6.dp),
    )
}

private data class MoneylinePick(
    val side: String,
    val abbr: String,
    val logo: String?,
    val teamName: String,
    val probability: Double,
    val implied: Double?,
    val edge: Double?,
    val strong: Boolean,
)

private fun moneylineProjection(game: MLBGame, projection: ProjectionView): MoneylinePick? {
    val homeEdge = if (projection == ProjectionView.FULL) game.homeMlEdgePct else game.f5HomeMlEdgePct
    val awayEdge = if (projection == ProjectionView.FULL) game.awayMlEdgePct else game.f5AwayMlEdgePct
    val homeProb = if (projection == ProjectionView.FULL) game.mlHomeWinProb else game.f5HomeWinProb
    val awayProb = if (projection == ProjectionView.FULL) game.mlAwayWinProb else game.f5AwayWinProb
    val side = when {
        homeEdge != null && awayEdge != null -> if (homeEdge >= awayEdge) "home" else "away"
        homeProb != null && awayProb != null -> if (homeProb >= awayProb) "home" else "away"
        else -> return null
    }
    val prob = if (side == "home") homeProb else awayProb ?: return null
    val edge = if (side == "home") homeEdge else awayEdge
    val implied = if (projection == ProjectionView.FULL) {
        if (side == "home") game.homeImpliedProb else game.awayImpliedProb
    } else if (prob != null && edge != null) {
        prob - edge / 100.0
    } else null
    return MoneylinePick(
        side = side,
        abbr = if (side == "home") game.homeAbbr else game.awayAbbr,
        logo = if (side == "home") game.homeLogoUrl else game.awayLogoUrl,
        teamName = if (side == "home") game.homeTeamName.orEmpty() else game.awayTeamName.orEmpty(),
        probability = prob ?: return null,
        implied = implied,
        edge = edge,
        strong = when {
            projection == ProjectionView.FULL && side == "home" -> game.homeMlStrongSignal == true
            projection == ProjectionView.FULL -> game.awayMlStrongSignal == true
            side == "home" -> game.f5HomeMlStrongSignal == true
            else -> game.f5AwayMlStrongSignal == true
        },
    )
}

@Composable
private fun MoneylineSection(
    game: MLBGame,
    projection: ProjectionView,
    pick: MoneylinePick,
    expanded: Boolean,
    accuracyStore: MLBBucketAccuracyStore,
    trends: List<TrendsSignal>,
    onToggle: () -> Unit,
) {
    val tint = if (pick.strong) AppColors.appPrimary else hexColor(0xEAB308L)
    WidgetCollapsingSection(
        title = if (projection == ProjectionView.FULL) "Moneyline Projection" else "1st 5 Moneyline",
        icon = AppIcon.BASEBALL,
        iconTint = AppColors.appPrimary,
        accessory = WidgetHeaderAccessory.Chevron(expanded),
        onHeaderTap = onToggle,
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
            ComparisonRow("Vegas", pick.implied?.let(::fmtPct) ?: "–", "Our Model", fmtPct(pick.probability), tint)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                MLBTeamLogo(pick.logo, pick.abbr, pick.teamName, 36.dp)
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text("Edge to ${pick.abbr}", color = AppColors.appTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                    pick.edge?.let {
                        Text("${if (it >= 0) "+" else ""}${fmt1(it)}% delta", color = if (it >= 0) tint else AppColors.appAccentRed, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    }
                }
                AccuracyBadge(
                    lookup = pick.edge?.let {
                        MLBBucketHelper.lookup(accuracyStore.data, if (projection == ProjectionView.FULL) "full_ml" else "f5_ml", it, side = pick.side)
                    },
                )
            }
            SituationalSignals(trends)
            if (expanded) {
                DividerLine()
                Text(
                    buildString {
                        append("The model gives ${pick.abbr} a ${fmtPct(pick.probability)} chance to win")
                        if (projection == ProjectionView.F5) append(" through 5 innings")
                        pick.implied?.let { append(" vs Vegas implied ${fmtPct(it)}") }
                        pick.edge?.let { append(", a ${if (it >= 0) "+" else ""}${fmt1(it)}% edge.") } ?: append(".")
                    },
                    color = AppColors.appTextSecondary,
                    fontSize = 13.sp,
                    lineHeight = 18.sp,
                )
            }
        }
    }
}

private data class TotalPick(val direction: String, val fairTotal: Double?, val line: Double?, val edge: Double?)

private fun totalProjection(game: MLBGame, projection: ProjectionView): TotalPick? {
    val fair = if (projection == ProjectionView.FULL) game.ouFairTotal else game.f5FairTotal
    val line = if (projection == ProjectionView.FULL) game.totalLine else game.f5TotalLine
    val edge = if (projection == ProjectionView.FULL) game.ouEdge else game.f5OuEdge
    val direction = if (projection == ProjectionView.FULL) game.ouDirection else edge?.let { if (it >= 0) "OVER" else "UNDER" }
    return direction?.let { TotalPick(it.uppercase(), fair, line, edge) }
}

@Composable
private fun TotalSection(
    projection: ProjectionView,
    pick: TotalPick,
    expanded: Boolean,
    accuracyStore: MLBBucketAccuracyStore,
    trends: List<TrendsSignal>,
    onToggle: () -> Unit,
) {
    val over = pick.direction == "OVER"
    val tint = if (over) AppColors.appPrimary else AppColors.appAccentRed
    WidgetCollapsingSection(
        title = if (projection == ProjectionView.FULL) "Total Projection" else "1st 5 Total",
        icon = if (over) AppIcon.ARROW_UP else AppIcon.ARROW_DOWN,
        iconTint = tint,
        accessory = WidgetHeaderAccessory.Chevron(expanded),
        onHeaderTap = onToggle,
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
            ComparisonRow("Vegas O/U", MLBFormatting.line(pick.line), "Our Model", pick.fairTotal?.let(::fmt1) ?: "–", tint)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Icon(if (over) AppIcon.CHEVRON_UP_FORWARD.imageVector else AppIcon.CHEVRON_DOWN.imageVector, null, tint = tint, modifier = Modifier.size(32.dp))
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text("Edge to ${if (over) "Over" else "Under"}", color = AppColors.appTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                    if (pick.fairTotal != null && pick.line != null) {
                        Text("${fmt1(abs(pick.fairTotal - pick.line))} pts delta", color = tint, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    }
                }
                AccuracyBadge(
                    lookup = pick.edge?.let {
                        MLBBucketHelper.lookup(accuracyStore.data, if (projection == ProjectionView.FULL) "full_ou" else "f5_ou", it, direction = pick.direction)
                    },
                )
            }
            SituationalSignals(trends)
            if (expanded) {
                DividerLine()
                Text(
                    "The model projects a fair${if (projection == ProjectionView.F5) " F5" else ""} total of ${pick.fairTotal?.let(::fmt1) ?: "N/A"} vs the market line of ${MLBFormatting.line(pick.line)}, suggesting the ${if (over) "Over" else "Under"}.",
                    color = AppColors.appTextSecondary,
                    fontSize = 13.sp,
                    lineHeight = 18.sp,
                )
            }
        }
    }
}

@Composable
private fun ComparisonRow(leftLabel: String, leftValue: String, rightLabel: String, rightValue: String, rightColor: Color) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        ComparisonBox(leftLabel, leftValue, AppColors.appTextPrimary, false, Modifier.weight(1f))
        Icon(AppIcon.ARROW_RIGHT.imageVector, null, tint = AppColors.appTextSecondary, modifier = Modifier.size(18.dp))
        ComparisonBox(rightLabel, rightValue, rightColor, true, Modifier.weight(1f))
    }
}

@Composable
private fun ComparisonBox(label: String, value: String, color: Color, highlight: Boolean, modifier: Modifier) {
    Column(
        modifier.clip(RoundedCornerShape(12.dp)).background(if (highlight) color.copy(alpha = 0.1f) else AppColors.appSurfaceMuted.copy(alpha = 0.5f)).then(
            if (highlight) Modifier.border(1.dp, color.copy(alpha = 0.25f), RoundedCornerShape(12.dp)) else Modifier,
        ).padding(horizontal = 8.dp, vertical = 12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(label.uppercase(), color = if (highlight) color else color.copy(alpha = 0.7f), fontSize = 11.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.5.sp)
        Text(value, color = color, fontSize = 24.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, textAlign = TextAlign.Center)
    }
}

@Composable
private fun AccuracyBadge(lookup: com.wagerproof.core.models.MLBBucketLookup?) {
    if (lookup == null) return
    Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(String.format(Locale.US, "%.0f%%", lookup.winPct), color = AppColors.appPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold)
        Text(lookup.record, color = AppColors.appTextSecondary, fontSize = 10.sp)
    }
}

@Composable
private fun SituationalSignals(signals: List<TrendsSignal>) {
    if (signals.isEmpty()) return
    DividerLine()
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("SITUATIONAL EDGE", color = AppColors.appTextSecondary, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp)
        signals.forEach { TrendSignalRow(it) }
    }
}

@Composable
private fun SignalsSection(signals: List<MLBSignalItem>) {
    WidgetCollapsingSection(
        title = "Game Signals",
        icon = AppIcon.ANTENNA_RADIOWAVES,
        iconTint = AppColors.appPrimary,
        accessory = if (signals.isEmpty()) WidgetHeaderAccessory.None else WidgetHeaderAccessory.Verdict(
            "${signals.size} SIGNAL${if (signals.size == 1) "" else "S"}",
            AppColors.appPrimary,
        ),
    ) {
        ProContentSection(title = "Game Signals", minHeight = 120.dp) {
            if (signals.isEmpty()) {
                Text(
                    "No supplemental betting signals for this matchup right now. Your projections and edges above are the same full model outputs — this block only adds extra situational or trend context when our system surfaces it.",
                    color = AppColors.appTextSecondary,
                    fontSize = 12.sp,
                    fontStyle = FontStyle.Italic,
                    lineHeight = 17.sp,
                )
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    signals.forEach { SignalPill(it) }
                }
            }
        }
    }
}

@Composable
private fun SignalPill(signal: MLBSignalItem) {
    val colors = signalColors(signal.severity)
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(colors.first).border(1.dp, colors.second, RoundedCornerShape(12.dp)).padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(signalIcon(signal.category).imageVector, null, tint = colors.third, modifier = Modifier.size(14.dp))
        Text(signal.message, color = AppColors.appTextPrimary, fontSize = 13.sp, lineHeight = 16.sp)
    }
}

@Composable
private fun DividerLine() {
    Box(Modifier.fillMaxWidth().height(0.5.dp).background(AppColors.appBorder.copy(alpha = 0.3f)))
}

private fun signalColors(severity: String): Triple<Color, Color, Color> = when (severity) {
    "negative" -> Triple(hexColor(0xF97316L).copy(alpha = 0.15f), hexColor(0xF97316L).copy(alpha = 0.35f), hexColor(0xFB923CL))
    "positive" -> Triple(hexColor(0x22C55EL).copy(alpha = 0.12f), hexColor(0x22C55EL).copy(alpha = 0.30f), hexColor(0x4ADE80L))
    "over" -> Triple(hexColor(0xF59E0BL).copy(alpha = 0.15f), hexColor(0xF59E0BL).copy(alpha = 0.35f), hexColor(0xFBBF24L))
    "under" -> Triple(hexColor(0x3B82F6L).copy(alpha = 0.15f), hexColor(0x3B82F6L).copy(alpha = 0.35f), hexColor(0x60A5FAL))
    else -> Triple(hexColor(0x94A3B8L).copy(alpha = 0.10f), hexColor(0x94A3B8L).copy(alpha = 0.25f), hexColor(0x94A3B8L))
}

private fun signalIcon(category: String): AppIcon = when (category.lowercase()) {
    "pitcher" -> AppIcon.FIGURE_BASEBALL
    "bullpen" -> AppIcon.FLAME_FILL
    "batting" -> AppIcon.CHART_LINE_UPTREND
    "schedule" -> AppIcon.CLOCK
    "weather" -> AppIcon.fromSystemName("cloud.sun") ?: AppIcon.CHART_LINE_UPTREND
    "park" -> AppIcon.PIN_FILL
    else -> AppIcon.TARGET
}

private fun skyIcon(sky: String): AppIcon {
    val s = sky.lowercase()
    val name = when {
        "rain" in s || "shower" in s -> "cloud.rain"
        "storm" in s || "thunder" in s -> "cloud.bolt.rain"
        "snow" in s || "flurr" in s -> "snowflake"
        "overcast" in s -> "cloud"
        "cloud" in s || "partly" in s -> "cloud.sun"
        "fog" in s || "haz" in s -> "cloud.fog"
        "clear" in s || "sunny" in s -> "sun.max"
        else -> "cloud.sun"
    }
    return AppIcon.fromSystemName(name) ?: AppIcon.CHART_LINE_UPTREND
}

private fun temperatureTint(temp: Double): Color = when {
    temp <= 35 -> AppColors.appAccentBlue
    temp >= 80 -> AppColors.appAccentRed
    else -> AppColors.appAccentAmber
}

private fun fmt1(value: Double): String = String.format(Locale.US, "%.1f", value)
private fun fmtPct(value: Double): String = String.format(Locale.US, "%.1f%%", value * 100)
private fun lerp(a: Float, b: Float, t: Float): Float = a + (b - a) * t.coerceIn(0f, 1f)

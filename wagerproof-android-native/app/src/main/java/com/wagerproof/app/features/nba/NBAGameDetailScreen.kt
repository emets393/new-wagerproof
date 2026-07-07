package com.wagerproof.app.features.nba

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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import com.wagerproof.app.features.components.FadeAlertTooltip
import com.wagerproof.app.features.components.FadeBetType
import com.wagerproof.app.features.components.TeamAuraBackground
import com.wagerproof.app.features.components.WidgetCollapsingSection
import com.wagerproof.app.features.components.WidgetHeaderAccessory
import com.wagerproof.app.features.components.polymarket.PolymarketWidget
import com.wagerproof.app.features.gamecards.GameCardFormatting
import com.wagerproof.app.features.gamecards.GameCardTeamAvatar
import com.wagerproof.app.features.gamecards.NBATeams
import com.wagerproof.app.features.gamecards.TeamInitials
import com.wagerproof.app.features.gamewidgets.InsightWidgetSkeleton
import com.wagerproof.app.features.outliers.BettingTrendsDetailSheet
import com.wagerproof.app.features.outliers.BettingTrendsInsightWidget
import com.wagerproof.app.features.outliers.NBATrendsMatrixAdapter
import com.wagerproof.app.features.outliers.TrendsGuide
import com.wagerproof.app.features.paywall.ProContentSection
import com.wagerproof.app.features.shared.hexColor
import com.wagerproof.core.design.components.liquidGlassBackground
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.NBAAccuracyBucket
import com.wagerproof.core.models.NBAGame
import com.wagerproof.core.models.NBAModelAccuracyData
import com.wagerproof.core.models.NBATrendsInsight
import com.wagerproof.core.stores.LoadState
import com.wagerproof.core.stores.NBABettingTrendsStore
import com.wagerproof.core.stores.NBAMatchupOverviewStore
import com.wagerproof.core.stores.NBAModelAccuracyStore
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * NBA game-detail page — port of iOS `NBAGameBottomSheet`. Section order:
 * Market Odds → Spread Prediction (LIVE fade alert: edge ≥ 9.5 or prob ≥ 0.8) →
 * O/U Prediction → Injury Report (Pro) → Recent Trends (Pro) → Betting Trends →
 * Model Accuracy → Team Stats (Adj Off/Def/Pace + ATS% + Over%) → Match
 * Simulator (2.5s reveal) → Agent rationale.
 *
 * Stores are screen-local like iOS `@State` stores; three parallel fetches run
 * in a LaunchedEffect keyed on the game (matchup overview + trends + accuracy).
 */
@Composable
fun NBAGameDetailPage(
    game: NBAGame,
    topInset: Dp,
    bottomInset: Dp,
    modifier: Modifier = Modifier,
) {
    val scope = rememberCoroutineScope()
    val matchupStore = remember { NBAMatchupOverviewStore() }
    val trendsStore = remember { NBABettingTrendsStore() }
    val accuracyStore = remember { NBAModelAccuracyStore() }

    // Transient sheet state, reset when a new game opens (keyed on id).
    var spreadExpanded by remember(game.id) { mutableStateOf(false) }
    var ouExpanded by remember(game.id) { mutableStateOf(false) }
    var injuryExpanded by remember(game.id) { mutableStateOf(false) }
    var trendsExpanded by remember(game.id) { mutableStateOf(false) }
    var simulating by remember(game.id) { mutableStateOf(false) }
    var simulationRevealed by remember(game.id) { mutableStateOf(false) }
    var trendsDetailOpen by remember(game.id) { mutableStateOf(false) }

    val awayColors = NBATeams.colorPair(game.awayTeam)
    val homeColors = NBATeams.colorPair(game.homeTeam)

    LaunchedEffect(game.id) {
        matchupStore.reset()
        // Three independent fetches in parallel — mirrors iOS's async-let trio.
        coroutineScope {
            val matchup = async { matchupStore.load(game.awayTeam, game.homeTeam, game.gameDate) }
            val trends = async { trendsStore.refreshIfNeeded() }
            val accuracy = async { accuracyStore.refresh() }
            matchup.await(); trends.await(); accuracy.await()
        }
    }

    CollapsingWidgetScroll(
        heroMaxHeight = 196.dp,
        heroMinHeight = 124.dp,
        modifier = modifier.fillMaxSize(),
        heroTopInset = topInset,
        bottomInset = bottomInset,
        transparentPage = true,
        background = { progress ->
            TeamAuraBackground(awayColors.primary, homeColors.primary, progress)
        },
        hero = { progress -> Hero(game, progress, awayColors, homeColors) },
    ) {
        item {
            WidgetCollapsingSection("Market Odds", icon = AppIcon.fromSystemName("chart.bar.fill"), iconTint = AppColors.appPrimary) {
                PolymarketWidget(
                    league = "nba",
                    awayTeam = game.awayTeam,
                    homeTeam = game.homeTeam,
                    awayColors = awayColors,
                    homeColors = homeColors,
                    awayAbbr = game.awayAbbr,
                    homeAbbr = game.homeAbbr,
                )
            }
        }

        spreadPrediction(game)?.let { pred ->
            item {
                WidgetCollapsingSection(
                    "Spread Prediction",
                    icon = AppIcon.fromSystemName("target"),
                    iconTint = AppColors.appPrimary,
                    accessory = WidgetHeaderAccessory.TapHint(spreadExpanded),
                    onHeaderTap = { spreadExpanded = !spreadExpanded },
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        ComparisonRow(
                            leftLabel = "Vegas",
                            leftValue = GameCardFormatting.formatSpread(game.homeSpread),
                            rightLabel = "Our Model",
                            rightValue = GameCardFormatting.formatSpread(pred.predictedSpread),
                            rightColor = AppColors.appPrimary,
                        )
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            GameCardTeamAvatar(
                                sport = "nba",
                                team = pred.predictedTeam,
                                diameter = 40.dp,
                                colors = NBATeams.colorPair(pred.predictedTeam),
                            )
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text("Edge to ${pred.predictedTeam}", color = AppColors.appTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                                Text(String.format(Locale.US, "%.1f pts delta", pred.edge), color = AppColors.appPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                        if (pred.isFadeAlert) {
                            FadeAlertPill()
                            // Fade = the OPPOSITE side of the model's pick, at its spread.
                            FadeAlertTooltip(FadeBetType.SPREAD, fadeSuggestion(game, pred))
                        }
                        if (spreadExpanded) Explanation(spreadExplanation(pred))
                    }
                }
            }
        }

        ouPrediction(game)?.let { pred ->
            val color = if (pred.isOver) AppColors.appPrimary else AppColors.appAccentRed
            item {
                WidgetCollapsingSection(
                    "Over/Under Prediction",
                    icon = AppIcon.fromSystemName(if (pred.isOver) "arrow.up.circle.fill" else "arrow.down.circle.fill"),
                    iconTint = color,
                    accessory = WidgetHeaderAccessory.TapHint(ouExpanded),
                    onHeaderTap = { ouExpanded = !ouExpanded },
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        ComparisonRow(
                            leftLabel = "Vegas O/U",
                            leftValue = fmtHalf(pred.line),
                            rightLabel = "Our Model",
                            rightValue = fmtHalf(pred.modelTotal),
                            rightColor = color,
                        )
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            val chevron = AppIcon.fromSystemName(if (pred.isOver) "chevron.up" else "chevron.down")
                                ?: AppIcon.fromSystemName(if (pred.isOver) "arrow.up" else "arrow.down")
                            chevron?.let { Icon(it.imageVector, null, tint = color, modifier = Modifier.size(32.dp)) }
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text("Edge to ${if (pred.isOver) "Over" else "Under"}", color = AppColors.appTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                                Text(String.format(Locale.US, "%.1f pts delta", pred.edge), color = color, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                        if (ouExpanded) Explanation(ouExplanation(pred))
                    }
                }
            }
        }

        // Injury Report (Pro)
        item {
            WidgetCollapsingSection(
                "Injury Report",
                icon = AppIcon.fromSystemName("bandage"),
                iconTint = AppColors.appAccentRed,
                accessory = WidgetHeaderAccessory.Chevron(injuryExpanded),
                onHeaderTap = { injuryExpanded = !injuryExpanded },
            ) {
                ProContentSection(title = "Injury Report", minHeight = 60.dp) {
                    NBAInjuryReportWidget(
                        awayTeam = game.awayTeam,
                        homeTeam = game.homeTeam,
                        awayInjuries = matchupStore.awayInjuries,
                        homeInjuries = matchupStore.homeInjuries,
                        awayInjuryImpact = matchupStore.awayInjuryImpact,
                        homeInjuryImpact = matchupStore.homeInjuryImpact,
                        isLoading = matchupStore.injuriesState is LoadState.Loading,
                        errorMessage = matchupStore.injuriesState.errorMessage,
                        expanded = injuryExpanded,
                    )
                }
            }
        }

        // Recent Trends (Pro)
        item {
            WidgetCollapsingSection(
                "Recent Trends",
                icon = AppIcon.fromSystemName("chart.line.uptrend.xyaxis"),
                iconTint = AppColors.appAccentBlue,
                accessory = WidgetHeaderAccessory.Chevron(trendsExpanded),
                onHeaderTap = { trendsExpanded = !trendsExpanded },
            ) {
                ProContentSection(title = "Recent Trends", minHeight = 60.dp) {
                    NBARecentTrendsWidget(
                        awayTeam = game.awayTeam,
                        homeTeam = game.homeTeam,
                        trends = matchupStore.trends,
                        isLoading = matchupStore.trendsState is LoadState.Loading,
                        expanded = trendsExpanded,
                    )
                }
            }
        }

        // Betting Trends (situational insight digest → full matrix sheet)
        val trends = trendsStore.trends(game.gameId)
        if (trends != null) {
            item {
                BettingTrendsInsightWidget(
                    summary = NBATrendsInsight.summary(trends),
                    awayAbbr = game.awayAbbr,
                    homeAbbr = game.homeAbbr,
                    accent = NBATrendsMatrixAdapter.accent,
                    onExpand = { trendsDetailOpen = true },
                )
            }
        } else if (trendsStore.loadState is LoadState.Loading && trendsStore.lastFetched == null) {
            item {
                WidgetCollapsingSection("Betting Trends", icon = AppIcon.fromSystemName("chart.line.uptrend.xyaxis"), iconTint = hexColor(0x8B5CF6)) {
                    InsightWidgetSkeleton()
                }
            }
        }

        // Model Accuracy
        accuracyStore.accuracy(game.gameId)?.let { acc ->
            item {
                WidgetCollapsingSection("Model Accuracy", icon = AppIcon.fromSystemName("scope"), iconTint = hexColor(0x14B8A6)) {
                    ModelAccuracyTable(acc)
                }
            }
        }

        // Team Stats
        if (game.homeAdjOffense != null || game.awayAdjOffense != null) {
            item {
                WidgetCollapsingSection("Team Stats", icon = AppIcon.fromSystemName("chart.bar"), iconTint = AppColors.appAccentBlue) {
                    TeamStats(game)
                }
            }
        }

        // Match Simulator
        if (game.homeScorePred != null && game.awayScorePred != null) {
            item {
                WidgetCollapsingSection("Match Simulator", icon = AppIcon.fromSystemName("sparkles"), iconTint = AppColors.appAccentAmber) {
                    MatchSimulator(
                        game = game,
                        simulating = simulating,
                        revealed = simulationRevealed,
                        onSimulate = {
                            simulating = true
                            scope.launch {
                                delay(2500) // Mirror RN's 2.5s reveal delay.
                                simulating = false
                                simulationRevealed = true
                            }
                        },
                    )
                }
            }
        }

        item {
            AgentPickRationaleWidget(
                gameKeys = listOf(game.gameId.toString(), game.trainingKey, game.uniqueId),
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
            )
        }
    }

    // Re-derive here: the section-scope `trends` above isn't visible at this level.
    val trends = trendsStore.trends(game.gameId)
    if (trendsDetailOpen && trends != null) {
        BettingTrendsDetailSheet(
            awayName = trends.awayTeam.teamName,
            homeName = trends.homeTeam.teamName,
            timeDisplay = NBATrendsMatrixAdapter.timeDisplay(trends),
            stripeColors = NBATrendsMatrixAdapter.stripeColors(trends),
            accent = NBATrendsMatrixAdapter.accent,
            sections = NBATrendsMatrixAdapter.sections(trends),
            guide = TrendsGuide.basketball,
            avatar = NBATrendsMatrixAdapter.avatarProvider(trends),
            onDismiss = { trendsDetailOpen = false },
        )
    }
}

// MARK: - Hero

@Composable
private fun Hero(
    game: NBAGame,
    p: Float,
    awayColors: com.wagerproof.app.features.gamecards.TeamColorPair,
    homeColors: com.wagerproof.app.features.gamecards.TeamColorPair,
) {
    val logoSize = lerpDp(56.dp, 30.dp, p)
    val detail = (1f - p * 1.9f).coerceIn(0f, 1f)
    val mlReveal = ((p - 0.35f) / 0.4f).coerceIn(0f, 1f)

    Column(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(top = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(lerpDp(12.dp, 6.dp, p)),
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(GameCardFormatting.formatCompactDate(game.gameDate), color = AppColors.appTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            Text(
                GameCardFormatting.convertTimeToEST(game.gameTime),
                color = AppColors.appTextSecondary,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.liquidGlassBackground(CircleShape).padding(horizontal = 10.dp, vertical = 4.dp),
            )
            Spacer(Modifier.weight(1f))
        }
        Row(
            Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(lerpDp(14.dp, 10.dp, p)),
        ) {
            HeroTeamColumn(game.awayTeam, awayColors, logoSize, detail, game.awayMl, mlReveal)
            HeroLines(game, detail, Modifier.weight(1f))
            HeroTeamColumn(game.homeTeam, homeColors, logoSize, detail, game.homeMl, mlReveal)
        }
    }
}

@Composable
private fun HeroTeamColumn(
    team: String,
    colors: com.wagerproof.app.features.gamecards.TeamColorPair,
    size: Dp,
    nameOpacity: Float,
    ml: Int?,
    mlReveal: Float,
) {
    val abbr = TeamInitials.from(team)
    val (city, nick) = TeamInitials.parts(team)
    Column(Modifier.width(96.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        GameCardTeamAvatar(sport = "nba", team = team, diameter = size, colors = colors)
        Text(abbr, color = AppColors.appTextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Black, maxLines = 1)
        // Cross-fade team name (expanded) → moneyline (collapsed).
        Box(Modifier.height(15.dp), contentAlignment = Alignment.Center) {
            Text(nick.ifEmpty { city }, color = AppColors.appTextSecondary, fontSize = 10.sp, maxLines = 1, modifier = Modifier.alpha(nameOpacity))
            Text(GameCardFormatting.formatMoneyline(ml), color = AppColors.appTextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, modifier = Modifier.alpha(mlReveal))
        }
    }
}

@Composable
private fun HeroLines(game: NBAGame, detail: Float, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        if (detail > 0.04f) {
            HeroLineRow("ML", "${GameCardFormatting.formatMoneyline(game.awayMl)} / ${GameCardFormatting.formatMoneyline(game.homeMl)}", detail)
        }
        HeroLineRow("Spread", "${GameCardFormatting.formatSpread(game.awaySpread)} / ${GameCardFormatting.formatSpread(game.homeSpread)}", 1f)
        HeroLineRow("O/U", fmtHalf(game.overLine), 1f)
    }
}

@Composable
private fun HeroLineRow(label: String, value: String, alpha: Float) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp), modifier = Modifier.alpha(alpha)) {
        Text(label.uppercase(Locale.US), color = AppColors.appTextSecondary, fontSize = 9.sp, fontWeight = FontWeight.SemiBold)
        Text(value, color = AppColors.appTextPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    }
}

// MARK: - Shared sub-views

@Composable
private fun ComparisonRow(leftLabel: String, leftValue: String, rightLabel: String, rightValue: String, rightColor: Color) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        ComparisonBox(leftLabel, leftValue, AppColors.appTextPrimary, false, Modifier.weight(1f))
        AppIcon.fromSystemName("arrow.right")?.let {
            Icon(it.imageVector, null, tint = AppColors.appTextMuted, modifier = Modifier.padding(horizontal = 8.dp).size(18.dp))
        }
        ComparisonBox(rightLabel, rightValue, rightColor, true, Modifier.weight(1f))
    }
}

@Composable
private fun ComparisonBox(label: String, value: String, color: Color, highlight: Boolean, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(12.dp)
    Column(
        modifier
            .clip(shape)
            .background(if (highlight) color.copy(alpha = 0.1f) else AppColors.appSurfaceMuted.copy(alpha = 0.5f))
            .then(if (highlight) Modifier.border(1.dp, color.copy(alpha = 0.25f), shape) else Modifier)
            .padding(vertical = 12.dp, horizontal = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(label.uppercase(Locale.US), color = color.copy(alpha = if (highlight) 1f else 0.7f), fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
        Text(value, color = color, fontSize = 24.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun Explanation(text: String) {
    val shape = RoundedCornerShape(10.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(AppColors.appPrimary.copy(alpha = 0.1f))
            .border(1.dp, AppColors.appPrimary.copy(alpha = 0.25f), shape)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            AppIcon.fromSystemName("info.circle")?.let { Icon(it.imageVector, null, tint = AppColors.appPrimary, modifier = Modifier.size(14.dp)) }
            Text("What This Means", color = AppColors.appPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
        }
        Text(text, color = AppColors.appTextSecondary, fontSize = 13.sp)
    }
}

@Composable
private fun FadeAlertPill() {
    Row(
        Modifier
            .clip(CircleShape)
            .background(AppColors.appAccentAmber.copy(alpha = 0.2f))
            .border(1.dp, AppColors.appAccentAmber.copy(alpha = 0.4f), CircleShape)
            .padding(horizontal = 10.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        AppIcon.fromSystemName("bolt.fill")?.let { Icon(it.imageVector, null, tint = AppColors.appAccentAmber, modifier = Modifier.size(11.dp)) }
        Text("FADE ALERT", color = AppColors.appAccentAmber, fontSize = 10.sp, fontWeight = FontWeight.Bold)
    }
}

// MARK: - Team stats / simulator / accuracy

@Composable
private fun TeamStats(game: NBAGame) {
    val shape = RoundedCornerShape(8.dp)
    Column(
        Modifier.fillMaxWidth().clip(shape).background(AppColors.appTextMuted.copy(alpha = 0.05f)).padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(Modifier.fillMaxWidth().padding(bottom = 4.dp)) {
            Spacer(Modifier.weight(1f))
            Text(game.awayAbbr, color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f), textAlign = TextAlign.Center)
            Text(game.homeAbbr, color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f), textAlign = TextAlign.Center)
        }
        StatRow("Adj. Offense", fmt1(game.awayAdjOffense), fmt1(game.homeAdjOffense))
        StatRow("Adj. Defense", fmt1(game.awayAdjDefense), fmt1(game.homeAdjDefense))
        StatRow("Adj. Pace", fmt1(game.awayAdjPace), fmt1(game.homeAdjPace))
        if (game.homeAtsPct != null || game.awayAtsPct != null) {
            StatRow("ATS %", pct(game.awayAtsPct), pct(game.homeAtsPct))
        }
        if (game.homeOverPct != null || game.awayOverPct != null) {
            StatRow("Over %", pct(game.awayOverPct), pct(game.homeOverPct))
        }
    }
}

@Composable
private fun StatRow(label: String, away: String, home: String) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(label, color = AppColors.appTextSecondary, fontSize = 13.sp, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
        Text(away, color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f), textAlign = TextAlign.Center)
        Text(home, color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f), textAlign = TextAlign.Center)
    }
}

@Composable
private fun MatchSimulator(
    game: NBAGame,
    simulating: Boolean,
    revealed: Boolean,
    onSimulate: () -> Unit,
) {
    val shape = RoundedCornerShape(12.dp)
    if (!revealed) {
        Row(
            Modifier
                .fillMaxWidth()
                .heightIn(min = 56.dp)
                .clip(shape)
                .background(if (simulating) AppColors.appSurfaceMuted else AppColors.appPrimary)
                .clickable(enabled = !simulating, onClick = onSimulate)
                .padding(horizontal = 32.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
        ) {
            if (simulating) {
                CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp, color = AppColors.appTextPrimary)
                Spacer(Modifier.width(8.dp))
                Text("Simulating...", color = AppColors.appTextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Bold)
            } else {
                Text("Simulate Match", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
            }
        }
    } else {
        Row(
            Modifier
                .fillMaxWidth()
                .clip(shape)
                .background(AppColors.appAccentAmber.copy(alpha = 0.15f))
                .border(1.dp, AppColors.appAccentAmber.copy(alpha = 0.3f), shape)
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            SimScore(game.awayTeam, game.awayScorePred, Modifier.weight(1f))
            Text("VS", color = AppColors.appTextSecondary, fontSize = 16.sp, fontWeight = FontWeight.Bold)
            SimScore(game.homeTeam, game.homeScorePred, Modifier.weight(1f))
        }
    }
}

@Composable
private fun SimScore(team: String, score: Double?, modifier: Modifier) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        GameCardTeamAvatar(sport = "nba", team = team, diameter = 64.dp, colors = NBATeams.colorPair(team))
        Text("${(score ?: 0.0).roundToInt()}", color = AppColors.appTextPrimary, fontSize = 32.sp, fontWeight = FontWeight.Bold)
    }
}

/**
 * Inline Model Accuracy table — same shared `ModelAccuracyWidget` layout the
 * NCAAB page inlines (doc §2.9): Type/Pick/Edge/Accuracy header; rows
 * Spread/ML/O-U. Edge always blue #3B82F6; accuracy ≥60 green / ≥50 yellow /
 * else red.
 */
@Composable
private fun ModelAccuracyTable(game: NBAModelAccuracyData) {
    val shape = RoundedCornerShape(8.dp)
    Column(Modifier.fillMaxWidth().clip(shape).background(Color.White.copy(alpha = 0.05f)).padding(10.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(Modifier.fillMaxWidth()) {
            HeaderCell("Type", 1.2f)
            HeaderCell("Pick", 1.4f)
            HeaderCell("Edge", 1f)
            HeaderCell("Accuracy", 1.4f)
        }
        val homeCovers = (game.homeSpreadDiff ?: 0.0) > 0
        AccuracyRow(
            "Spread",
            if (game.homeSpread != null) "${if (homeCovers) game.homeAbbr else game.awayAbbr} ${GameCardFormatting.formatSpread(if (homeCovers) game.homeSpread else -game.homeSpread!!)}" else "—",
            game.homeSpreadDiff?.let { "+${fmtHalf(abs(it))}" } ?: "—",
            game.spreadAccuracy,
        )
        AccuracyRow(
            "ML",
            game.mlPickProbRounded?.let { "${if (game.mlPickIsHome == true) game.homeAbbr else game.awayAbbr} ${(it * 100).roundToInt()}%" } ?: "—",
            "—",
            game.mlAccuracy,
        )
        val isOver = (game.overLineDiff ?: 0.0) > 0
        AccuracyRow(
            "O-U",
            if (game.overLine != null) "${if (isOver) "Over" else "Under"} ${fmtHalf(game.overLine)}" else "—",
            game.overLineDiff?.let { "+${fmtHalf(abs(it))}" } ?: "—",
            game.ouAccuracy,
        )
    }
}

@Composable
private fun androidx.compose.foundation.layout.RowScope.HeaderCell(text: String, weight: Float) {
    Text(text, color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Black, modifier = Modifier.weight(weight))
}

@Composable
private fun AccuracyRow(type: String, pick: String, edge: String, acc: NBAAccuracyBucket?) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(type, color = AppColors.appTextPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1.2f))
        Text(pick, color = AppColors.appTextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Black, modifier = Modifier.weight(1.4f))
        Text(edge, color = hexColor(0x3B82F6), fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
        val accText = acc?.let { "${it.accuracyPct.roundToInt()}% (${it.games}g)" } ?: "—"
        val accColor = when {
            acc == null -> AppColors.appTextSecondary
            acc.accuracyPct >= 60 -> hexColor(0x22C55E)
            acc.accuracyPct >= 50 -> hexColor(0xEAB308)
            else -> hexColor(0xEF4444)
        }
        Text(accText, color = accColor, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1.4f))
    }
}

// MARK: - Prediction logic (mirrors iOS spreadPrediction / ouPrediction)

private data class SpreadPred(
    val edge: Double,
    val predictedTeam: String,
    val predictedSpread: Double?,
    val isHome: Boolean,
    val isFadeAlert: Boolean,
)

private data class OUPred(val edge: Double, val isOver: Boolean, val modelTotal: Double?, val line: Double?)

private fun spreadPrediction(game: NBAGame): SpreadPred? {
    val hs = game.homeSpread
    game.modelFairHomeSpread?.let { mf ->
        if (hs != null) {
            val edge = abs(mf - hs)
            val isHome = mf < hs
            return SpreadPred(
                edge = edge,
                predictedTeam = if (isHome) game.homeTeam else game.awayTeam,
                predictedSpread = if (isHome) mf else -mf,
                isHome = isHome,
                // NBA fade alert is LIVE: fires at a 9.5-pt model/market gap.
                isFadeAlert = edge >= 9.5,
            )
        }
    }
    game.homeAwaySpreadCoverProb?.let { prob ->
        val p = if (prob >= 0.5) prob else 1 - prob
        val isHome = prob >= 0.5
        val edge = (p - 0.5) * 20
        return SpreadPred(
            edge = edge,
            predictedTeam = if (isHome) game.homeTeam else game.awayTeam,
            predictedSpread = if (isHome) game.homeSpread else game.awaySpread,
            isHome = isHome,
            isFadeAlert = p >= 0.8 || edge >= 9.5,
        )
    }
    return null
}

private fun ouPrediction(game: NBAGame): OUPred? {
    val ol = game.overLine
    game.modelFairTotal?.let { mf ->
        if (ol != null) return OUPred(abs(mf - ol), mf > ol, mf, ol)
    }
    game.ouResultProb?.let { prob ->
        val p = if (prob >= 0.5) prob else 1 - prob
        return OUPred((p - 0.5) * 20, prob >= 0.5, null, game.overLine)
    }
    return null
}

private fun fadeSuggestion(game: NBAGame, p: SpreadPred): String {
    val fadeTeam = if (p.isHome) game.awayTeam else game.homeTeam
    val fadeSpread = if (p.isHome) game.awaySpread else game.homeSpread
    return "$fadeTeam ${GameCardFormatting.formatSpread(fadeSpread)}"
}

private fun spreadExplanation(p: SpreadPred): String {
    val edge = String.format(Locale.US, "%.1f", p.edge)
    val team = p.predictedTeam
    val spread = GameCardFormatting.formatSpread(p.predictedSpread)
    return when {
        p.edge < 2 -> "Our model differs from Vegas by $edge points on $team. This small edge indicates our projection is fairly close to the market's assessment. While the value is limited, our model still sees $team as slightly better positioned than the Vegas spread suggests."
        p.edge < 4 -> "Our model projects $team to cover $spread with a $edge-point edge over Vegas. This moderate discrepancy shows our analytics identify a meaningful difference in how we evaluate this matchup compared to the current market line."
        else -> "Our model sees a significant $edge-point edge favoring $team to cover $spread. This large discrepancy indicates our projections differ substantially from the Vegas line, suggesting strong value on this side of the spread."
    }
}

private fun ouExplanation(p: OUPred): String {
    val edge = String.format(Locale.US, "%.1f", p.edge)
    val direction = if (p.isOver) "over" else "under"
    val line = fmtHalf(p.line)
    val modelTotal = fmtHalf(p.modelTotal)
    return when {
        p.edge < 2 -> "Our model projects a total that's $edge points different from Vegas, favoring the $direction. This small edge indicates our scoring projection is fairly aligned with the market, though we still see slight value on the $direction side."
        p.edge < 4 -> "Our model projects a $modelTotal total with a $edge-point edge favoring the $direction. This moderate discrepancy shows our scoring projection doesn't align with the market, suggesting meaningful value on the $direction."
        else -> "Our model sees a significant $edge-point edge favoring the $direction. This large difference between our $modelTotal projection and the Vegas $line line indicates the actual total is more likely to land on the $direction side than what the current market implies."
    }
}

// MARK: - small helpers

private fun fmtHalf(value: Double?): String {
    val r = GameCardFormatting.roundToNearestHalf(value) ?: return "—"
    return if (r % 1.0 == 0.0) r.toInt().toString() else r.toString()
}

private fun fmt1(v: Double?): String = v?.let { String.format(Locale.US, "%.1f", it) } ?: "-"
private fun pct(v: Double?): String = v?.let { "${(it * 100).roundToInt()}%" } ?: "-"

private fun lerpDp(a: Dp, b: Dp, t: Float): Dp = a + (b - a) * t.coerceIn(0f, 1f)

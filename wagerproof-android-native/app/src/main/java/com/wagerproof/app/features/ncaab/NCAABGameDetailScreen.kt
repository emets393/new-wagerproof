package com.wagerproof.app.features.ncaab

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
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
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
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.components.CollapsingWidgetScroll
import com.wagerproof.app.features.components.TeamAuraBackground
import com.wagerproof.app.features.components.WidgetCollapsingSection
import com.wagerproof.app.features.analytics.GamePublicBettingCard
import com.wagerproof.app.features.agents.components.AgentPickRationaleWidget
import com.wagerproof.app.features.gamecards.CFBTeamColors
import com.wagerproof.app.features.gamecards.GameCardFormatting
import com.wagerproof.app.features.gamecards.GameCardTeamAvatar
import com.wagerproof.app.features.gamecards.TeamInitials
import com.wagerproof.app.features.components.WidgetHeaderAccessory
import com.wagerproof.app.features.components.FadeAlertTooltip
import com.wagerproof.app.features.components.FadeBetType
import com.wagerproof.app.features.games.GameConsensusKey
import com.wagerproof.app.features.gamewidgets.AgentConsensusSection
import com.wagerproof.app.features.gamewidgets.GameWidgetHeadlines
import com.wagerproof.app.features.gamewidgets.InsightWidgetSkeleton
import com.wagerproof.app.features.outliers.BettingTrendsDetailSheet
import com.wagerproof.app.features.outliers.BettingTrendsInsightWidget
import com.wagerproof.app.features.outliers.NCAABTrendsMatrixAdapter
import com.wagerproof.app.features.outliers.TrendsGuide
import com.wagerproof.app.features.shared.hexColor
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.components.EdgeScale
import com.wagerproof.core.design.components.ModelEdgeRail
import com.wagerproof.core.design.components.MoneylineEdgeBar
import com.wagerproof.core.design.components.MoneylineOutcome
import com.wagerproof.core.design.components.PickSignalPillModel
import com.wagerproof.core.design.components.PickSignalsSection
import com.wagerproof.core.design.components.SpreadCoverBar
import com.wagerproof.core.design.components.liquidGlassBackground
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.BasketballSignalMarket
import com.wagerproof.core.models.NCAABAccuracyBucket
import com.wagerproof.core.models.NCAABGame
import com.wagerproof.core.models.NCAABModelAccuracyGame
import com.wagerproof.core.models.NCAABTrendsInsight
import com.wagerproof.core.stores.GamesStore
import com.wagerproof.core.stores.LoadState
import com.wagerproof.core.stores.NCAABBettingTrendsStore
import com.wagerproof.core.stores.NCAABModelAccuracyStore
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * NCAAB game-detail page. Consensus, then the projected final, then market odds,
 * spread, moneyline, total, first half, signals, trends, and team stats.
 * Team trends sit inside each market card.
 *
 * Trends + accuracy stores are screen-local (mirrors NBA/iOS), hydrated in
 * LaunchedEffect keyed on the game. Team identity uses the authoritative
 * mapping-enriched logo/abbreviation fields and the shared college color map.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NCAABGameDetailPage(
    game: NCAABGame,
    topInset: Dp,
    bottomInset: Dp,
    modifier: Modifier = Modifier,
) {
    val achievementStore = com.wagerproof.app.di.appGraph().achievements
    androidx.compose.runtime.LaunchedEffect(Unit) { achievementStore.record("game_analysis") }

    val trendsStore = remember { NCAABBettingTrendsStore() }
    val accuracyStore = remember { NCAABModelAccuracyStore() }
    val detailStore = remember(game.gameId) { NCAABGameDetailStore() }
    // Transient sheet state, reset when a new game opens (keyed on id).
    var spreadExpanded by remember(game.id) { mutableStateOf(false) }
    var ouExpanded by remember(game.id) { mutableStateOf(false) }
    var trendsDetailOpen by remember(game.id) { mutableStateOf(false) }
    var trendLog by remember(game.id) { mutableStateOf<NcaabTrendOpen?>(null) }

    val awayColors = CFBTeamColors.colorPair(game.awayTeam)
    val homeColors = CFBTeamColors.colorPair(game.homeTeam)

    LaunchedEffect(game.id) {
        trendsStore.refreshIfNeeded()
        accuracyStore.refresh()
        detailStore.load(game.gameId, game.gameDate, game.homeTeam, game.awayTeam)
    }

    val awayAbbr = game.awayTeamAbbrev?.trim().takeUnless { it.isNullOrEmpty() } ?: TeamInitials.from(game.awayTeam)
    val homeAbbr = game.homeTeamAbbrev?.trim().takeUnless { it.isNullOrEmpty() } ?: TeamInitials.from(game.homeTeam)

    // Hoisted out of the LazyColumn builder — the trends detail sheet below needs it too.
    val trends = trendsStore.trends(game.gameId)

    CollapsingWidgetScroll(
        heroMaxHeight = 196.dp,
        heroMinHeight = 124.dp,
        modifier = modifier.fillMaxSize(),
        heroTopInset = topInset,
        bottomInset = bottomInset,
        transparentPage = true,
        background = { Box(Modifier.fillMaxSize().background(AppColors.appSurface)) },
        hero = { progress -> Hero(game, progress, awayColors, homeColors, detailStore.tournament, detailStore.tv) },
    ) {
        item {
            AgentConsensusSection(
                sport = GamesStore.Sport.ncaab,
                gameId = GameConsensusKey.of(game),
                gameDate = game.gameDate,
            )
        }

        item {
            WidgetCollapsingSection(
                "Public Betting",
                icon = AppIcon.fromSystemName("chart.bar.fill"),
                iconTint = AppColors.appPrimary,
                headline = "Tickets and money",
            ) {
                GamePublicBettingCard(
                    sport = "ncaab",
                    awayTeam = game.awayTeam,
                    homeTeam = game.homeTeam,
                    awayColor = awayColors.primary,
                    homeColor = homeColors.primary,
                    gameDate = game.gameDate,
                )
            }
        }

        if (game.homeScorePred != null && game.awayScorePred != null) {
            item {
                ProjectedScoreSection(game, awayAbbr, homeAbbr, awayColors, homeColors)
            }
        }

        spreadPrediction(game, detailStore.board?.fullGame?.firstOrNull { it.id == "spread" })?.let { pred ->
            item {
                WidgetCollapsingSection(
                    "Spread Prediction",
                    icon = AppIcon.fromSystemName("target"),
                    iconTint = AppColors.appPrimary,
                    accessory = WidgetHeaderAccessory.TapHint(spreadExpanded),
                    onHeaderTap = { spreadExpanded = !spreadExpanded },
                    headline = GameWidgetHeadlines.spread(
                        team = if (pred.isHome) homeAbbr else awayAbbr,
                        modelSpread = pred.modelFairSpread,
                        marketSpread = pred.vegasSpread,
                        edge = pred.edge,
                        probability = pred.probability,
                    ),
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        // modelFairSpread (not predictedSpread) gates the chart: on the
                        // classifier fallback predictedSpread just echoes the market
                        // number, which would draw the model marker on the break-even
                        // marker — degrade to the old boxes instead.
                        if (pred.vegasSpread != null && pred.modelFairSpread != null) {
                            SpreadCoverBar(
                                line = pred.vegasSpread,
                                modelMargin = -pred.modelFairSpread,
                                scale = EdgeScale.ncaab,
                                pickAbbrev = if (pred.isHome) homeAbbr else awayAbbr,
                                opponentAbbrev = if (pred.isHome) awayAbbr else homeAbbr,
                            )
                        } else {
                            ComparisonRow(
                                leftLabel = "Vegas",
                                leftValue = GameCardFormatting.formatSpread(game.homeSpread),
                                rightLabel = "Our Model",
                                rightValue = GameCardFormatting.formatSpread(pred.predictedSpread),
                                rightColor = AppColors.appPrimary,
                            )
                        }
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            GameCardTeamAvatar(
                                sport = "ncaab",
                                team = pred.predictedTeam,
                                diameter = 40.dp,
                                colors = if (pred.isHome) homeColors else awayColors,
                                logoURL = if (pred.isHome) game.homeTeamLogo else game.awayTeamLogo,
                            )
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                val label = (if (pred.isHome) game.homeTeamAbbrev else game.awayTeamAbbrev)
                                    ?.trim()?.takeUnless { it.isEmpty() } ?: pred.predictedTeam
                                Text("Edge to $label", color = AppColors.appTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                                Text(String.format("%.1f pts delta", pred.edge), color = AppColors.appPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                        // isFadeAlert is hardcoded false for NCAAB (parity w/ RN) — dormant.
                        if (pred.isFadeAlert) {
                            FadeAlertPill()
                            FadeAlertTooltip(FadeBetType.SPREAD, fadeSuggestionSpread(game, pred))
                        }
                        if (spreadExpanded) Explanation(spreadExplanation(pred))
                        NcaabMarketSignals(detailStore.board?.signals.orEmpty(), "spread", modelLikesHome = pred.isHome, game = game, homeAbbr = homeAbbr, awayAbbr = awayAbbr)
                        TeamTrendsFooter(detailStore.board, "spread", game, awayAbbr, homeAbbr, awayColors, homeColors) { trendLog = it }
                    }
                }
            }
        }

        moneylinePrediction(game)?.let { ml ->
            item {
                WidgetCollapsingSection(
                    "Moneyline Prediction",
                    icon = AppIcon.fromSystemName("dollarsign.circle.fill"),
                    iconTint = AppColors.appPrimary,
                    headline = GameWidgetHeadlines.moneyline(
                        segment = "fg",
                        pickAbbr = ml.abbrev,
                        pickProbability = ml.probability,
                        impliedProbability = ml.implied,
                        pickEdgePct = ml.edge,
                    ),
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        MoneylineEdgeBar(
                            price = ml.price,
                            modelProbability = ml.probability,
                            scale = EdgeScale.ncaab,
                            teamAbbrev = ml.abbrev,
                        )
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            GameCardTeamAvatar(
                                sport = "ncaab",
                                team = ml.team,
                                diameter = 40.dp,
                                colors = if (ml.team == game.homeTeam) homeColors else awayColors,
                                logoURL = if (ml.team == game.homeTeam) game.homeTeamLogo else game.awayTeamLogo,
                            )
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text("Edge to ${ml.abbrev}", color = AppColors.appTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                                Text(
                                    String.format("%+.1f pts of win rate", ml.edge),
                                    color = if (ml.edge > 0) AppColors.appPrimary else AppColors.appAccentRed,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                )
                            }
                        }
                        NcaabMarketSignals(detailStore.board?.signals.orEmpty(), "moneyline", modelLikesHome = ml.team == game.homeTeam, game = game, homeAbbr = homeAbbr, awayAbbr = awayAbbr)
                        TeamTrendsFooter(detailStore.board, "moneyline", game, awayAbbr, homeAbbr, awayColors, homeColors) { trendLog = it }
                    }
                }
            }
        }

        ouPrediction(game, detailStore.board?.fullGame?.firstOrNull { it.id == "total" })?.let { pred ->
            val color = if (pred.isOver) AppColors.appPrimary else AppColors.appAccentRed
            item {
                WidgetCollapsingSection(
                    "Over/Under Prediction",
                    icon = AppIcon.fromSystemName(if (pred.isOver) "arrow.up.circle.fill" else "arrow.down.circle.fill"),
                    iconTint = color,
                    accessory = WidgetHeaderAccessory.TapHint(ouExpanded),
                    onHeaderTap = { ouExpanded = !ouExpanded },
                    headline = GameWidgetHeadlines.total(
                        direction = if (pred.isOver) "Over" else "Under",
                        modelTotal = pred.modelTotal,
                        marketTotal = pred.line,
                    ),
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        if (pred.line != null && pred.modelTotal != null) {
                            ModelEdgeRail(market = pred.line, model = pred.modelTotal, scale = EdgeScale.ncaab)
                        } else {
                            ComparisonRow(
                                leftLabel = "Vegas O/U",
                                leftValue = fmtHalf(pred.line),
                                rightLabel = "Our Model",
                                rightValue = fmtHalf(pred.modelTotal),
                                rightColor = color,
                            )
                        }
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            val chevron = AppIcon.fromSystemName(if (pred.isOver) "chevron.up" else "chevron.down")
                            chevron?.let { androidx.compose.material3.Icon(it.imageVector, null, tint = color, modifier = Modifier.size(32.dp)) }
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text("Edge to ${if (pred.isOver) "Over" else "Under"}", color = AppColors.appTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                                Text(String.format("%.1f pts delta", pred.edge), color = color, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                        if (pred.isFadeAlert) {
                            FadeAlertPill()
                            FadeAlertTooltip(FadeBetType.TOTAL, fadeSuggestionOU(pred))
                        }
                        if (ouExpanded) Explanation(ouExplanation(pred))
                        NcaabMarketSignals(detailStore.board?.signals.orEmpty(), "total", modelLikesOver = pred.isOver, game = game, homeAbbr = homeAbbr, awayAbbr = awayAbbr)
                        TeamTrendsFooter(detailStore.board, "total", game, awayAbbr, homeAbbr, awayColors, homeColors) { trendLog = it }
                    }
                }
            }
        }

        detailStore.board?.let { board ->
            if (board.firstHalf.any { it.modelMargin != null || it.modelTotal != null }) {
                item { NcaabFirstHalf(board, game, awayAbbr, homeAbbr, awayColors, homeColors) { trendLog = it } }
            }
            if (board.markets.any { it.id == "team_total" }) {
                item { NcaabTeamTotal(board, game, awayAbbr, homeAbbr, awayColors, homeColors) { trendLog = it } }
            }
        }

        // Betting Trends
        if (trends != null) {
            item {
                BettingTrendsInsightWidget(
                    summary = NCAABTrendsInsight.summary(trends),
                    awayAbbr = awayAbbr,
                    homeAbbr = homeAbbr,
                    accent = NCAABTrendsMatrixAdapter.accent,
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
                WidgetCollapsingSection(
                    "Model Accuracy",
                    icon = AppIcon.fromSystemName("scope"),
                    iconTint = hexColor(0x14B8A6),
                    headline = GameWidgetHeadlines.modelAccuracy(),
                ) {
                    ModelAccuracyTable(acc)
                }
            }
        }

        // Team Stats — season ratings when the board has them, else the feed's adjusted numbers.
        val ratings = detailStore.board?.ratings.orEmpty()
        if (ratings.isNotEmpty() || game.homeAdjOffense != null || game.awayAdjOffense != null) {
            item {
                WidgetCollapsingSection(
                    "Team Stats",
                    icon = AppIcon.fromSystemName("chart.bar"),
                    iconTint = AppColors.appAccentBlue,
                    headline = GameWidgetHeadlines.teamStats(
                        awayAbbr = awayAbbr,
                        homeAbbr = homeAbbr,
                        awayOffense = game.awayAdjOffense,
                        homeOffense = game.homeAdjOffense,
                    ),
                ) {
                    if (ratings.isEmpty()) {
                        TeamStats(game, awayAbbr, homeAbbr)
                    } else {
                        RatingTable(ratings, awayAbbr, homeAbbr, detailStore.board?.earlySeason == true)
                    }
                }
            }
        }

        detailStore.board?.let { board ->
            item {
                WidgetCollapsingSection(
                    "Thrill score",
                    icon = AppIcon.fromSystemName("sparkles"),
                    iconTint = AppColors.appAccentAmber,
                ) {
                    if (!board.thrillScore.isNullOrBlank()) {
                        Text(board.thrillScore, color = AppColors.appTextPrimary, fontSize = 28.sp, fontWeight = FontWeight.Bold)
                        if (board.thrillDetail.isNotBlank()) {
                            Text(board.thrillDetail, color = AppColors.appTextSecondary, fontSize = 13.sp, modifier = Modifier.padding(top = 4.dp))
                        }
                    } else {
                        Text(
                            board.thrillDetail.ifBlank { "The watchability score posts the morning of the game." },
                            color = AppColors.appTextSecondary,
                            fontSize = 13.sp,
                        )
                    }
                }
            }
        }

        // Model Projections fallback
        if (game.homeScorePred == null && game.predHomeMargin != null && game.predTotalPoints != null) {
            item {
                WidgetCollapsingSection(
                    "Model Projections",
                    icon = AppIcon.fromSystemName("rectangle.grid.2x2.fill"),
                    iconTint = AppColors.appAccentPurple,
                    headline = modelProjectionsHeadline(game),
                ) {
                    ModelProjections(game)
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

    if (trendsDetailOpen && trends != null) {
        BettingTrendsDetailSheet(
            awayName = trends.awayTeam.teamName,
            homeName = trends.homeTeam.teamName,
            timeDisplay = NCAABTrendsMatrixAdapter.timeDisplay(trends),
            stripeColors = NCAABTrendsMatrixAdapter.stripeColors(trends),
            accent = NCAABTrendsMatrixAdapter.accent,
            sections = NCAABTrendsMatrixAdapter.sections(trends),
            guide = TrendsGuide.basketball,
            avatar = NCAABTrendsMatrixAdapter.avatarProvider(trends),
            onDismiss = { trendsDetailOpen = false },
        )
    }

    trendLog?.let { selection ->
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(onDismissRequest = { trendLog = null }, sheetState = sheetState) {
            NcaabTrendLogSheet(selection)
        }
    }
}

// MARK: - Hero

@Composable
private fun Hero(
    game: NCAABGame,
    p: Float,
    awayColors: com.wagerproof.app.features.gamecards.TeamColorPair,
    homeColors: com.wagerproof.app.features.gamecards.TeamColorPair,
    tournament: String? = null,
    tv: String? = null,
) {
    val logoSize = lerpDp(56.dp, 30.dp, p)
    val detail = (1f - p * 1.9f).coerceIn(0f, 1f)
    val mlReveal = ((p - 0.35f) / 0.4f).coerceIn(0f, 1f)

    Column(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(top = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(lerpDp(12.dp, 6.dp, p)),
    ) {
        // topRow
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(GameCardFormatting.formatCompactDate(game.gameDate), color = AppColors.appTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            Text(
                GameCardFormatting.convertTimeToEST(game.gameTime),
                color = AppColors.appTextSecondary,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.liquidGlassBackground(CircleShape).padding(horizontal = 10.dp, vertical = 4.dp),
            )
            if (game.conferenceGame == true) ContextChip("Conf")
            if (game.neutralSite == true) ContextChip("Neutral")
            if (!tournament.isNullOrBlank()) ContextChip(tournament)
            if (!tv.isNullOrBlank()) ContextChip(tv)
            Spacer(Modifier.width(1.dp))
        }
        Row(
            Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(lerpDp(14.dp, 10.dp, p)),
        ) {
            HeroTeamColumn(game.awayTeam, game.awayTeamAbbrev, game.awayTeamLogo, game.awayRanking, awayColors, logoSize, detail, game.awayMl, mlReveal)
            HeroLines(game, detail, Modifier.weight(1f))
            HeroTeamColumn(game.homeTeam, game.homeTeamAbbrev, game.homeTeamLogo, game.homeRanking, homeColors, logoSize, detail, game.homeMl, mlReveal)
        }
    }
}

@Composable
private fun HeroTeamColumn(
    team: String,
    abbr: String?,
    logoURL: String?,
    ranking: Int?,
    colors: com.wagerproof.app.features.gamecards.TeamColorPair,
    size: Dp,
    nameOpacity: Float,
    ml: Int?,
    mlReveal: Float,
) {
    val label = abbr?.trim()?.takeUnless { it.isEmpty() } ?: TeamInitials.from(team)
    val (city, nick) = TeamInitials.parts(team)
    Column(Modifier.width(96.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Box(contentAlignment = Alignment.TopEnd) {
            GameCardTeamAvatar(sport = "ncaab", team = team, diameter = size, colors = colors, logoURL = logoURL)
            if (ranking != null && ranking <= 25) {
                Text(
                    "#$ranking",
                    color = Color.White,
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier
                        .clip(RoundedCornerShape(7.dp))
                        .background(AppColors.appPrimary)
                        .padding(horizontal = 5.dp, vertical = 2.dp),
                )
            }
        }
        Text(label, color = AppColors.appTextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Black, maxLines = 1)
        Box(Modifier.height(15.dp), contentAlignment = Alignment.Center) {
            Text(nick.ifEmpty { city }, color = AppColors.appTextSecondary, fontSize = 10.sp, maxLines = 1, modifier = Modifier.alpha(nameOpacity))
            Text(GameCardFormatting.formatMoneyline(ml), color = AppColors.appTextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, modifier = Modifier.alpha(mlReveal))
        }
    }
}

@Composable
private fun HeroLines(game: NCAABGame, detail: Float, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        if (detail > 0.04f) {
            HeroLineRow("ML", "${GameCardFormatting.formatMoneyline(game.awayMl)} / ${GameCardFormatting.formatMoneyline(game.homeMl)}", detail)
        }
        HeroLineRow("Spread", "${GameCardFormatting.formatSpread(game.awaySpread)} / ${GameCardFormatting.formatSpread(game.homeSpread)}", 1f)
        if (game.overLine != null) HeroLineRow("O/U", fmtHalf(game.overLine), 1f)
    }
}

@Composable
private fun HeroLineRow(label: String, value: String, alpha: Float) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp), modifier = Modifier.alpha(alpha)) {
        Text(label.uppercase(), color = AppColors.appTextSecondary, fontSize = 9.sp, fontWeight = FontWeight.SemiBold)
        Text(value, color = AppColors.appTextPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun ContextChip(label: String) {
    Text(
        label,
        color = AppColors.appPrimary,
        fontSize = 9.sp,
        fontWeight = FontWeight.SemiBold,
        maxLines = 1,
        overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
        modifier = Modifier
            .clip(CircleShape)
            .background(AppColors.appPrimary.copy(alpha = 0.15f))
            .border(1.dp, AppColors.appPrimary.copy(alpha = 0.3f), CircleShape)
            .padding(horizontal = 8.dp, vertical = 4.dp),
    )
}

// MARK: - Shared sub-views

@Composable
private fun ComparisonRow(leftLabel: String, leftValue: String, rightLabel: String, rightValue: String, rightColor: Color) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        ComparisonBox(leftLabel, leftValue, AppColors.appTextPrimary, false, Modifier.weight(1f))
        AppIcon.fromSystemName("arrow.right")?.let {
            androidx.compose.material3.Icon(it.imageVector, null, tint = AppColors.appTextMuted, modifier = Modifier.padding(horizontal = 8.dp).size(18.dp))
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
        Text(label.uppercase(), color = color.copy(alpha = if (highlight) 1f else 0.7f), fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
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
            AppIcon.fromSystemName("info.circle")?.let { androidx.compose.material3.Icon(it.imageVector, null, tint = AppColors.appPrimary, modifier = Modifier.size(14.dp)) }
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
        AppIcon.fromSystemName("bolt.fill")?.let { androidx.compose.material3.Icon(it.imageVector, null, tint = AppColors.appAccentAmber, modifier = Modifier.size(11.dp)) }
        Text("FADE ALERT", color = AppColors.appAccentAmber, fontSize = 10.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun TeamTrendsFooter(
    board: NCAABDetailBoard?,
    marketId: String,
    game: NCAABGame,
    awayAbbr: String,
    homeAbbr: String,
    awayColors: com.wagerproof.app.features.gamecards.TeamColorPair,
    homeColors: com.wagerproof.app.features.gamecards.TeamColorPair,
    onOpen: (NcaabTrendOpen) -> Unit,
) {
    val market = board?.markets?.firstOrNull { it.id == marketId } ?: return
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("TEAM TRENDS", color = AppColors.appTextSecondary, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            NcaabTrendCard(
                game.awayTeam, awayAbbr, game.awayTeamLogo, awayColors,
                market.awayRecord, market.awayChips, board.awayTrend?.gameLog.orEmpty(),
                market, Modifier.weight(1f), onOpen,
            )
            NcaabTrendCard(
                game.homeTeam, homeAbbr, game.homeTeamLogo, homeColors,
                market.homeRecord, market.homeChips, board.homeTrend?.gameLog.orEmpty(),
                market, Modifier.weight(1f), onOpen,
            )
        }
        Text(market.series, color = AppColors.appTextSecondary, fontSize = 12.sp)
    }
}

@Composable
private fun NcaabTrendCard(
    team: String,
    abbr: String,
    logoURL: String?,
    colors: com.wagerproof.app.features.gamecards.TeamColorPair,
    record: String,
    chips: List<String>,
    games: List<NcaabGameLog>,
    market: NcaabMarketLine,
    modifier: Modifier = Modifier,
    onOpen: (NcaabTrendOpen) -> Unit,
) {
    Column(
        modifier
            .clip(RoundedCornerShape(12.dp))
            .background(AppColors.appSurface.copy(alpha = 0.42f))
            .border(0.7.dp, AppColors.appBorder.copy(alpha = 0.45f), RoundedCornerShape(12.dp))
            .clickable {
                onOpen(NcaabTrendOpen(team, abbr, logoURL, colors, market.id, market.label, games))
            }
            .padding(8.dp),
        verticalArrangement = Arrangement.spacedBy(7.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            GameCardTeamAvatar(sport = "ncaab", team = team, diameter = 20.dp, colors = colors, logoURL = logoURL)
            Text(abbr, color = AppColors.appTextPrimary, fontSize = 11.sp, fontWeight = FontWeight.Black, maxLines = 1, modifier = Modifier.weight(1f))
            Text("›", color = AppColors.appTextMuted, fontSize = 14.sp, fontWeight = FontWeight.Bold)
        }
        Text(record, color = AppColors.appTextPrimary, fontSize = 11.sp, fontWeight = FontWeight.Bold, maxLines = 1)
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
            if (chips.isEmpty()) {
                Text("No L5", color = AppColors.appTextMuted, fontSize = 8.sp, fontWeight = FontWeight.Bold)
            } else {
                Text("L${minOf(chips.size, 5)}", color = AppColors.appTextMuted, fontSize = 8.sp, fontWeight = FontWeight.Black)
                chips.take(5).forEach { letter ->
                    Text(
                        letter.uppercase(),
                        color = AppColors.appSurface,
                        fontSize = 8.sp,
                        fontWeight = FontWeight.Black,
                        modifier = Modifier
                            .size(17.dp)
                            .clip(CircleShape)
                            .background(ncaabChipFill(letter)),
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    )
                }
            }
        }
    }
}

private fun ncaabChipFill(letter: String): Color = when (letter.uppercase()) {
    "W", "O" -> Color(0xFF22C55E)
    "L", "U" -> Color(0xFFEF4444)
    else -> AppColors.appTextMuted
}

@Composable
private fun NcaabTrendLogSheet(selection: NcaabTrendOpen) {
    val rows = selection.games.filter { !it.result(selection.marketId).isNullOrBlank() }
    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            GameCardTeamAvatar(sport = "ncaab", team = selection.team, diameter = 34.dp, colors = selection.colors, logoURL = selection.logoURL)
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text("${selection.abbr} ${selection.label}", color = AppColors.appTextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Black)
                Text("Season game log, newest first", color = AppColors.appTextMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
        }
        if (rows.isEmpty()) {
            Text(
                "No games have been played this season yet.",
                color = AppColors.appTextMuted,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.fillMaxWidth(),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
        } else {
            Row(Modifier.fillMaxWidth()) {
                Text("DATE", color = AppColors.appTextMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.width(56.dp))
                Text("OPP", color = AppColors.appTextMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                Text("SCORE", color = AppColors.appTextMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.width(56.dp), textAlign = androidx.compose.ui.text.style.TextAlign.End)
                Text("RESULT", color = AppColors.appTextMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.width(52.dp), textAlign = androidx.compose.ui.text.style.TextAlign.End)
            }
            rows.forEach { entry ->
                val result = entry.result(selection.marketId).orEmpty()
                val score = if (entry.scoreFor != null && entry.scoreAgainst != null) "${entry.scoreFor}–${entry.scoreAgainst}" else "—"
                val opp = entry.opp?.takeIf { it.isNotBlank() } ?: "—"
                Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(ncaabTrendDate(entry.date), color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.width(56.dp))
                    Text(if (entry.isHome == false) "@ $opp" else opp, color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, modifier = Modifier.weight(1f))
                    Text(score, color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.width(56.dp), textAlign = androidx.compose.ui.text.style.TextAlign.End)
                    Text(result.uppercase(), color = ncaabChipFill(result), fontSize = 13.sp, fontWeight = FontWeight.Black, modifier = Modifier.width(52.dp), textAlign = androidx.compose.ui.text.style.TextAlign.End)
                }
            }
        }
    }
}

private fun ncaabTrendDate(raw: String?): String {
    val day = raw?.take(10) ?: return "—"
    val parts = day.split("-")
    return if (parts.size == 3) "${parts[1]}/${parts[2]}" else day
}

private data class NcaabTrendOpen(
    val team: String,
    val abbr: String,
    val logoURL: String?,
    val colors: com.wagerproof.app.features.gamecards.TeamColorPair,
    val marketId: String,
    val label: String,
    val games: List<NcaabGameLog>,
)

@Composable
private fun NcaabFirstHalf(
    board: NCAABDetailBoard,
    game: NCAABGame,
    awayAbbr: String,
    homeAbbr: String,
    awayColors: com.wagerproof.app.features.gamecards.TeamColorPair,
    homeColors: com.wagerproof.app.features.gamecards.TeamColorPair,
    onOpen: (NcaabTrendOpen) -> Unit,
) {
    val spread = board.firstHalf.firstOrNull { it.id == "h1_spread" }
    val total = board.firstHalf.firstOrNull { it.id == "h1_total" }
    WidgetCollapsingSection("First half", icon = AppIcon.fromSystemName("timer"), iconTint = AppColors.appPrimary) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            val margin = spread?.modelMargin
            val hs = spread?.marketSpread
            if (margin != null && hs != null) {
                val gap = spread?.disagreementPts ?: (margin + hs)
                val isHome = gap > 0
                val fairHome = -margin
                val line = if (isHome) hs else -hs
                val modelSpread = if (isHome) fairHome else -fairHome
                Text("1H Spread", color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                SpreadCoverBar(
                    line = line,
                    modelMargin = -modelSpread,
                    scale = EdgeScale.ncaab,
                    pickAbbrev = if (isHome) homeAbbr else awayAbbr,
                    opponentAbbrev = if (isHome) awayAbbr else homeAbbr,
                    modifier = Modifier.fillMaxWidth(),
                )
                NcaabMarketSignals(board.signals, "h1_spread", modelLikesHome = isHome, game = game, homeAbbr = homeAbbr, awayAbbr = awayAbbr)
                TeamTrendsFooter(board, "h1_spread", game, awayAbbr, homeAbbr, awayColors, homeColors, onOpen)
            }
            val model = total?.modelTotal
            val market = total?.marketTotal
            if (model != null && market != null) {
                Text("1H Total", color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                ModelEdgeRail(market = market, model = model, scale = EdgeScale.ncaab, modifier = Modifier.fillMaxWidth())
                Text("Tracking only. The first-half total is never a bet.", color = AppColors.appTextSecondary, fontSize = 12.sp)
                NcaabMarketSignals(board.signals, "h1_total", modelLikesOver = model > market, game = game, homeAbbr = homeAbbr, awayAbbr = awayAbbr)
                TeamTrendsFooter(board, "h1_total", game, awayAbbr, homeAbbr, awayColors, homeColors, onOpen)
            }
        }
    }
}

@Composable
private fun NcaabTeamTotal(
    board: NCAABDetailBoard,
    game: NCAABGame,
    awayAbbr: String,
    homeAbbr: String,
    awayColors: com.wagerproof.app.features.gamecards.TeamColorPair,
    homeColors: com.wagerproof.app.features.gamecards.TeamColorPair,
    onOpen: (NcaabTrendOpen) -> Unit,
) {
    WidgetCollapsingSection("Team Total", icon = AppIcon.fromSystemName("trophy.fill"), iconTint = AppColors.appPrimary) {
        NcaabMarketSignals(board.signals, "team_total", game = game, homeAbbr = homeAbbr, awayAbbr = awayAbbr)
        TeamTrendsFooter(board, "team_total", game, awayAbbr, homeAbbr, awayColors, homeColors, onOpen)
    }
}

@Composable
private fun NcaabMarketSignals(
    signals: List<NcaabSignalLine>,
    market: String,
    modelLikesHome: Boolean? = null,
    modelLikesOver: Boolean? = null,
    game: NCAABGame,
    homeAbbr: String,
    awayAbbr: String,
) {
    val ordered = remember(signals, market, modelLikesHome, modelLikesOver, game.homeTeam, game.awayTeam, homeAbbr, awayAbbr) {
        val rows = signals.filter { BasketballSignalMarket.canonical(it.market) == market }
        BasketballSignalMarket.supportingFirst(rows) { signal ->
            BasketballSignalMarket.contradicts(
                side = signal.side,
                market = market,
                modelLikesHome = modelLikesHome,
                modelLikesOver = modelLikesOver,
                homeName = game.homeTeam,
                awayName = game.awayTeam,
                homeAbbr = homeAbbr,
                awayAbbr = awayAbbr,
            )
        }
    }
    if (ordered.isEmpty()) return
    var selected by remember { mutableStateOf<NcaabSignalLine?>(null) }
    PickSignalsSection(
        signals = ordered.map { signal ->
            PickSignalPillModel(
                id = signal.id,
                title = signal.name,
                contradicts = BasketballSignalMarket.contradicts(
                    side = signal.side,
                    market = market,
                    modelLikesHome = modelLikesHome,
                    modelLikesOver = modelLikesOver,
                    homeName = game.homeTeam,
                    awayName = game.awayTeam,
                    homeAbbr = homeAbbr,
                    awayAbbr = awayAbbr,
                ),
            )
        },
        onSelect = { pill -> selected = ordered.firstOrNull { it.id == pill.id } },
    )
    selected?.let { signal ->
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { selected = null },
            confirmButton = {
                Text(
                    "Close",
                    color = AppColors.appPrimary,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.clickable { selected = null }.padding(8.dp),
                )
            },
            title = { Text(signal.name) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    if (signal.side.isNotBlank()) Text(signal.side, fontWeight = FontWeight.SemiBold)
                    if (signal.trigger.isNotBlank()) Text(signal.trigger, color = AppColors.appTextSecondary, fontSize = 14.sp)
                    if (!signal.play) Text("Tracking read. Not a play.", color = AppColors.appTextSecondary, fontSize = 13.sp)
                    Text("BACK-TEST", color = AppColors.appTextSecondary, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    Text(signal.record.ifBlank { "—" }, fontSize = 13.sp)
                    Text("THIS SEASON", color = AppColors.appTextSecondary, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    Text(signal.seasonRecord.ifBlank { "—" }, fontSize = 13.sp)
                }
            },
        )
    }
}

@Composable
private fun RatingTable(rows: List<NcaabRatingLine>, awayAbbr: String, homeAbbr: String, earlySeason: Boolean) {
    val shape = RoundedCornerShape(8.dp)
    val better = Color(0xFF059669)
    Column(
        Modifier.fillMaxWidth().clip(shape).background(AppColors.appTextMuted.copy(alpha = 0.05f)).padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(Modifier.fillMaxWidth().padding(bottom = 4.dp)) {
            Spacer(Modifier.weight(1f))
            Text(awayAbbr, color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
            Text(homeAbbr, color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        }
        rows.forEach { row ->
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(row.label, color = AppColors.appTextSecondary, fontSize = 13.sp, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
                Text(row.away, color = if (row.better == "away") better else AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                Text(row.home, color = if (row.better == "home") better else AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
            }
        }
        if (earlySeason) {
            Text(
                "Season records start after opening night. Last five and head-to-head still use prior seasons. In-season rating fields stay blank until games are played.",
                color = AppColors.appTextSecondary,
                fontSize = 12.sp,
            )
        }
    }
}

@Composable
private fun TeamStats(game: NCAABGame, awayAbbr: String, homeAbbr: String) {
    val shape = RoundedCornerShape(8.dp)
    Column(
        Modifier.fillMaxWidth().clip(shape).background(AppColors.appTextMuted.copy(alpha = 0.05f)).padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(Modifier.fillMaxWidth().padding(bottom = 4.dp)) {
            Spacer(Modifier.weight(1f))
            Text(awayAbbr, color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
            Text(homeAbbr, color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        }
        StatRow("Adj. Offense", game.awayAdjOffense, game.homeAdjOffense)
        StatRow("Adj. Defense", game.awayAdjDefense, game.homeAdjDefense)
        StatRow("Adj. Pace", game.awayAdjPace, game.homeAdjPace)
    }
}

@Composable
private fun StatRow(label: String, away: Double?, home: Double?) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(label, color = AppColors.appTextSecondary, fontSize = 13.sp, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
        Text(away?.let { String.format("%.1f", it) } ?: "-", color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        Text(home?.let { String.format("%.1f", it) } ?: "-", color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
    }
}

@Composable
private fun ProjectedScoreSection(
    game: NCAABGame,
    awayAbbr: String,
    homeAbbr: String,
    awayColors: com.wagerproof.app.features.gamecards.TeamColorPair,
    homeColors: com.wagerproof.app.features.gamecards.TeamColorPair,
) {
    val awayScore = game.awayScorePred ?: return
    val homeScore = game.homeScorePred ?: return
    WidgetCollapsingSection(
        title = "Score Prediction",
        icon = AppIcon.fromSystemName("sportscourt"),
        iconTint = AppColors.appPrimary,
    ) {
        Row(
            Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            ProjectedTeam(game.awayTeam, game.awayTeamLogo, awayAbbr, awayScore, awayColors, Modifier.weight(1f))
            Text("–", color = AppColors.appTextMuted, fontSize = 20.sp, fontWeight = FontWeight.Black)
            ProjectedTeam(game.homeTeam, game.homeTeamLogo, homeAbbr, homeScore, homeColors, Modifier.weight(1f))
        }
    }
}

@Composable
private fun ProjectedTeam(
    team: String,
    logoURL: String?,
    abbreviation: String,
    score: Double,
    colors: com.wagerproof.app.features.gamecards.TeamColorPair,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier,
        horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        GameCardTeamAvatar(sport = "ncaab", team = team, diameter = 38.dp, colors = colors, logoURL = logoURL)
        Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(
                abbreviation,
                color = AppColors.appTextSecondary,
                fontSize = 10.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 0.6.sp,
            )
            Text(
                String.format(java.util.Locale.US, "%.1f", score),
                color = AppColors.appTextPrimary,
                fontSize = 28.sp,
                fontWeight = FontWeight.Black,
            )
        }
    }
}

@Composable
private fun ModelProjections(game: NCAABGame) {
    val shape = RoundedCornerShape(8.dp)
    val margin = game.predHomeMargin ?: 0.0
    val total = game.predTotalPoints ?: 0.0
    Column(
        Modifier.fillMaxWidth().clip(shape).background(AppColors.appTextMuted.copy(alpha = 0.05f)).padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("Predicted Margin", color = AppColors.appTextSecondary, fontSize = 13.sp, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
            Text("${if (margin > 0) game.homeTeam else game.awayTeam} by ${String.format("%.1f", abs(margin))}", color = AppColors.appAccentPurple, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        }
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("Predicted Total", color = AppColors.appTextSecondary, fontSize = 13.sp, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
            Text("${String.format("%.1f", total)} points", color = AppColors.appAccentPurple, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

/**
 * Inline Model Accuracy table — port of the shared iOS `ModelAccuracyWidget`
 * (no Kotlin equivalent exists; see doc §2.7). Header Type/Pick/Edge/Accuracy;
 * rows Spread/ML/O-U. Edge always blue #3B82F6; accuracy ≥60 green / ≥50 yellow
 * / else red.
 */
@Composable
private fun ModelAccuracyTable(game: NCAABModelAccuracyGame) {
    val shape = RoundedCornerShape(8.dp)
    Column(Modifier.fillMaxWidth().clip(shape).background(Color.White.copy(alpha = 0.05f)).padding(10.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(Modifier.fillMaxWidth()) {
            // Pick loses a little width and Edge gains it: the ML row's pick is
            // now a bare abbr while every edge cell carries a " pts"/"%" unit.
            HeaderCell("Type", 1.0f)
            HeaderCell("Pick", 1.3f)
            HeaderCell("Edge", 1.3f)
            HeaderCell("Accuracy", 1.4f)
        }
        val homeCovers = (game.homeSpreadDiff ?: 0.0) > 0
        AccuracyRow(
            "Spread",
            if (game.homeSpread != null) "${if (homeCovers) game.homeAbbr else game.awayAbbr} ${GameCardFormatting.formatSpread(if (homeCovers) game.homeSpread else -game.homeSpread!!)}" else "—",
            // Spread/OU edges are POINTS; without the unit the column reads as a
            // price or a percentage next to the ML row's percent.
            game.homeSpreadDiff?.let { "+${fmtHalf(abs(it))} pts" } ?: "—",
            game.spreadAccuracy,
        )
        AccuracyRow(
            "ML",
            // Pick cell is the bare abbr and the win probability IS the edge, so
            // the column stops rendering a permanent "—" that reads as missing
            // data (iOS `mlPick` / `mlEdge`).
            game.mlPickIsHome?.let { if (it) game.homeAbbr else game.awayAbbr } ?: "—",
            game.mlPickProbRounded?.let { "${(it * 100).roundToInt()}%" } ?: "—",
            game.mlAccuracy,
        )
        val isOver = (game.overLineDiff ?: 0.0) > 0
        AccuracyRow(
            "O-U",
            if (game.overLine != null) "${if (isOver) "Over" else "Under"} ${fmtHalf(game.overLine)}" else "—",
            game.overLineDiff?.let { "+${fmtHalf(abs(it))} pts" } ?: "—",
            game.ouAccuracy,
        )
    }
}

@Composable
private fun androidx.compose.foundation.layout.RowScope.HeaderCell(text: String, weight: Float) {
    Text(text, color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Black, modifier = Modifier.weight(weight))
}

@Composable
private fun AccuracyRow(type: String, pick: String, edge: String, acc: NCAABAccuracyBucket?) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(type, color = AppColors.appTextPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1.0f))
        Text(pick, color = AppColors.appTextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Black, maxLines = 1, modifier = Modifier.weight(1.3f))
        // Blue regardless of direction — the color encodes "this is the edge",
        // not a good/bad result (RN convention, mirrored on iOS).
        Text(edge, color = hexColor(0x3B82F6), fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 1, modifier = Modifier.weight(1.3f))
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
    /** The pick side's market number, for the headline's model-vs-market read. */
    val vegasSpread: Double? = null,
    /**
     * Model fair spread — populated only when the model actually publishes one
     * (fair spread or predicted margin). The classifier fallback sets
     * `predictedSpread` to the market number itself, so quoting "makes DUKE -6
     * versus -6" would contradict itself; that path leaves this null and the
     * headline falls through to [probability].
     */
    val modelFairSpread: Double? = null,
    /** Cover probability, ≥ 0.5, on the classifier fallback only. */
    val probability: Double? = null,
)
private data class OUPred(val edge: Double, val isOver: Boolean, val modelTotal: Double?, val line: Double?, val isFadeAlert: Boolean)

private fun spreadPrediction(game: NCAABGame, originator: NcaabModelLine? = null): SpreadPred? {
    val originMargin = originator?.modelMargin
    val originSpread = originator?.marketSpread ?: game.homeSpread
    if (originMargin != null && originSpread != null) {
        val fairHome = -originMargin
        val gap = originator?.disagreementPts ?: (originMargin + originSpread)
        val isHome = gap > 0
        return SpreadPred(
            abs(fairHome - originSpread),
            if (isHome) game.homeTeam else game.awayTeam,
            if (isHome) fairHome else -fairHome,
            isHome,
            false,
            vegasSpread = if (isHome) originSpread else (game.awaySpread ?: -originSpread),
            modelFairSpread = if (isHome) fairHome else -fairHome,
        )
    }
    val hs = game.homeSpread
    game.modelFairHomeSpread?.let { mf ->
        if (hs != null) {
            val isHome = mf < hs
            return SpreadPred(
                abs(mf - hs), if (isHome) game.homeTeam else game.awayTeam, if (isHome) mf else -mf, isHome, false,
                vegasSpread = if (isHome) game.homeSpread else game.awaySpread,
                modelFairSpread = if (isHome) mf else -mf,
            )
        }
    }
    game.predHomeMargin?.let { margin ->
        if (hs != null) {
            val modelSpread = -margin
            val isHome = modelSpread < hs
            return SpreadPred(
                abs(modelSpread - hs), if (isHome) game.homeTeam else game.awayTeam,
                if (isHome) modelSpread else -modelSpread, isHome, false,
                vegasSpread = if (isHome) game.homeSpread else game.awaySpread,
                modelFairSpread = if (isHome) modelSpread else -modelSpread,
            )
        }
    }
    game.homeAwaySpreadCoverProb?.let { prob ->
        val p = if (prob >= 0.5) prob else 1 - prob
        val isHome = prob >= 0.5
        return SpreadPred(
            (p - 0.5) * 20, if (isHome) game.homeTeam else game.awayTeam,
            if (isHome) game.homeSpread else game.awaySpread, isHome, false,
            vegasSpread = if (isHome) game.homeSpread else game.awaySpread,
            probability = p,
        )
    }
    return null
}

/**
 * Fallback projection read — mirrors iOS's inline sentence on the RN "Model
 * Projections" card, which only renders when there are no per-team predicted
 * scores but the model still publishes margin + total.
 */
private fun modelProjectionsHeadline(game: NCAABGame): String? {
    val margin = game.predHomeMargin ?: return null
    val total = game.predTotalPoints ?: return null
    val leader = if (margin > 0) game.homeTeam else game.awayTeam
    return "Model projects $leader by ${GameWidgetHeadlines.one(abs(margin))} with " +
        "${GameWidgetHeadlines.one(total)} total points."
}

private data class MlPred(val price: Int, val probability: Double, val abbrev: String, val team: String, val edge: Double, val implied: Double)

private fun moneylinePrediction(game: NCAABGame): MlPred? {
    val homeProb = game.homeAwayMlProb ?: return null
    if (!homeProb.isFinite() || homeProb <= 0.0 || homeProb >= 1.0) return null
    val isHome = homeProb >= 0.5
    val probability = if (isHome) homeProb else 1 - homeProb
    val price = (if (isHome) game.homeMl else game.awayMl) ?: return null
    if (kotlin.math.abs(price) < 100) return null
    val outcome = MoneylineOutcome(price, probability, EdgeScale.ncaab)
    return MlPred(
        price = price,
        probability = probability,
        abbrev = (if (isHome) game.homeTeamAbbrev else game.awayTeamAbbrev)?.trim().orEmpty().ifBlank {
            if (isHome) game.homeTeam else game.awayTeam
        },
        team = if (isHome) game.homeTeam else game.awayTeam,
        edge = outcome.edge,
        implied = outcome.breakEvenPercent / 100.0,
    )
}

private fun ouPrediction(game: NCAABGame, originator: NcaabModelLine? = null): OUPred? {
    val pred = originator?.modelTotal
    // Posted total on the list can move after the model run. Judge the lean
    // against that live number, not the snapshot the model stored.
    val posted = game.overLine ?: originator?.marketTotal
    if (pred != null && posted != null) return OUPred(abs(pred - posted), pred > posted, pred, posted, false)
    val ol = game.overLine
    game.predTotalPoints?.let { predTotal ->
        if (ol != null) return OUPred(abs(predTotal - ol), predTotal > ol, predTotal, ol, false)
    }
    game.ouResultProb?.let { prob ->
        val p = if (prob >= 0.5) prob else 1 - prob
        return OUPred((p - 0.5) * 20, prob >= 0.5, null, game.overLine, false)
    }
    return null
}

private fun fadeSuggestionSpread(game: NCAABGame, p: SpreadPred): String {
    val oppTeam = if (p.isHome) game.awayTeam else game.homeTeam
    val oppSpread = if (p.isHome) game.awaySpread else game.homeSpread
    return "$oppTeam ${GameCardFormatting.formatSpread(oppSpread)}"
}

private fun fadeSuggestionOU(p: OUPred): String {
    val opp = if (p.isOver) "Under" else "Over"
    return "$opp ${fmtHalf(p.line)}"
}

private fun spreadExplanation(p: SpreadPred): String {
    val edge = String.format("%.1f", p.edge)
    val team = p.predictedTeam
    val spread = GameCardFormatting.formatSpread(p.predictedSpread)
    return when {
        p.edge < 2 -> "Our model differs from Vegas by $edge points on $team. This small edge indicates our projection is fairly close to the market's assessment. While the value is limited, our model still sees $team as slightly better positioned than the Vegas spread suggests."
        p.edge < 4 -> "Our model projects $team to cover $spread with a $edge-point edge over Vegas. This moderate discrepancy shows our analytics identify a meaningful difference in how we evaluate this matchup compared to the current market line."
        else -> "Our model sees a significant $edge-point edge favoring $team to cover $spread. This large discrepancy indicates our projections differ substantially from the Vegas line, suggesting strong value on this side of the spread."
    }
}

private fun ouExplanation(p: OUPred): String {
    val edge = String.format("%.1f", p.edge)
    val direction = if (p.isOver) "OVER" else "UNDER"
    val line = fmtHalf(p.line)
    val modelTotal = fmtHalf(p.modelTotal)
    return when {
        p.edge < 2 -> "Our model projects a total that's $edge points different from Vegas, favoring the ${direction.lowercase()}. This small edge indicates our scoring projection is fairly aligned with the market, though we still see slight value on the ${direction.lowercase()} side."
        p.edge < 4 -> "Our model projects a $modelTotal total with a $edge-point edge favoring the ${direction.lowercase()}. This moderate discrepancy shows our scoring projection doesn't align with the market, suggesting meaningful value on the ${direction.lowercase()}."
        else -> "Our model sees a significant $edge-point edge favoring the ${direction.lowercase()}. This large difference between our $modelTotal projection and the Vegas $line line indicates the actual total is more likely to land on the ${direction.lowercase()} side than what the current market implies."
    }
}

// MARK: - small helpers

private fun fmtHalf(value: Double?): String {
    val r = GameCardFormatting.roundToNearestHalf(value) ?: return "—"
    return if (r % 1.0 == 0.0) r.toInt().toString() else r.toString()
}

private fun lerpDp(a: Dp, b: Dp, t: Float): Dp = a + (b - a) * t.coerceIn(0f, 1f)

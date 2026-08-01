package com.wagerproof.app.features.onboarding.pages

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.spring
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.onboarding.OnboardingChip
import com.wagerproof.app.features.onboarding.OnboardingFeatureRow
import com.wagerproof.app.features.onboarding.OnboardingMarkerRow
import com.wagerproof.app.features.onboarding.OnboardingOptionCard
import com.wagerproof.app.features.onboarding.OnboardingPageScaffold
import com.wagerproof.app.features.onboarding.LocalOnboardingPageIsActive
import com.wagerproof.app.features.onboarding.LocalOnboardingReduceMotion
import com.wagerproof.app.features.onboarding.OnboardingTheme
import com.wagerproof.app.features.onboarding.ResearchTimeEstimates
import com.wagerproof.app.features.onboarding.components.onboardingIcon
import com.wagerproof.app.features.onboarding.onboardingPressable
import com.wagerproof.app.features.onboarding.pageEntrance
import com.wagerproof.app.features.onboarding.stampEntrance
import com.wagerproof.app.features.outliers.OutliersTrendCard
import com.wagerproof.app.features.outliers.OutliersTrendCardMode
import com.wagerproof.core.design.components.liquidGlassBackground
import com.wagerproof.core.design.pixeloffice.PixelOffice
import com.wagerproof.core.design.pixeloffice.PixelSpriteAvatar
import com.wagerproof.core.models.OutliersTrendsBettingLine
import com.wagerproof.core.models.OutliersTrendsCard
import com.wagerproof.core.models.OutliersTrendsCardRow
import com.wagerproof.core.models.OutliersTrendsSubjectKind
import com.wagerproof.core.stores.OnboardingStore
import kotlinx.coroutines.delay
import kotlin.math.exp

@Composable
fun OnboardingBettorTypePage(modifier: Modifier = Modifier) {
    val store = appGraph().onboarding
    val options = listOf(
        BettorOption(OnboardingStore.BettorType.Casual, "Casual", "I bet for fun and want quick, trustworthy reads", "face.smiling"),
        BettorOption(OnboardingStore.BettorType.Serious, "Serious", "I research lines and trends before I play", "chart.line.uptrend.xyaxis"),
        BettorOption(OnboardingStore.BettorType.Professional, "Professional", "I track units, ROI, and closing-line value", "target"),
    )
    OnboardingPageScaffold(
        title = "What kind of bettor are you?",
        subtitle = "We tune your experience around this.",
        modifier = modifier,
    ) {
        Column(Modifier.padding(horizontal = 24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            options.forEachIndexed { index, option ->
                OnboardingOptionCard(
                    title = option.title,
                    detail = option.detail,
                    icon = option.icon,
                    isSelected = store.survey.bettorType == option.id,
                    accent = OnboardingTheme.accent(option.id),
                    modifier = Modifier.pageEntrance(2 + index),
                ) { store.setBettorType(option.id) }
            }
        }
    }
}

private data class BettorOption(
    val id: OnboardingStore.BettorType,
    val title: String,
    val detail: String,
    val icon: String,
)

private data class Pitfall(val label: String, val icon: String, val color: Color)

private val pitfalls = listOf(
    Pitfall("Chasing Losses", "arrow.triangle.2.circlepath", Color(0xFF5EB0FF)),
    Pitfall("Tilt Betting", "flame.fill", Color(0xFF5DDB8A)),
    Pitfall("Too Many Parlays", "link", Color(0xFF4DD0E1)),
    Pitfall("No Bankroll Plan", "banknote.fill", Color(0xFF7986CB)),
    Pitfall("FOMO Bets", "bolt.fill", Color(0xFFFFB24D)),
    Pitfall("Team Bias", "heart.fill", Color(0xFFC792EA)),
    Pitfall("Ignoring Odds", "chart.line.downtrend.xyaxis", Color(0xFFFFD54F)),
    Pitfall("Overbetting", "arrow.up.right.circle.fill", Color(0xFFF48FB1)),
    Pitfall("Skipping Research", "magnifyingglass", Color(0xFF9FA8FF)),
    Pitfall("Emotional Bets", "heart.slash.fill", Color(0xFF80CBC4)),
    Pitfall("Chalk Only", "checkmark.seal.fill", Color(0xFFFF7043)),
    Pitfall("Missed Injuries", "cross.case.fill", Color(0xFFAED581)),
)

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun OnboardingBettingPitfallsPage(modifier: Modifier = Modifier) {
    val store = appGraph().onboarding
    val reduceMotion = LocalOnboardingReduceMotion.current
    val haptics = LocalHapticFeedback.current
    Column(modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            "Select Every Pitfall You've Hit 🎯",
            color = Color.White,
            fontSize = 28.sp,
            lineHeight = 34.sp,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = 28.dp, vertical = 8.dp).pageEntrance(0),
        )
        Text(
            "Tap everything that sounds familiar — it helps us tailor your agents.",
            color = Color.White.copy(alpha = 0.7f),
            fontSize = 16.sp,
            lineHeight = 22.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = 28.dp, vertical = 8.dp).pageEntrance(1),
        )
        FlowRow(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            maxItemsInEachRow = 2,
        ) {
            pitfalls.forEachIndexed { index, option ->
                FallingPitfall(
                    option = option,
                    index = index,
                    selected = option.label in store.survey.bettingPitfalls,
                    reduceMotion = reduceMotion,
                    modifier = Modifier.weight(1f),
                ) {
                    haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                    store.toggleBettingPitfall(option.label)
                }
            }
        }
    }
}

@Composable
private fun FallingPitfall(
    option: Pitfall,
    index: Int,
    selected: Boolean,
    reduceMotion: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    val fall = remember { Animatable(if (reduceMotion) 0f else -700f - index * 55f) }
    val rotation = remember { (index % 5 - 2) * 2.2f }
    LaunchedEffect(Unit) {
        if (!reduceMotion) {
            delay(index * 65L)
            fall.animateTo(0f, spring(dampingRatio = 0.64f, stiffness = 145f))
        }
    }
    Row(
        modifier = modifier
            .graphicsLayer { translationY = fall.value; rotationZ = rotation }
            .heightIn(min = 52.dp)
            .liquidGlassBackground(
                RoundedCornerShape(50),
                if (selected) option.color.copy(alpha = 0.88f) else option.color.copy(alpha = 0.24f),
            )
            .border(if (selected) 1.5.dp else 0.dp, if (selected) Color.White.copy(alpha = 0.9f) else Color.Transparent, RoundedCornerShape(50))
            .onboardingPressable(onClickLabel = option.label, onClick = onClick)
            .padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(7.dp, Alignment.CenterHorizontally),
    ) {
        Icon(onboardingIcon(option.icon), null, tint = if (selected) Color.White else option.color, modifier = Modifier.size(16.dp))
        Text(option.label, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
    }
}

// The `personalizedValue` page (casual time-bar chart / sharp "2× value, +30%
// hit rate, +40 units" benefit list) was DELETED to match iOS, which retired it
// because that performance copy is unsupported on a gambling-adjacent surface.
// iOS replaced it with the self-reported research-time value arc; that arc is a
// separate port (AND-003) and there is no placeholder in the meantime.

@Composable
fun OnboardingPrimaryGoalPage(modifier: Modifier = Modifier) {
    val store = appGraph().onboarding
    val accent = OnboardingTheme.accent(store.survey.bettorType)
    val goals = listOf(
        "Find profitable edges faster" to "bolt.fill",
        "Analyze data to improve strategy" to "chart.line.uptrend.xyaxis",
        "Track my performance over time" to "chart.bar.fill",
        "Get timely alerts for model picks" to "bell.badge.fill",
    )
    OnboardingPageScaffold(title = "What's your main goal?", modifier = modifier) {
        Column(Modifier.padding(horizontal = 24.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            goals.forEachIndexed { index, (goal, icon) ->
                OnboardingOptionCard(
                    title = goal,
                    icon = icon,
                    isSelected = store.survey.mainGoal == goal,
                    accent = accent,
                    modifier = Modifier.heightIn(min = 84.dp).pageEntrance(2 + index),
                ) { store.setMainGoal(goal) }
            }
        }
    }
}

@Composable
fun OnboardingAgentHQPage(modifier: Modifier = Modifier) {
    OnboardingPageScaffold(
        title = "We created research agents to save you time!",
        subtitle = "Meet Agent HQ — a team of AI analysts that works the data around the clock so you don't have to.",
        modifier = modifier,
    ) {
        Box(Modifier.fillMaxWidth().padding(horizontal = 24.dp).pageEntrance(2)) {
            PixelOffice(agents = null, isActive = true, modifier = Modifier.fillMaxWidth())
            Row(
                Modifier.padding(10.dp).liquidGlassBackground(CircleShape, Color.White.copy(alpha = 0.08f)).padding(horizontal = 11.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(5.dp),
            ) {
                Box(Modifier.size(6.dp).background(Color(0xFF22C55E), CircleShape))
                Text("Agent HQ — Live", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
fun OnboardingAgentPitchIntroPage(modifier: Modifier = Modifier) {
    val store = appGraph().onboarding
    val accent = OnboardingTheme.accent(store.survey.bettorType)
    val pagerState = rememberPagerState(initialPage = store.agentPitchSlide) {
        OnboardingStore.agentPitchSlideCount
    }

    // The shared Continue CTA advances the store's slide; a finger swipe advances
    // the pager. Keep both directions in lockstep so neither input can drift.
    LaunchedEffect(store.agentPitchSlide) {
        if (pagerState.currentPage != store.agentPitchSlide) {
            pagerState.animateScrollToPage(store.agentPitchSlide)
        }
    }
    LaunchedEffect(pagerState.currentPage) {
        if (store.agentPitchSlide != pagerState.currentPage) {
            store.setAgentPitchSlide(pagerState.currentPage)
        }
    }

    OnboardingPageScaffold(title = "Not another chatbot", modifier = modifier) {
        HorizontalPager(
            state = pagerState,
            modifier = Modifier.fillMaxWidth().height(452.dp).pageEntrance(2),
        ) { page ->
            CompositionLocalProvider(LocalOnboardingPageIsActive provides (pagerState.currentPage == page)) {
                when (page) {
                    0 -> ValueMarkerSlide(accent)
                    1 -> WinRateSlide(accent)
                    else -> OutliersSlide(accent)
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(0.dp), modifier = Modifier.pageEntrance(3)) {
            repeat(OnboardingStore.agentPitchSlideCount) { index ->
                val isSelected = store.agentPitchSlide == index
                Box(
                    Modifier
                        .size(48.dp)
                        .semantics {
                            contentDescription = "Reason ${index + 1} of ${OnboardingStore.agentPitchSlideCount}"
                            selected = isSelected
                        }
                        .onboardingPressable(
                            onClickLabel = "Show reason ${index + 1}",
                            onClick = { store.setAgentPitchSlide(index) },
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    Box(
                        Modifier
                            .size(if (isSelected) 9.dp else 7.dp)
                            .background(if (isSelected) accent else Color.White.copy(alpha = 0.25f), CircleShape),
                    )
                }
            }
        }
    }
}

@Composable
private fun ValueMarkerSlide(accent: Color) {
    val store = appGraph().onboarding
    val estimates = ResearchTimeEstimates(store.survey.researchTimeBucket)
    Column(
        Modifier.fillMaxSize().padding(horizontal = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        SlideHeading("With WagerProof you can:")
        Column(Modifier.padding(top = 22.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
            OnboardingMarkerRow(
                icon = "clock.badge.checkmark",
                lines = listOf("Get back **${estimates.reclaimYears}+ ${ResearchTimeEstimates.yearsWord(estimates.reclaimYears)}**", "of your life"),
                color = Color(0xFFFF9800),
                modifier = Modifier.stampEntrance(0),
            )
            OnboardingMarkerRow(
                icon = "calendar.badge.clock",
                lines = listOf("Hand off **~${estimates.reclaimHoursPerWeek} hrs a week**", "of scores and line checks"),
                color = Color(0xFF22C55E),
                iconTrailing = true,
                modifier = Modifier.stampEntrance(1),
            )
            OnboardingMarkerRow(
                icon = "cpu",
                lines = listOf("Every slate screened", "**24/7**, five leagues"),
                color = Color(0xFFEF4444),
                modifier = Modifier.stampEntrance(2),
            )
            OnboardingMarkerRow(
                icon = "chart.line.uptrend.xyaxis",
                lines = listOf("Model vs Vegas", "on **every** line"),
                color = Color(0xFF3B82F6),
                iconTrailing = true,
                modifier = Modifier.stampEntrance(3),
            )
        }
        Spacer(Modifier.weight(1f))
        Text("Time estimates from your answers. Results vary.", color = Color.White.copy(alpha = 0.4f), fontSize = 11.sp)
    }
}

@Composable
private fun WinRateSlide(accent: Color) {
    Column(Modifier.fillMaxSize().padding(horizontal = 24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SlideHeading("Picks that actually hit")
        WinRateChartCard(accent)
        Text(
            "Most bettors' picks land around a 40% win rate. Our top agents peak far higher. See them on the leaderboard and tail their picks.",
            color = Color.White.copy(alpha = 0.7f),
            fontSize = 14.sp,
            textAlign = TextAlign.Center,
            lineHeight = 20.sp,
            modifier = Modifier.padding(horizontal = 8.dp),
        )
    }
}

@Composable
private fun WinRateChartCard(accent: Color) {
    BoxWithConstraints(
        Modifier
            .fillMaxWidth()
            .height(250.dp)
            .liquidGlassBackground(RoundedCornerShape(20.dp), Color.White.copy(alpha = 0.05f)),
    ) {
        Canvas(Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 18.dp)) {
        fun curve(mean: Float, sigma: Float, color: Color, width: Float) {
            val line = Path()
            val area = Path()
            val baseline = size.height * 0.86f
            area.moveTo(0f, baseline)
            for (i in 0..100) {
                val xValue = 15f + i / 100f * 75f
                val z = (xValue - mean) / sigma
                val yValue = exp((-0.5f * z * z).toDouble()).toFloat()
                val x = i / 100f * size.width
                val y = baseline - yValue * size.height * 0.56f
                if (i == 0) line.moveTo(x, y) else line.lineTo(x, y)
                area.lineTo(x, y)
            }
            area.lineTo(size.width, baseline)
            area.close()
            drawPath(area, color.copy(alpha = 0.17f))
            drawPath(line, color, style = Stroke(width = width, cap = StrokeCap.Round))
        }
        val dash = PathEffect.dashPathEffect(floatArrayOf(8f, 8f))
        listOf(40f to Color.White.copy(alpha = 0.25f), 65f to accent.copy(alpha = 0.5f)).forEach { (value, color) ->
            val x = (value - 15f) / 75f * size.width
            drawLine(color, start = androidx.compose.ui.geometry.Offset(x, 34f), end = androidx.compose.ui.geometry.Offset(x, size.height * 0.88f), strokeWidth = 2f, pathEffect = dash)
        }
        curve(40f, 9f, Color.White.copy(alpha = 0.45f), 5f)
        curve(65f, 6.5f, accent, 7f)
        }
        Text(
            "Most bettors\n~40%",
            color = Color.White.copy(alpha = 0.65f),
            fontSize = 11.sp,
            lineHeight = 13.sp,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
            modifier = Modifier.offset(x = maxWidth * 0.19f, y = 8.dp),
        )
        Text(
            "Our agents\n~65%",
            color = accent,
            fontSize = 11.sp,
            lineHeight = 13.sp,
            fontWeight = FontWeight.Black,
            textAlign = TextAlign.Center,
            modifier = Modifier.offset(x = maxWidth * 0.55f, y = 8.dp),
        )
        Text("40%", color = Color.White.copy(alpha = 0.5f), fontSize = 11.sp, modifier = Modifier.align(Alignment.BottomStart).offset(x = maxWidth * 0.32f, y = (-5).dp))
        Text("65%", color = Color.White.copy(alpha = 0.5f), fontSize = 11.sp, modifier = Modifier.align(Alignment.BottomStart).offset(x = maxWidth * 0.64f, y = (-5).dp))
        Text(
            "ILLUSTRATIVE",
            color = Color.White.copy(alpha = 0.45f),
            fontSize = 8.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 0.6.sp,
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(8.dp)
                .background(Color.White.copy(alpha = 0.1f), CircleShape)
                .padding(horizontal = 6.dp, vertical = 3.dp),
        )
    }
}

@Composable
private fun OutliersSlide(accent: Color) {
    Column(Modifier.fillMaxSize().padding(horizontal = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        SlideHeading("Edges served daily")
        Spacer(Modifier.weight(1f))
        Box(
            Modifier
                .fillMaxWidth()
                .liquidGlassBackground(RoundedCornerShape(22.dp), accent.copy(alpha = 0.14f))
                .border(1.dp, accent.copy(alpha = 0.35f), RoundedCornerShape(22.dp))
                .padding(10.dp),
        ) {
            OutliersTrendCard(
                card = exampleTrendCard,
                displayMode = OutliersTrendCardMode.Expanded,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        Spacer(Modifier.weight(1f))
    }
}

private val exampleTrendCard = OutliersTrendsCard(
    id = "onboarding-trend-example",
    gameId = "onboarding-trend-example",
    matchupLabel = "BUF @ KC",
    subjectKind = OutliersTrendsSubjectKind.TEAM,
    subjectName = "Kansas City Chiefs",
    subjectDetail = "Team trends",
    teamAbbr = "KC",
    playerId = null,
    marketKey = "spread",
    betTypeLabel = "Spread",
    trendValue = 0.8,
    trendSampleN = 5,
    lineContext = null,
    bettingLines = listOf(
        OutliersTrendsBettingLine("onb-line-1", "Spread", "KC -2.5", "-108", teamAbbr = "KC"),
    ),
    rows = listOf(
        OutliersTrendsCardRow("onb-r1", "Won 5 of last 5 vs this opponent", null, 1.0, 5),
        OutliersTrendsCardRow("onb-r2", "Covered 6 of last 6 as favorite", null, 1.0, 6),
        OutliersTrendsCardRow("onb-r3", "Won 4 of last 4 road games", null, 1.0, 4),
        OutliersTrendsCardRow("onb-r4", "Covered 5 of last 5 in division", null, 1.0, 5),
        OutliersTrendsCardRow("onb-r5", "Covered 7 of last 8 primetime games", null, 0.88, 8),
        OutliersTrendsCardRow("onb-r6", "Over hit in 6 of last 7 at home", null, 0.86, 7),
    ),
)

@Composable
private fun SlideHeading(text: String) {
    Text(text, color = Color.White, fontSize = 17.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
}

@Composable
fun OnboardingAgentPitchProofPage(modifier: Modifier = Modifier) {
    val store = appGraph().onboarding
    val accent = OnboardingTheme.accent(store.survey.bettorType)
    OnboardingPageScaffold(
        title = "An analyst who never sleeps",
        subtitle = "It runs the research grind. You just read the answer.",
        modifier = modifier,
    ) {
        PixelSpriteAvatar(0, Modifier.size(116.dp).padding(top = 2.dp).pageEntrance(2))
        Column(Modifier.padding(horizontal = 24.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            OnboardingFeatureRow("clock.arrow.2.circlepath", "Works while you sleep", "Re-checks every game, every line move, and every injury update. You never start from a blank page.", Modifier.pageEntrance(3), accent)
            OnboardingFeatureRow("cpu", "Thousands of data points per slate", "Model probabilities, market prices, public money, and matchup stats turned into actual picks.", Modifier.pageEntrance(4), accent)
            OnboardingFeatureRow("text.magnifyingglass", "Shows its work", "Every pick comes with the reasoning behind it. Tail it or fade it in seconds.", Modifier.pageEntrance(5), accent)
        }
    }
}

// The `attPriming` page was DELETED. It mocked up iOS's App Tracking
// Transparency system alert ("Allow WagerProof to track your activity…", Allow /
// Ask App Not to Track, "Tap Allow when the pop-up appears") but Android has no
// ATT: nothing was ever requested, so every user was told to answer a prompt
// that could never appear. Play's advertising-ID access is a manifest
// permission with no runtime dialog, so there is nothing to prime for.

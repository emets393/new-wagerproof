package com.wagerproof.app.features.onboarding.pages

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.onboarding.OnboardingChip
import com.wagerproof.app.features.onboarding.OnboardingFeatureRow
import com.wagerproof.app.features.onboarding.OnboardingOptionCard
import com.wagerproof.app.features.onboarding.OnboardingPageScaffold
import com.wagerproof.app.features.onboarding.LocalOnboardingReduceMotion
import com.wagerproof.app.features.onboarding.OnboardingTheme
import com.wagerproof.app.features.onboarding.components.onboardingIcon
import com.wagerproof.app.features.onboarding.onboardingPressable
import com.wagerproof.app.features.onboarding.pageEntrance
import com.wagerproof.core.design.components.liquidGlassBackground
import com.wagerproof.core.design.pixeloffice.PixelOffice
import com.wagerproof.core.design.pixeloffice.PixelSpriteAvatar
import com.wagerproof.core.design.tokens.AppColors
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
            .onboardingPressable(onClick)
            .padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(7.dp, Alignment.CenterHorizontally),
    ) {
        Icon(onboardingIcon(option.icon), null, tint = if (selected) Color.White else option.color, modifier = Modifier.size(16.dp))
        Text(option.label, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
    }
}

@Composable
fun OnboardingPersonalizedValuePage(modifier: Modifier = Modifier) {
    val store = appGraph().onboarding
    if (store.survey.bettorType == OnboardingStore.BettorType.Casual || store.survey.bettorType == null) {
        CasualValuePage(OnboardingTheme.accent(store.survey.bettorType), modifier)
    } else {
        SharpValuePage(modifier)
    }
}

@Composable
private fun CasualValuePage(accent: Color, modifier: Modifier) {
    val typical = remember { Animatable(0f) }
    val wp = remember { Animatable(0f) }
    LaunchedEffect(Unit) {
        typical.animateTo(1f, tween(900, 250, FastOutSlowInEasing))
        wp.animateTo(1f, tween(700, easing = FastOutSlowInEasing))
    }
    OnboardingPageScaffold(
        title = "Get your weekends back",
        subtitle = "Bettors put hours into research every week. Your agents compress it to minutes.",
        modifier = modifier,
    ) {
        Row(
            Modifier.fillMaxWidth().height(250.dp).padding(horizontal = 24.dp, vertical = 8.dp)
                .liquidGlassBackground(RoundedCornerShape(20.dp), Color.White.copy(alpha = 0.05f))
                .padding(20.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.Bottom,
        ) {
            TimeBar("~4 hrs/week", "Doing it\nyourself", 184.dp, typical.value, Color.White.copy(alpha = 0.22f))
            TimeBar("~15 min", "With\nWagerProof", 34.dp, wp.value, accent)
        }
        OnboardingFeatureRow(
            icon = "clock.badge.checkmark",
            title = "Answers, not homework",
            text = "Your agent reads the models, odds, and splits overnight — you just review its picks.",
            accent = accent,
            modifier = Modifier.padding(horizontal = 24.dp, vertical = 12.dp),
        )
    }
}

@Composable
private fun TimeBar(label: String, footer: String, height: androidx.compose.ui.unit.Dp, progress: Float, color: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Bottom) {
        Text(label, color = color.copy(alpha = if (progress > 0.8f) 1f else 0f), fontSize = 14.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Box(Modifier.width(82.dp).height(height * progress).clip(RoundedCornerShape(10.dp)).background(Brush.verticalGradient(listOf(color, color.copy(alpha = 0.55f)))))
        Text(footer, color = Color.White.copy(alpha = 0.75f), fontSize = 12.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 8.dp))
    }
}

@Composable
private fun SharpValuePage(modifier: Modifier) {
    OnboardingPageScaffold(title = "With WagerProof\nYou Can:", modifier = modifier) {
        Column(Modifier.padding(horizontal = 24.dp, vertical = 20.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
            MarkerBenefit("dollarsign.circle.fill", "Catch 2× more value\nbets every slate", Color(0xFFFF9800), false)
            MarkerBenefit("target", "Boost your hit rate\nby up to 30%", Color(0xFF22C55E), true)
            MarkerBenefit("clock.badge.checkmark", "Save 2+ hours a week\non research", Color(0xFFEF5350), false)
            MarkerBenefit("trophy.fill", "Tail sharp bettors up\n+40 units this season", Color(0xFF42A5F5), true)
        }
    }
}

@Composable
private fun MarkerBenefit(icon: String, copy: String, color: Color, reverse: Boolean) {
    Row(Modifier.fillMaxWidth().pageEntrance(if (reverse) 3 else 2), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        if (reverse) Spacer(Modifier.weight(1f))
        if (!reverse) MarkerIcon(icon, color)
        Text(copy, color = color, fontSize = 18.sp, fontWeight = FontWeight.Bold, lineHeight = 28.sp, modifier = Modifier.background(Color(0xE6212121), RoundedCornerShape(11.dp)).padding(12.dp))
        if (reverse) MarkerIcon(icon, color) else Spacer(Modifier.weight(1f))
    }
}

@Composable
private fun MarkerIcon(icon: String, color: Color) {
    Box(Modifier.size(64.dp).background(Color(0xE6212121), RoundedCornerShape(18.dp)), contentAlignment = Alignment.Center) {
        Icon(onboardingIcon(icon), null, tint = color, modifier = Modifier.size(30.dp))
    }
}

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
    OnboardingPageScaffold(title = "Not another chatbot", modifier = modifier) {
        AnimatedContent(
            targetState = store.agentPitchSlide,
            transitionSpec = { fadeIn(tween(250)) togetherWith fadeOut(tween(180)) },
            label = "agentPitchSlide",
            modifier = Modifier.fillMaxWidth().height(452.dp).pageEntrance(2),
        ) { slide ->
            when (slide) {
                0 -> WinRateSlide(accent)
                1 -> ComparisonSlide(accent)
                else -> OutliersSlide(accent)
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.pageEntrance(3)) {
            repeat(OnboardingStore.agentPitchSlideCount) { index ->
                Box(
                    Modifier.size(if (store.agentPitchSlide == index) 9.dp else 7.dp)
                        .background(if (store.agentPitchSlide == index) accent else Color.White.copy(alpha = 0.25f), CircleShape)
                        .clickable { store.setAgentPitchSlide(index) },
                )
            }
        }
    }
}

@Composable
private fun WinRateSlide(accent: Color) {
    Column(Modifier.fillMaxSize().padding(horizontal = 24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SlideHeading("Picks that actually hit")
        WinRateCurves(accent, Modifier.fillMaxWidth().height(250.dp).liquidGlassBackground(RoundedCornerShape(20.dp), Color.White.copy(alpha = 0.05f)).padding(16.dp))
        Text("Most bettors' picks land around a 40% win rate. Our top agents peak far higher — see them on the leaderboard and tail their picks.", color = Color.White.copy(alpha = 0.7f), fontSize = 14.sp, textAlign = TextAlign.Center, lineHeight = 20.sp)
    }
}

@Composable
private fun WinRateCurves(accent: Color, modifier: Modifier = Modifier) {
    Canvas(modifier) {
        fun curve(mean: Float, sigma: Float, color: Color, width: Float) {
            val path = Path()
            for (i in 0..100) {
                val xValue = 15f + i / 100f * 75f
                val z = (xValue - mean) / sigma
                val yValue = exp((-0.5f * z * z).toDouble()).toFloat()
                val x = i / 100f * size.width
                val y = size.height * 0.86f - yValue * size.height * 0.58f
                if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
            }
            drawPath(path, color, style = Stroke(width = width, cap = StrokeCap.Round))
        }
        curve(40f, 9f, Color.White.copy(alpha = 0.45f), 5f)
        curve(65f, 6.5f, accent, 7f)
    }
}

@Composable
private fun ComparisonSlide(accent: Color) {
    Column(Modifier.fillMaxSize().padding(horizontal = 24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SlideHeading("The data they don't have")
        ComparisonCard("ASKING CHATGPT", Color.White.copy(alpha = 0.55f), listOf("No live odds or line movement", "No model probabilities", "Confident-sounding guesswork"), false, Color.White.copy(alpha = 0.15f), accent)
        ComparisonCard("YOUR WAGERPROOF AGENT", accent, listOf("Proprietary model predictions per game", "Live odds, splits, weather, and market moves", "Reasoning you can read on every pick"), true, accent, accent)
    }
}

@Composable
private fun ComparisonCard(title: String, titleColor: Color, rows: List<String>, good: Boolean, border: Color, accent: Color) {
    Column(Modifier.fillMaxWidth().liquidGlassBackground(RoundedCornerShape(16.dp), Color.White.copy(alpha = 0.05f)).border(1.2.dp, border, RoundedCornerShape(16.dp)).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(title, color = titleColor, fontSize = 15.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp)
        rows.forEach { row ->
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Icon(onboardingIcon(if (good) "checkmark.circle.fill" else "xmark.circle.fill"), null, tint = if (good) accent else Color.White.copy(alpha = 0.35f), modifier = Modifier.size(16.dp))
                Text(row, color = Color.White.copy(alpha = if (good) 0.9f else 0.6f), fontSize = 14.sp, fontWeight = FontWeight.Medium)
            }
        }
    }
}

@Composable
private fun OutliersSlide(accent: Color) {
    Column(Modifier.fillMaxSize().padding(horizontal = 24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SlideHeading("Edges served daily")
        Column(Modifier.fillMaxWidth().liquidGlassBackground(RoundedCornerShape(22.dp), accent.copy(alpha = 0.14f)).border(1.dp, accent.copy(alpha = 0.35f), RoundedCornerShape(22.dp)).padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("KANSAS CITY CHIEFS", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Black)
            Text("BUF @ KC  •  SPREAD", color = accent, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            listOf("Won 4 of last 5 vs this opponent", "Covered 6 of last 8 as favorite", "Over hit in 5 of last 7 at home", "Won 7 of last 10 after a win").forEachIndexed { index, text ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(text, color = Color.White.copy(alpha = 0.85f), fontSize = 13.sp, modifier = Modifier.weight(1f))
                    Text(listOf("80%", "75%", "71%", "70%")[index], color = accent, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                }
                if (index < 3) HorizontalDivider(color = Color.White.copy(alpha = 0.08f))
            }
            Text("KC -2.5   -108", color = Color.Black, fontSize = 13.sp, fontWeight = FontWeight.Black, modifier = Modifier.background(accent, CircleShape).padding(horizontal = 12.dp, vertical = 7.dp))
        }
    }
}

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
        subtitle = "Like having an intern grind hours of research. You just get the answer.",
        modifier = modifier,
    ) {
        PixelSpriteAvatar(0, Modifier.size(116.dp).padding(top = 2.dp).pageEntrance(2))
        Column(Modifier.padding(horizontal = 24.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            OnboardingFeatureRow("clock.arrow.2.circlepath", "Works around the clock", "Scans every game, line, and edge on schedule. No prompting needed.", Modifier.pageEntrance(3), accent)
            OnboardingFeatureRow("cpu", "Thousands of data points per slate", "Models, market prices, public money, matchup context, all digested for you.", Modifier.pageEntrance(4), accent)
            OnboardingFeatureRow("text.magnifyingglass", "Shows its work", "Every pick ships with its reasoning. Value at your fingertips.", Modifier.pageEntrance(5), accent)
        }
    }
}

@Composable
fun OnboardingATTPage(modifier: Modifier = Modifier) {
    OnboardingPageScaffold(title = "One quick thing", modifier = modifier) {
        Text(
            buildAnnotatedString {
                append("Please tap ")
                pushStyle(SpanStyle(color = AppColors.appPrimary, fontWeight = FontWeight.Bold)); append("Allow"); pop()
                append(" so that we can prevent you from seeing advertising in the future and also find more users that would like to use the app.")
            },
            color = Color.White.copy(alpha = 0.7f),
            fontSize = 16.sp,
            lineHeight = 22.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = 24.dp).pageEntrance(1),
        )
        Column(Modifier.padding(horizontal = 40.dp, vertical = 16.dp).liquidGlassBackground(RoundedCornerShape(14.dp), Color.White.copy(alpha = 0.10f)), horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(onboardingIcon("chart.line.uptrend.xyaxis"), null, tint = AppColors.appPrimary, modifier = Modifier.padding(top = 24.dp).size(48.dp))
            Text("Allow \"WagerProof\" to track your\nactivity across other companies'\napps and websites?", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center, lineHeight = 18.sp, modifier = Modifier.padding(16.dp))
            Text("Your data will be used to deliver personalized ads to you.", color = Color.White.copy(alpha = 0.5f), fontSize = 12.sp, textAlign = TextAlign.Center, modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp))
            HorizontalDivider(color = Color.White.copy(alpha = 0.15f))
            Text("Allow", color = AppColors.appPrimary, fontSize = 17.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(12.dp))
            HorizontalDivider(color = Color.White.copy(alpha = 0.15f))
            Text("Ask App Not to Track", color = Color.White.copy(alpha = 0.5f), fontSize = 17.sp, modifier = Modifier.padding(12.dp))
        }
        Row(Modifier.padding(top = 12.dp).pageEntrance(3), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Icon(onboardingIcon("arrow.up"), null, tint = Color.White.copy(alpha = 0.5f), modifier = Modifier.size(16.dp))
            Text("Tap Allow when the pop-up appears", color = Color.White.copy(alpha = 0.5f), fontSize = 14.sp)
        }
    }
}

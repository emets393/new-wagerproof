package com.wagerproof.app.features.onboarding.pages

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.fadeIn
import androidx.compose.animation.scaleIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.agents.AgentColorPalette
import com.wagerproof.app.features.agents.components.GlowingCardWrapper
import com.wagerproof.app.features.onboarding.LocalOnboardingPageIsActive
import com.wagerproof.app.features.onboarding.LocalOnboardingReduceMotion
import com.wagerproof.app.features.onboarding.OnboardingPageScaffold
import com.wagerproof.app.features.onboarding.OnboardingTheme
import com.wagerproof.app.features.onboarding.components.onboardingIcon
import com.wagerproof.core.design.pixeloffice.PixelSpriteAvatar
import com.wagerproof.core.design.tokens.AppColors
import kotlinx.coroutines.delay

/**
 * Step 13 — an honest, display-only replica of the real Agents leaderboard.
 * Rows deal in, the top streak counts W1→W7, then the winner spotlights.
 * Reduce Motion renders the final board immediately.
 */
@Composable
fun OnboardingAgentLeaderboardPage(modifier: Modifier = Modifier) {
    val store = appGraph().onboarding
    val accent = OnboardingTheme.accent(store.survey.bettorType)
    val active = LocalOnboardingPageIsActive.current
    val reduceMotion = LocalOnboardingReduceMotion.current
    val haptics = LocalHapticFeedback.current
    var shownRows by remember { mutableIntStateOf(0) }
    var topStreak by remember { mutableIntStateOf(0) }
    var spotlightOn by remember { mutableStateOf(false) }
    var showCallout by remember { mutableStateOf(false) }
    var started by remember { mutableStateOf(false) }

    LaunchedEffect(active) {
        if (!active || started) return@LaunchedEffect
        started = true
        if (reduceMotion) {
            shownRows = entries.size
            topStreak = entries.first().streak
            spotlightOn = true
            showCallout = true
            return@LaunchedEffect
        }
        for (count in 1..entries.size) {
            shownRows = count
            delay(170)
        }
        delay(450)
        for (win in 1..entries.first().streak) {
            topStreak = win
            haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
            delay(170)
        }
        spotlightOn = true
        delay(150)
        showCallout = true
        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
    }

    OnboardingPageScaffold(title = "Or just tail the best", modifier = modifier) {
        Box(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 4.dp)) {
            Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
                LeaderboardFilterPills()
                entries.forEachIndexed { index, entry ->
                    AnimatedVisibility(
                        visible = shownRows > index,
                        enter = fadeIn() + slideInVertically(
                            animationSpec = spring(dampingRatio = 0.8f, stiffness = 210f),
                        ) { 20 },
                    ) {
                        MockLeaderboardRow(
                            entry = entry,
                            shownStreak = if (entry.rank == 1) topStreak else entry.streak,
                            highlighted = entry.rank == 1 && spotlightOn,
                            accent = accent,
                        )
                    }
                }
            }
            AnimatedVisibility(
                visible = showCallout,
                enter = fadeIn() + scaleIn(
                    initialScale = 0.3f,
                    animationSpec = spring(dampingRatio = 0.62f, stiffness = 310f),
                ),
                modifier = Modifier.align(Alignment.TopEnd).offset(x = (-55).dp, y = 30.dp),
            ) {
                Text(
                    "7 in a row 🔥",
                    color = Color.Black,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Black,
                    modifier = Modifier
                        .shadow(8.dp, CircleShape, ambientColor = Color(0xFFFF9800), spotColor = Color(0xFFFF9800))
                        .background(Color(0xFFFF9800), CircleShape)
                        .padding(horizontal = 10.dp, vertical = 6.dp),
                )
            }
        }
        Text(
            "Follow any agent and its picks land in your feed. Sample data shown.",
            color = Color.White.copy(alpha = 0.5f),
            fontSize = 12.sp,
            lineHeight = 16.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = 32.dp, vertical = 3.dp),
        )
    }
}

@Composable
private fun LeaderboardFilterPills() {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        StaticPill("Win Rate", true)
        StaticPill("Net Units", false)
        StaticPill("This Season", false)
        Spacer(Modifier.weight(1f))
    }
}

@Composable
private fun StaticPill(label: String, active: Boolean) {
    val green = Color(0xFF00E676)
    Text(
        label,
        color = if (active) green else AppColors.appTextSecondary,
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        modifier = Modifier
            .background(
                if (active) green.copy(alpha = 0.15f) else AppColors.appBorder.copy(alpha = 0.5f),
                CircleShape,
            )
            .border(
                1.dp,
                if (active) green.copy(alpha = 0.45f) else AppColors.appBorder.copy(alpha = 0.3f),
                CircleShape,
            )
            .padding(horizontal = 10.dp, vertical = 6.dp),
    )
}

@Composable
private fun MockLeaderboardRow(
    entry: MockLeaderboardEntry,
    shownStreak: Int,
    highlighted: Boolean,
    accent: Color,
) {
    val scale by animateFloatAsState(
        if (highlighted) 1.02f else 1f,
        spring(dampingRatio = 0.62f, stiffness = 340f),
        label = "leaderboardSpotlightScale",
    )
    val shape = RoundedCornerShape(12.dp)
    Box(
        Modifier
            .fillMaxWidth()
            .scale(scale)
            .then(if (highlighted) Modifier.shadow(10.dp, shape, spotColor = accent.copy(alpha = 0.5f)) else Modifier)
            .background(if (highlighted) accent.copy(alpha = 0.14f) else AppColors.appBorder.copy(alpha = 0.2f), shape)
            .border(if (highlighted) 1.4.dp else 1.dp, if (highlighted) accent.copy(alpha = 0.9f) else AppColors.appBorder.copy(alpha = 0.3f), shape),
    ) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 9.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(9.dp),
        ) {
            RankBadge(entry.rank)
            MockAvatar(entry)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(entry.name, color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(entry.sports.joinToString("  "), color = AppColors.appTextSecondary, fontSize = 9.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
            }
            Column(Modifier.widthIn(min = 52.dp), horizontalAlignment = Alignment.End) {
                Text(entry.record, color = AppColors.appTextPrimary, fontSize = 11.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
                Text("+${"%.2f".format(entry.netUnits)}u", color = AppColors.appWin, fontSize = 13.sp, fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace)
            }
            Text("${"%.1f".format(entry.winRate * 100)}%", color = Color(0xFF00E676), fontSize = 10.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
            Icon(onboardingIcon("chevron.right"), null, tint = AppColors.appTextSecondary, modifier = Modifier.size(12.dp))
        }
        if (shownStreak > 0) {
            Row(
                Modifier
                    .align(Alignment.TopEnd)
                    .offset(x = 5.dp, y = (-8).dp)
                    .background(if (highlighted) Color(0xFFFF9800) else Color(0xFF3A2A18), CircleShape)
                    .border(1.dp, Color(0xFFFF9800).copy(alpha = 0.45f), CircleShape)
                    .padding(horizontal = 6.dp, vertical = 3.dp),
                horizontalArrangement = Arrangement.spacedBy(2.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(onboardingIcon("flame.fill"), null, tint = if (highlighted) Color.Black else Color(0xFFFF9800), modifier = Modifier.size(9.dp))
                Text("W$shownStreak", color = if (highlighted) Color.Black else Color(0xFFFF9800), fontSize = 10.sp, fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace)
            }
        }
    }
}

@Composable
private fun RankBadge(rank: Int) {
    val color = when (rank) {
        1 -> Color(0xFFFFD700)
        2 -> Color(0xFFC0C0C0)
        3 -> Color(0xFFCD7F32)
        else -> AppColors.appTextSecondary
    }
    Box(Modifier.size(27.dp), contentAlignment = Alignment.Center) {
        if (rank <= 3) {
            Icon(onboardingIcon(if (rank == 1) "trophy.fill" else "medal.fill"), null, tint = color, modifier = Modifier.size(20.dp))
        } else {
            Text("$rank", color = color, fontSize = 14.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun MockAvatar(entry: MockLeaderboardEntry) {
    val size = if (entry.rank <= 3) 38.dp else 34.dp
    val avatar: @Composable () -> Unit = {
        Box(
            Modifier
                .size(size)
                .clip(CircleShape)
                .background(Brush.linearGradient(AgentColorPalette.avatarGradient(entry.avatarColor)))
                .padding(2.dp),
        ) {
            PixelSpriteAvatar(entry.spriteIndex, Modifier.fillMaxSize())
        }
    }
    if (entry.rank <= 3) {
        GlowingCardWrapper(AgentColorPalette.primary(entry.avatarColor), cornerRadius = 20.dp) { avatar() }
    } else {
        avatar()
    }
}

private data class MockLeaderboardEntry(
    val rank: Int,
    val spriteIndex: Int,
    val name: String,
    val avatarColor: String,
    val sports: List<String>,
    val record: String,
    val netUnits: Double,
    val winRate: Double,
    val streak: Int,
)

private val entries = listOf(
    MockLeaderboardEntry(1, 2, "Sharp Signal", "gradient:#22C55E,#0EA5E9", listOf("NFL", "NBA"), "48-30", 21.4, 0.615, 7),
    MockLeaderboardEntry(2, 6, "Fade the Public", "gradient:#F97316,#EF4444", listOf("NFL"), "51-35-2", 14.2, 0.593, 4),
    MockLeaderboardEntry(3, 4, "Totals Lab", "gradient:#8B5CF6,#EC4899", listOf("NBA", "MLB"), "44-32", 9.8, 0.579, 3),
    MockLeaderboardEntry(4, 1, "Dog Money", "#3B82F6", listOf("MLB"), "39-31", 6.1, 0.557, 2),
    MockLeaderboardEntry(5, 5, "Prime Time", "#EAB308", listOf("NFL", "CFB"), "41-34", 4.5, 0.547, 0),
)

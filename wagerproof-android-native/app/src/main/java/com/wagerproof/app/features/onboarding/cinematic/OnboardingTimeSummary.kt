package com.wagerproof.app.features.onboarding.cinematic

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearOutSlowInEasing
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.onboarding.LocalOnboardingReduceMotion
import com.wagerproof.app.features.onboarding.ResearchTimeEstimates
import com.wagerproof.app.features.onboarding.StakesEstimates
import com.wagerproof.app.features.onboarding.components.onboardingIcon
import com.wagerproof.app.features.onboarding.onboardingPressable
import com.wagerproof.app.features.onboarding.pageEntrance
import com.wagerproof.core.design.components.liquidGlassBackground
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.cos
import kotlin.math.pow
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.random.Random

/**
 * Final onboarding beat: reprises the user's own time and money-in-play inputs,
 * then completes only after the fist-bump choreography lands.
 */
@Composable
fun OnboardingTimeSummaryView(accent: Color, modifier: Modifier = Modifier) {
    val store = appGraph().onboarding
    val reduceMotion = LocalOnboardingReduceMotion.current
    val estimates = ResearchTimeEstimates(store.survey.researchTimeBucket)
    val stakes = StakesEstimates(store.survey.weeklyStakesBucket)
    var beat by remember { mutableStateOf(TimeSummaryBeat.Summary) }

    AnimatedContent(
        targetState = beat,
        transitionSpec = {
            val duration = if (reduceMotion) 1 else 360
            fadeIn(tween(duration)) togetherWith fadeOut(tween(duration))
        },
        label = "onboardingTimeSummaryBeat",
        modifier = modifier.fillMaxSize(),
    ) { currentBeat ->
        when (currentBeat) {
            TimeSummaryBeat.Summary -> TimeSummaryScreen(
                estimates = estimates,
                stakes = stakes,
                accent = accent,
                onFistBump = { beat = TimeSummaryBeat.FistBump },
            )
            TimeSummaryBeat.FistBump -> WagerFistBumpExplosion(
                reduceMotion = reduceMotion,
                onFinished = store::markComplete,
            )
        }
    }
}

private enum class TimeSummaryBeat { Summary, FistBump }

@Composable
private fun TimeSummaryScreen(
    estimates: ResearchTimeEstimates,
    stakes: StakesEstimates,
    accent: Color,
    onFistBump: () -> Unit,
) {
    Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            buildAnnotatedString {
                append("WagerProof will get you back ")
                withStyle(SpanStyle(color = accent, fontWeight = FontWeight.Black)) {
                    append("${estimates.reclaimYears}+ ${ResearchTimeEstimates.yearsWord(estimates.reclaimYears)}")
                }
                append(" of your life")
            },
            color = Color.White,
            fontSize = 28.sp,
            lineHeight = 34.sp,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = 28.dp).padding(top = 72.dp).pageEntrance(0),
        )

        Column(
            Modifier.padding(horizontal = 26.dp).padding(top = 40.dp),
            verticalArrangement = Arrangement.spacedBy(26.dp),
        ) {
            SummaryValueCard(
                icon = "clock.badge.checkmark",
                title = "About ${estimates.reclaimHoursPerWeek} hours back every week",
                detail = "Your agents run the score checks, line refreshes, and model reads for you.",
                accent = accent,
                modifier = Modifier.pageEntrance(1),
            )
            SummaryValueCard(
                icon = "bolt.fill",
                title = "Decide, don't grind",
                detail = "Start every slate from a screened shortlist with the reasoning attached.",
                accent = accent,
                modifier = Modifier.pageEntrance(2),
            )
            SummaryValueCard(
                icon = "checkmark.shield.fill",
                title = "Protect your ${stakes.yearlyActionDisplay} this year",
                detail = "Do more with the money you already put in play.",
                accent = accent,
                modifier = Modifier.pageEntrance(3),
            )
        }

        Spacer(Modifier.weight(1f))
        Text(
            "Let's lock it in with a fist bump",
            color = Color.White.copy(alpha = 0.55f),
            fontSize = 15.sp,
            modifier = Modifier.padding(bottom = 12.dp).pageEntrance(4),
        )
        Box(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp)
                .navigationBarsPadding()
                .padding(bottom = 24.dp)
                .height(60.dp)
                .liquidGlassBackground(CircleShape, Color.White.copy(alpha = 0.92f))
                .onboardingPressable(onClickLabel = "Let's do it", onClick = onFistBump)
                .pageEntrance(5),
            contentAlignment = Alignment.Center,
        ) {
            Text("👊  Let's Do It", color = Color.Black, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun SummaryValueCard(
    icon: String,
    title: String,
    detail: String,
    accent: Color,
    modifier: Modifier = Modifier,
) {
    Row(modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.Top) {
        Icon(onboardingIcon(icon), null, tint = accent, modifier = Modifier.size(34.dp).padding(3.dp))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(title, color = Color.White, fontSize = 20.sp, lineHeight = 24.sp, fontWeight = FontWeight.Bold)
            Text(detail, color = Color.White.copy(alpha = 0.6f), fontSize = 15.sp, lineHeight = 20.sp)
        }
    }
}

/**
 * Compose-native port of the iOS fist-bump burst. Emoji radiate from the fist,
 * which stays visible as the source; completion fires once the flight ends.
 */
@Composable
private fun WagerFistBumpExplosion(reduceMotion: Boolean, onFinished: () -> Unit) {
    val haptics = LocalHapticFeedback.current
    val fistScale = remember { Animatable(0.35f) }
    val fistRotation = remember { Animatable(-8f) }
    val punchScale = remember { Animatable(1f) }
    val burstProgress = remember { Animatable(0f) }
    val particles = remember { makeParticles() }
    var finished by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        if (reduceMotion) {
            fistScale.animateTo(1f, spring(dampingRatio = 0.6f, stiffness = 380f))
            haptics.performHapticFeedback(HapticFeedbackType.LongPress)
            burstProgress.animateTo(1f, tween(1_100, easing = LinearOutSlowInEasing))
            delay(300)
        } else {
            fistScale.animateTo(1f, spring(dampingRatio = 0.6f, stiffness = 390f))
            haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
            delay(20)

            repeat(4) { index ->
                fistRotation.animateTo(if (index % 2 == 0) 8f else -8f, tween(110))
            }
            haptics.performHapticFeedback(HapticFeedbackType.LongPress)

            coroutineScope {
                val flight = launch {
                    burstProgress.animateTo(1f, tween(1_600, easing = LinearOutSlowInEasing))
                }
                haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                punchScale.animateTo(1.42f, tween(90, easing = FastOutSlowInEasing))
                launch { punchScale.animateTo(1f, spring(dampingRatio = 0.5f, stiffness = 330f)) }
                repeat(5) {
                    haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                    delay(50)
                }
                flight.join()
            }
        }
        if (!finished) {
            finished = true
            onFinished()
        }
    }

    BoxWithConstraints(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        val t = burstProgress.value.coerceIn(0f, 1f)
        val reach = 1f - (1f - t).pow(2.4f)
        val particleAlpha = if (t < 0.6f) 1f else (1f - (t - 0.6f) / 0.4f).coerceIn(0f, 1f)
        val particleGrow = 0.15f + 0.85f * (t * 3f).coerceAtMost(1f)
        val xReach = constraints.maxWidth * 0.64f
        val yReach = constraints.maxHeight * 0.55f

        particles.forEach { particle ->
            Text(
                particle.emoji,
                fontSize = 30.sp,
                modifier = Modifier
                    .offset {
                        IntOffset(
                            (particle.dx * xReach * reach).roundToInt(),
                            (particle.dy * yReach * reach).roundToInt(),
                        )
                    }
                    .graphicsLayer {
                        alpha = particleAlpha
                        scaleX = particle.scale * particleGrow
                        scaleY = particle.scale * particleGrow
                        rotationZ = particle.spin * reach
                    },
            )
        }

        Text(
            "👊",
            fontSize = 96.sp,
            modifier = Modifier.graphicsLayer {
                scaleX = fistScale.value * punchScale.value
                scaleY = fistScale.value * punchScale.value
                rotationZ = fistRotation.value
            },
        )
    }
}

private data class FistBumpParticle(
    val dx: Float,
    val dy: Float,
    val spin: Float,
    val scale: Float,
    val emoji: String,
)

/** Even angular spacing + fixed-seed jitter guarantees a full radial burst. */
private fun makeParticles(): List<FistBumpParticle> {
    val random = Random(0x57414745)
    val pool = listOf("🏈", "🏀", "⚾️", "🏒", "⚽️", "💵", "💰", "🎟️", "📈", "🎯")
    val count = 52
    return List(count) { index ->
        val angle = index.toDouble() / count * Math.PI * 2 + random.nextDouble(-0.18, 0.18)
        val distance = random.nextDouble(0.62, 1.0).toFloat()
        FistBumpParticle(
            dx = cos(angle).toFloat() * distance,
            dy = sin(angle).toFloat() * distance,
            spin = random.nextDouble(-260.0, 260.0).toFloat(),
            scale = random.nextDouble(0.7, 1.5).toFloat(),
            emoji = pool[index % pool.size],
        )
    }
}

package com.wagerproof.app.features.onboarding.pages

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.sp
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.onboarding.LocalOnboardingPageIsActive
import com.wagerproof.app.features.onboarding.LocalOnboardingReduceMotion
import com.wagerproof.app.features.onboarding.OnboardingChip
import com.wagerproof.app.features.onboarding.OnboardingPageScaffold
import com.wagerproof.app.features.onboarding.OnboardingTheme
import com.wagerproof.app.features.onboarding.ResearchTimeBucket
import com.wagerproof.app.features.onboarding.ResearchTimeEstimates
import com.wagerproof.app.features.onboarding.StakesBucket
import com.wagerproof.app.features.onboarding.StakesEstimates
import com.wagerproof.app.features.onboarding.pageEntrance
import com.wagerproof.app.features.onboarding.parseEmphasisRuns
import com.wagerproof.core.design.components.liquidGlassBackground
import kotlinx.coroutines.delay
import kotlin.math.roundToInt

/** Page 6 — self-reported daily sports-app checking time. */
@Composable
fun OnboardingResearchTimePage(modifier: Modifier = Modifier) {
    val store = appGraph().onboarding
    val accent = OnboardingTheme.accent(store.survey.bettorType)
    val selected = store.survey.researchTimeBucket?.let { raw ->
        ResearchTimeBucket.entries.firstOrNull { it.raw == raw }
    }

    OnboardingPageScaffold(
        title = "How much time do you spend checking sports apps each day?",
        subtitle = "Scores, odds, lines, and feeds. Your best guess is fine.",
        modifier = modifier,
    ) {
        BucketGrid(
            options = ResearchTimeBucket.entries.map { it.raw to it.optionLabel },
            selectedRaw = selected?.raw,
            accent = accent,
            onSelect = store::setResearchTimeBucket,
        )
        AnimatedVisibility(
            visible = selected != null,
            enter = fadeIn(tween(240)) + slideInVertically(tween(300)) { it / 3 },
            exit = fadeOut(tween(120)),
        ) {
            selected?.let {
                BucketReply(
                    echo = it.echoLine,
                    reply = it.replyLine,
                    accent = accent,
                    modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp),
                )
            }
        }
    }
}

/** Page 7 — weekly money in play. This sizes risk; it never projects returns. */
@Composable
fun OnboardingStakesPage(modifier: Modifier = Modifier) {
    val store = appGraph().onboarding
    val accent = OnboardingTheme.accent(store.survey.bettorType)
    val selected = store.survey.weeklyStakesBucket?.let { raw ->
        StakesBucket.entries.firstOrNull { it.raw == raw }
    }

    OnboardingPageScaffold(
        title = "How much do you bet in a typical week?",
        subtitle = "Your best guess is fine. Just sizing it up.",
        modifier = modifier,
    ) {
        BucketGrid(
            options = StakesBucket.entries.map { it.raw to it.optionLabel },
            selectedRaw = selected?.raw,
            accent = accent,
            onSelect = store::setWeeklyStakesBucket,
        )
        AnimatedVisibility(
            visible = selected != null,
            enter = fadeIn(tween(240)) + slideInVertically(tween(300)) { it / 3 },
            exit = fadeOut(tween(120)),
        ) {
            selected?.let {
                BucketReply(
                    echo = it.echoLine,
                    reply = it.replyLine,
                    accent = accent,
                    modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp),
                )
            }
        }
    }
}

@Composable
private fun BucketGrid(
    options: List<Pair<String, String>>,
    selectedRaw: String?,
    accent: Color,
    onSelect: (String) -> Unit,
) {
    Column(
        Modifier.fillMaxWidth().padding(horizontal = 24.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        options.chunked(2).forEachIndexed { rowIndex, row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                row.forEach { (raw, label) ->
                    OnboardingChip(
                        label = label,
                        isSelected = selectedRaw == raw,
                        accent = accent,
                        modifier = Modifier.weight(1f).pageEntrance(2 + rowIndex),
                    ) { onSelect(raw) }
                }
                if (row.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun BucketReply(
    echo: String,
    reply: String,
    accent: Color,
    modifier: Modifier = Modifier,
) {
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(
            echo,
            color = Color.White.copy(alpha = 0.5f),
            fontSize = 15.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.padding(horizontal = 4.dp),
        )
        Text(
            reply,
            color = Color.White,
            fontSize = 17.sp,
            lineHeight = 23.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier
                .fillMaxWidth()
                .liquidGlassBackground(RoundedCornerShape(16.dp), accent.copy(alpha = 0.18f))
                .border(1.2.dp, accent.copy(alpha = 0.8f), RoundedCornerShape(16.dp))
                .padding(16.dp),
        )
    }
}

/** Page 8 — staged cost of continuing the reported checking habit by hand. */
@Composable
fun OnboardingResearchCostPage(modifier: Modifier = Modifier) {
    val store = appGraph().onboarding
    val active = LocalOnboardingPageIsActive.current
    val reduceMotion = LocalOnboardingReduceMotion.current
    val accent = OnboardingTheme.accent(store.survey.bettorType)
    val estimates = ResearchTimeEstimates(store.survey.researchTimeBucket)
    val stakes = StakesEstimates(store.survey.weeklyStakesBucket)
    // Only the active carousel page is mounted. If the user backs up after
    // seeing this reveal and returns without changing either source answer,
    // restore the fully-landed frame instead of replaying from a blank page
    // behind an already-enabled CTA.
    val alreadySeen = store.hasSeenCostReveal
    var showDays by remember { mutableStateOf(alreadySeen) }
    var showMeaning by remember { mutableStateOf(alreadySeen) }
    var showYears by remember { mutableStateOf(alreadySeen) }
    var showClose by remember { mutableStateOf(alreadySeen) }
    var started by remember { mutableStateOf(alreadySeen) }

    LaunchedEffect(active) {
        if (!active || started) return@LaunchedEffect
        started = true
        if (reduceMotion) {
            showDays = true
            showMeaning = true
            showYears = true
            showClose = true
            store.setCostRevealSeen()
            return@LaunchedEffect
        }
        showDays = true
        delay(2_600)
        showMeaning = true
        delay(900)
        showYears = true
        delay(2_400)
        showClose = true
        delay(500)
        store.setCostRevealSeen()
    }

    Column(
        modifier.fillMaxSize().padding(horizontal = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(22.dp)) {
            AnimatedVisibility(showDays, enter = revealEnter(), exit = fadeOut()) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("This year, you'll spend", color = Color.White.copy(alpha = 0.75f), fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
                    ResearchRollingNumber(
                        target = estimates.daysThisYear,
                        suffix = " days",
                        numberSize = 44,
                        suffixSize = 26,
                        color = Color.White,
                        landingHaptic = true,
                        animate = !alreadySeen,
                    )
                    ResearchRollingNumber(
                        target = stakes.yearlyAction,
                        prefix = "and risk $",
                        suffix = "",
                        groupsDigits = true,
                        numberSize = 27,
                        suffixSize = 27,
                        color = Color.White,
                        animate = !alreadySeen,
                        lineHeight = riskProjectionLineHeight(27),
                        modifier = Modifier.padding(vertical = RiskProjectionVerticalPadding),
                    )
                    Text("checking scores, odds, and apps", color = Color.White.copy(alpha = 0.7f), fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
                }
            }
            AnimatedVisibility(showMeaning, enter = revealEnter(), exit = fadeOut()) {
                Text(
                    "Across your life, you'll spend",
                    color = Color.White,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                )
            }
            AnimatedVisibility(showYears, enter = fadeIn(tween(420)) + scaleIn(initialScale = 0.9f), exit = fadeOut()) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    ResearchRollingNumber(
                        target = estimates.yearsOfLife,
                        suffix = " ${ResearchTimeEstimates.yearsWord(estimates.yearsOfLife)}",
                        numberSize = 58,
                        suffixSize = 30,
                        color = accent,
                        landingHaptic = true,
                        animate = !alreadySeen,
                    )
                    ResearchRollingNumber(
                        target = stakes.lifetimeAction,
                        prefix = "and risk $",
                        suffix = "",
                        groupsDigits = true,
                        numberSize = 30,
                        suffixSize = 30,
                        color = accent,
                        animate = !alreadySeen,
                        lineHeight = riskProjectionLineHeight(30),
                        modifier = Modifier.padding(vertical = RiskProjectionVerticalPadding),
                    )
                }
            }
            AnimatedVisibility(showClose, enter = revealEnter(), exit = fadeOut()) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    EmphasisText(
                        "on the board. **Yep — you read that right.**",
                        fontSize = 18,
                        color = Color.White.copy(alpha = 0.85f),
                    )
                    Text(
                        "Total wagered — money in play, not winnings or losses. Time at about 16 waking hours a day.",
                        color = Color.White.copy(alpha = 0.45f),
                        fontSize = 12.sp,
                        lineHeight = 16.sp,
                        textAlign = TextAlign.Center,
                    )
                }
            }
        }
    }
}

/** Page 9 — conservative time reclaim, with the disclosure always beside it. */
@Composable
fun OnboardingResearchReclaimPage(modifier: Modifier = Modifier) {
    val store = appGraph().onboarding
    val active = LocalOnboardingPageIsActive.current
    val reduceMotion = LocalOnboardingReduceMotion.current
    val accent = OnboardingTheme.accent(store.survey.bettorType)
    val estimates = ResearchTimeEstimates(store.survey.researchTimeBucket)
    val stakes = StakesEstimates(store.survey.weeklyStakesBucket)
    val alreadySeen = store.hasSeenReclaimReveal
    var showLead by remember { mutableStateOf(alreadySeen) }
    var showNumber by remember { mutableStateOf(alreadySeen) }
    var showClose by remember { mutableStateOf(alreadySeen) }
    var started by remember { mutableStateOf(alreadySeen) }

    LaunchedEffect(active) {
        if (!active || started) return@LaunchedEffect
        started = true
        if (reduceMotion) {
            showLead = true
            showNumber = true
            showClose = true
            store.setReclaimRevealSeen()
            return@LaunchedEffect
        }
        showLead = true
        delay(1_600)
        showNumber = true
        delay(2_400)
        showClose = true
        delay(500)
        store.setReclaimRevealSeen()
    }

    Column(
        modifier.fillMaxSize().padding(horizontal = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(22.dp)) {
            AnimatedVisibility(showLead, enter = revealEnter(), exit = fadeOut()) {
                Text(
                    "The good news: WagerProof researches for you.",
                    color = Color.White,
                    fontSize = 22.sp,
                    lineHeight = 28.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                )
            }
            AnimatedVisibility(showNumber, enter = fadeIn(tween(420)) + scaleIn(initialScale = 0.9f), exit = fadeOut()) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    ResearchRollingNumber(
                        target = estimates.reclaimYears,
                        suffix = "+ ${ResearchTimeEstimates.yearsWord(estimates.reclaimYears)}",
                        numberSize = 58,
                        suffixSize = 30,
                        color = accent,
                        landingHaptic = true,
                        animate = !alreadySeen,
                    )
                    Text(
                        "of your life back — about ${estimates.reclaimHoursPerWeek} hours a week you'll never scan again.",
                        color = Color.White.copy(alpha = 0.85f),
                        fontSize = 17.sp,
                        lineHeight = 23.sp,
                        fontWeight = FontWeight.SemiBold,
                        textAlign = TextAlign.Center,
                    )
                    Text(
                        "Estimates from your answers. Time projected across a betting lifetime at about 16 waking hours a day; dollars are money wagered, not winnings or losses. WagerProof does not promise profits or outcomes.",
                        color = Color.White.copy(alpha = 0.45f),
                        fontSize = 11.5.sp,
                        lineHeight = 15.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(top = 6.dp),
                    )
                }
            }
            AnimatedVisibility(showClose, enter = revealEnter(), exit = fadeOut()) {
                EmphasisText(
                    "Protect your **${stakes.yearlyActionDisplay}** and spend more time enjoying the games.",
                    fontSize = 18,
                    color = Color.White.copy(alpha = 0.85f),
                )
            }
        }
    }
}

@Composable
private fun ResearchRollingNumber(
    target: Int,
    suffix: String,
    numberSize: Int,
    suffixSize: Int,
    color: Color,
    prefix: String = "",
    groupsDigits: Boolean = false,
    landingHaptic: Boolean = false,
    animate: Boolean = true,
    lineHeight: TextUnit = TextUnit.Unspecified,
    modifier: Modifier = Modifier,
) {
    val reduceMotion = LocalOnboardingReduceMotion.current
    val haptics = LocalHapticFeedback.current
    val value = remember(target) {
        Animatable(if (reduceMotion || !animate) target.toFloat() else 0f)
    }
    LaunchedEffect(target, reduceMotion, animate) {
        if (reduceMotion || !animate) {
            value.snapTo(target.toFloat())
        } else {
            value.animateTo(target.toFloat(), tween(1_170, easing = FastOutSlowInEasing))
            if (landingHaptic) haptics.performHapticFeedback(HapticFeedbackType.LongPress)
        }
    }
    val shown = value.value.roundToInt()
    val shownString = if (groupsDigits) StakesEstimates.money(shown).removePrefix("$") else shown.toString()
    Text(
        text = buildAnnotatedString {
            withStyle(SpanStyle(fontSize = numberSize.sp, fontWeight = FontWeight.Black)) {
                append(prefix)
                append(shownString)
            }
            withStyle(SpanStyle(fontSize = suffixSize.sp, fontWeight = FontWeight.ExtraBold)) {
                append(suffix)
            }
        },
        color = color,
        fontFamily = FontFamily.Monospace,
        lineHeight = lineHeight,
        textAlign = TextAlign.Center,
        modifier = modifier.semantics {
            contentDescription = prefix +
                (if (groupsDigits) StakesEstimates.money(target).removePrefix("$") else target.toString()) +
                suffix
        },
    )
}

/** Extra leading/padding for seven-figure risk projections that wrap on phones. */
internal const val RiskProjectionExtraLeadingSp = 10
internal val RiskProjectionVerticalPadding = 4.dp
internal fun riskProjectionLineHeight(numberSize: Int): TextUnit =
    (numberSize + RiskProjectionExtraLeadingSp).sp

@Composable
private fun EmphasisText(markdown: String, fontSize: Int, color: Color) {
    Text(
        buildAnnotatedString {
            parseEmphasisRuns(markdown).forEach { (run, bold) ->
                withStyle(SpanStyle(fontWeight = if (bold) FontWeight.Black else FontWeight.SemiBold)) {
                    append(run)
                }
            }
        },
        color = color,
        fontSize = fontSize.sp,
        lineHeight = (fontSize + 6).sp,
        textAlign = TextAlign.Center,
    )
}

private fun revealEnter() = fadeIn(tween(420)) + slideInVertically(tween(440)) { it / 3 }

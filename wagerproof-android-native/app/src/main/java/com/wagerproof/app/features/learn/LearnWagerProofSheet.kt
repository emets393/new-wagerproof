package com.wagerproof.app.features.learn

import androidx.compose.animation.core.tween
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.learn.slides.Slide1Create247Agent
import com.wagerproof.app.features.learn.slides.Slide1GameCards
import com.wagerproof.app.features.learn.slides.Slide2GameDetails
import com.wagerproof.app.features.learn.slides.Slide3WagerBot
import com.wagerproof.app.features.learn.slides.Slide5Outliers
import com.wagerproof.app.features.learn.slides.Slide6MoreFeatures
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.Spacing
import com.wagerproof.core.stores.LearnWagerProofStore

/**
 * Port of iOS `LearnWagerProofBottomSheet.swift` — the canonical walkthrough.
 *
 * The shell ([MainScaffold]) already mounts this inside a `ModalBottomSheet`
 * when `learnStore.activeTopic != null`, so this renders the SHEET BODY only:
 * header (X / [SlideDots] / Next→Done) + a [HorizontalPager] carousel bound to
 * `learnStore.currentSlide`. Pager position and the store stay in sync both ways.
 */
private data class LearnSlideSpec(
    val icon: ImageVector,
    val title: String,
    val description: String,
    val valueProposition: String?,
    val content: @Composable () -> Unit,
)

private val slideSpecs: List<LearnSlideSpec> = listOf(
    LearnSlideSpec(
        AppIcon.fromSystemName("brain.head.profile")!!.imageVector,
        "Create a 24/7 Agent",
        "Build agents that research games and find picks for you all day, every day.",
        "Create multiple agents, run different strategies in parallel, and track the world's best agents with full records and picks on the leaderboard.",
    ) { Slide1Create247Agent() },
    LearnSlideSpec(
        AppIcon.fromSystemName("rectangle.stack.fill")!!.imageVector,
        "Game Predictions",
        "Our AI model analyzes thousands of data points. Green confidence = strong pick.",
        "Stop guessing. Our models process historical data, player stats, and situational factors to give you an edge over the average bettor. Higher confidence means higher historical accuracy.",
    ) { Slide1GameCards() },
    LearnSlideSpec(
        AppIcon.fromSystemName("chart.bar.fill")!!.imageVector,
        "Game Details",
        "Tap any game card to reveal full betting analysis and public betting sentiment.",
        "See where the smart money is going. When our model disagrees with Vegas, that's where value lives. Public betting percentages help you fade the crowd when they're wrong.",
    ) { Slide2GameDetails() },
    LearnSlideSpec(
        AppIcon.fromSystemName("brain.head.profile")!!.imageVector,
        "WagerBot Assistant",
        "WagerBot automatically surfaces insights as you browse.",
        "Never miss a key insight. WagerBot watches for trends, streaks, and situational edges so you don't have to dig through stats yourself. It's like having a research assistant in your pocket.",
    ) { Slide3WagerBot() },
    LearnSlideSpec(
        AppIcon.fromSystemName("chart.line.uptrend.xyaxis")!!.imageVector,
        "Outliers & Alerts",
        "Find value where prediction markets disagree with Vegas, or when model overconfidence signals a fade.",
        "Exploit market inefficiencies. When Polymarket odds differ significantly from Vegas, or when our model shows extreme confidence, these are historically profitable opportunities.",
    ) { Slide5Outliers() },
    LearnSlideSpec(
        AppIcon.fromSystemName("square.grid.2x2.fill")!!.imageVector,
        "More Features",
        "Explore all these features to maximize your betting edge.",
        null,
    ) { Slide6MoreFeatures() },
)

@Composable
fun LearnWagerProofSheet(modifier: Modifier = Modifier) {
    val learnStore = appGraph().learn
    val pagerState = rememberPagerState(
        initialPage = learnStore.currentSlide,
        pageCount = { LearnWagerProofStore.Topic.totalSlides },
    )

    // Pager swipe -> store. Settling on a page commits it as the source of truth.
    LaunchedEffect(pagerState) {
        snapshotFlow { pagerState.currentPage }.collect { page ->
            if (learnStore.currentSlide != page) learnStore.goToSlide(page)
        }
    }
    // Store (dot tap / Next button) -> pager scroll.
    LaunchedEffect(learnStore.currentSlide) {
        if (pagerState.currentPage != learnStore.currentSlide) {
            pagerState.animateScrollToPage(learnStore.currentSlide, animationSpec = tween(250))
        }
    }

    Column(modifier.fillMaxWidth().fillMaxHeight(0.92f)) {
        Header(learnStore)
        HorizontalPager(state = pagerState, modifier = Modifier.fillMaxSize()) { page ->
            val spec = slideSpecs[page]
            LearnSlide(
                icon = spec.icon,
                title = spec.title,
                description = spec.description,
                valueProposition = spec.valueProposition,
                modifier = Modifier.fillMaxSize(),
                content = spec.content,
            )
        }
    }
}

@Composable
private fun Header(learnStore: LearnWagerProofStore) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = Spacing.lg, vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .size(40.dp)
                .noRippleClickable {
                    learnStore.markAsSeen()
                    learnStore.closeSheet()
                },
            contentAlignment = Alignment.CenterStart,
        ) {
            Icon(
                imageVector = AppIcon.fromSystemName("xmark")!!.imageVector,
                contentDescription = "Close",
                tint = AppColors.appTextSecondary,
                modifier = Modifier.size(16.dp),
            )
        }

        SlideDots(currentSlide = learnStore.currentSlide, onDotPress = { learnStore.goToSlide(it) })

        Box(
            Modifier
                .size(width = 44.dp, height = 32.dp)
                .noRippleClickable {
                    if (learnStore.isLastSlide) {
                        learnStore.markAsSeen()
                        learnStore.closeSheet()
                    } else {
                        learnStore.nextSlide()
                    }
                },
            contentAlignment = Alignment.CenterEnd,
        ) {
            Text(
                text = if (learnStore.isLastSlide) "Done" else "Next",
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = AppColors.appPrimary,
            )
        }
    }
}

@Composable
private fun Modifier.noRippleClickable(onClick: () -> Unit): Modifier =
    this.clickable(
        interactionSource = remember { MutableInteractionSource() },
        indication = null,
        onClick = onClick,
    )

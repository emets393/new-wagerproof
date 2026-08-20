package com.wagerproof.app.features.paywall

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.agents.components.AgentParlayMiniTicket
import com.wagerproof.app.features.agents.components.AgentPickMiniTicket
import com.wagerproof.app.features.onboarding.ResearchTimeEstimates
import com.wagerproof.app.features.onboarding.StakesEstimates
import com.wagerproof.app.features.outliers.OutliersTrendCard
import com.wagerproof.app.features.outliers.OutliersTrendCardMode
import com.wagerproof.app.features.settings.AIConnectorBanner
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.pixeloffice.PixelOffice
import com.wagerproof.core.design.pixeloffice.PixelOfficeAgentSpec
import com.wagerproof.core.design.pixeloffice.PixelSpriteAvatar
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.AppTypography
import com.wagerproof.core.models.AgentParlay
import com.wagerproof.core.models.AgentParlayLeg
import com.wagerproof.core.models.AgentParlayScope
import com.wagerproof.core.models.AgentParlaySport
import com.wagerproof.core.models.AgentPick
import com.wagerproof.core.models.AgentSport
import com.wagerproof.core.models.OutliersTrendsCard
import com.wagerproof.core.models.OutliersTrendsCardRow
import com.wagerproof.core.models.OutliersTrendsSport
import com.wagerproof.core.models.OutliersTrendsSubjectKind
import com.wagerproof.core.services.AnalyticsService
import kotlinx.coroutines.delay
import java.util.Locale
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * Production feature carousel for the custom paywall — Compose port of iOS
 * `CustomPaywallFeaturePages.swift`.
 *
 * Seven pages, one large product hero each, then a fixed-height title/blurb
 * block above the paging dots. Heroes reuse the REAL production components
 * wherever one exists (`AgentPickMiniTicket`, `AgentParlayMiniTicket`,
 * `OutliersTrendCard`, `PixelOffice`, `AIConnectorBanner`) instead of paywall
 * recreations, so the pitch can't drift from the product it's selling.
 *
 * Page keys are WIRE VALUES: `paywall_feature_page_viewed.page_key` rolls up
 * with iOS in Mixpanel, so never rename one.
 */
internal val PaywallPageKeys = listOf(
    "value", "social_proof", "agent_hq", "leaderboard",
    "reasoned_picks", "outliers", "community_connectors",
)

@Composable
internal fun PaywallValueCarousel(
    accent: Color,
    agentName: String,
    spriteIndex: Int,
    researchBucketRaw: String?,
    stakesBucketRaw: String?,
    compact: Boolean,
    reduceMotion: Boolean,
    modifier: Modifier = Modifier,
) {
    val pagerState = rememberPagerState(pageCount = { PaywallPageKeys.size })
    val settledPage by remember { derivedStateOf { pagerState.settledPage } }

    LaunchedEffect(pagerState) {
        snapshotFlow { pagerState.settledPage }.collect { page ->
            AnalyticsService.track(
                "paywall_feature_page_viewed",
                mapOf(
                    "page_index" to page,
                    "page_key" to PaywallPageKeys[page.coerceIn(0, PaywallPageKeys.lastIndex)],
                ),
            )
        }
    }

    val resolvedAgentName = agentName.trim().ifEmpty { "Your agent" }

    Column(modifier = modifier) {
        HorizontalPager(
            state = pagerState,
            modifier = Modifier.fillMaxWidth().weight(1f),
        ) { page ->
            when (page) {
                0 -> BeforeAfterPage(
                    accent = accent,
                    compact = compact,
                    isActive = settledPage == 0,
                    reduceMotion = reduceMotion,
                    researchBucketRaw = researchBucketRaw,
                    stakesBucketRaw = stakesBucketRaw,
                    modifier = Modifier.fillMaxSize(),
                )

                1 -> FeaturePage(
                    title = "Loved by bettors who want the why",
                    blurb = "Five-star feedback from bettors using WagerProof across different betting styles.",
                    compact = compact,
                ) { heroModifier ->
                    SocialProofHero(
                        compact = compact,
                        autoScroll = settledPage == 1 && !reduceMotion,
                        modifier = heroModifier,
                    )
                }

                2 -> FeaturePage(
                    title = "Your agent is already working",
                    blurb = "Watch your agents move around the office and research for you 24/7",
                    compact = compact,
                ) { heroModifier ->
                    AgentHQHero(
                        agentName = resolvedAgentName,
                        spriteIndex = spriteIndex,
                        isActive = settledPage == 2,
                        modifier = heroModifier,
                    )
                }

                3 -> FeaturePage(
                    title = "Copy from the leaderboard",
                    blurb = "See the strategies that are working and tail the trends.",
                    compact = compact,
                ) { heroModifier ->
                    LeaderboardHero(
                        accent = accent,
                        compact = compact,
                        isActive = settledPage == 3,
                        reduceMotion = reduceMotion,
                        modifier = heroModifier,
                    )
                }

                4 -> FeaturePage(
                    title = "Picks that show their work",
                    blurb = "Every recommendation includes the odds, confidence, and signals behind it.",
                    compact = compact,
                ) { heroModifier ->
                    ReasonedPicksHero(
                        accent = accent,
                        compact = compact,
                        isActive = settledPage == 4,
                        reduceMotion = reduceMotion,
                        modifier = heroModifier,
                    )
                }

                5 -> FeaturePage(
                    title = "The signals most bettors miss",
                    blurb = "Rare historical splits and matchup trends, paired with the line in front of you.",
                    compact = compact,
                ) { heroModifier ->
                    OutliersHero(
                        compact = compact,
                        isActive = settledPage == 5,
                        reduceMotion = reduceMotion,
                        modifier = heroModifier,
                    )
                }

                else -> FeaturePage(
                    title = "Your data, wherever you research",
                    blurb = "Join the private Discord or bring WagerProof into the AI tools you already use.",
                    compact = compact,
                ) { heroModifier ->
                    CommunityConnectorsHero(compact = compact, modifier = heroModifier)
                }
            }
        }

        PageDots(page = settledPage, count = PaywallPageKeys.size, accent = accent, compact = compact)
    }
}

// MARK: - Shared page composition

/**
 * Hero on top taking the leftover height, then a FIXED-height copy block.
 * Pinning the copy height is what keeps the title baseline from jumping as the
 * user pages between heroes of different natural heights.
 */
@Composable
private fun FeaturePage(
    title: String,
    blurb: String,
    compact: Boolean,
    hero: @Composable (Modifier) -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = if (compact) 12.dp else 18.dp),
    ) {
        hero(Modifier.fillMaxWidth().weight(1f))

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .height(if (compact) 112.dp else 128.dp)
                .padding(top = if (compact) 8.dp else 12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(if (compact) 6.dp else 8.dp),
        ) {
            Text(
                text = title,
                style = AppTypography.display.copy(
                    fontFamily = AppTypography.SystemFontFamily,
                    fontSize = if (compact) 22.sp else 26.sp,
                    fontWeight = FontWeight.Black,
                ),
                color = AppColors.appTextPrimary,
                textAlign = TextAlign.Center,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = blurb,
                fontSize = if (compact) 13.sp else 15.sp,
                lineHeight = if (compact) 17.sp else 20.sp,
                color = AppColors.appTextSecondary,
                textAlign = TextAlign.Center,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(horizontal = if (compact) 8.dp else 20.dp),
            )
        }
    }
}

@Composable
private fun PageDots(page: Int, count: Int, accent: Color, compact: Boolean) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(if (compact) 28.dp else 34.dp)
            .clearAndSetSemantics {
                contentDescription = "Feature carousel, page ${page + 1} of $count"
            },
        horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        repeat(count) { index ->
            val selected = index == page
            val width by animateDpAsState(if (selected) 18.dp else 6.dp, label = "dot-width")
            Box(
                Modifier
                    .width(width)
                    .height(6.dp)
                    .background(
                        if (selected) accent else Color.White.copy(alpha = 0.22f),
                        RoundedCornerShape(3.dp),
                    ),
            )
        }
    }
}

// MARK: - Page 1: before/after outcome story

/**
 * The opening page. Two unboxed columns share a "Before | After" masthead; each
 * counts a win-rate % and an APP TIME figure up from zero while its bars grow
 * and a smoothed ROI line draws on (down + red for Before, up + green for
 * After). APP TIME comes from the user's OWN onboarding answer, so the page is
 * personalized before the plan cards ever appear.
 */
@Composable
private fun BeforeAfterPage(
    accent: Color,
    compact: Boolean,
    isActive: Boolean,
    reduceMotion: Boolean,
    researchBucketRaw: String?,
    stakesBucketRaw: String?,
    modifier: Modifier = Modifier,
) {
    val researchHours = remember(researchBucketRaw) {
        ResearchTimeEstimates(researchBucketRaw).bucket.hoursPerWeek
    }
    // Agents take over ~75% of the repetitive checking; the "after" keeps the rest.
    val afterHours = max(0.5, researchHours * 0.25)

    val beforeProgress = remember { Animatable(0f) }
    val afterProgress = remember { Animatable(0f) }

    LaunchedEffect(isActive, reduceMotion) {
        if (!isActive) {
            beforeProgress.snapTo(0f)
            afterProgress.snapTo(0f)
            return@LaunchedEffect
        }
        if (reduceMotion) {
            beforeProgress.snapTo(1f)
            afterProgress.snapTo(1f)
            return@LaunchedEffect
        }
        beforeProgress.snapTo(0f)
        afterProgress.snapTo(0f)
        beforeProgress.animateTo(1f, tween(720))
        delay(120)
        afterProgress.animateTo(1f, spring(dampingRatio = 0.82f, stiffness = Spring.StiffnessLow))
    }

    // The whole slide shrinks together — comparison chart, headline, and bullets.
    // Scoped here rather than pushed into each child so nothing gets missed.
    ScaledDown(PAGE_SHRINK) {
    Column(
        modifier = modifier
            .verticalScroll(rememberScrollState())
            .padding(horizontal = if (compact) 15.dp else 20.dp, vertical = if (compact) 4.dp else 10.dp),
        verticalArrangement = Arrangement.spacedBy(if (compact) 14.dp else 20.dp),
    ) {
        ComparisonUnit(
            accent = accent,
            compact = compact,
            beforeHours = researchHours,
            afterHours = afterHours,
            beforeProgress = beforeProgress.value,
            afterProgress = afterProgress.value,
        )

        // Typographic play: "less" is thin (visually LESS), "more" is the
        // heaviest weight (visually MORE).
        Text(
            text = buildAnnotatedString {
                withStyle(SpanStyle(fontWeight = FontWeight.Medium)) { append("Check ") }
                withStyle(SpanStyle(fontWeight = FontWeight.Thin, fontStyle = FontStyle.Italic)) { append("less") }
                withStyle(SpanStyle(fontWeight = FontWeight.Medium)) { append(". Enjoy ") }
                withStyle(SpanStyle(fontWeight = FontWeight.Black)) { append("more") }
                withStyle(SpanStyle(fontWeight = FontWeight.Medium)) { append(".") }
            },
            fontSize = if (compact) 22.sp else 26.sp,
            color = AppColors.appTextPrimary,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )

        Benefits(accent = accent, compact = compact, stakesBucketRaw = stakesBucketRaw)
    }
    }
}

@Composable
private fun ComparisonUnit(
    accent: Color,
    compact: Boolean,
    beforeHours: Double,
    afterHours: Double,
    beforeProgress: Float,
    afterProgress: Float,
) {
    Column(Modifier.fillMaxWidth().height(if (compact) 226.dp else 268.dp)) {
        Row(Modifier.fillMaxWidth().padding(bottom = if (compact) 5.dp else 6.dp)) {
            ColumnHeader("Before", compact, Modifier.weight(1f))
            ColumnHeader("After", compact, Modifier.weight(1f))
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(Color.White.copy(alpha = 0.09f)))
        Row(Modifier.fillMaxWidth().weight(1f)) {
            OutcomeColumn(
                winRate = 25.0,
                hours = beforeHours,
                bars = listOf(0.82f, 0.68f, 0.92f, 0.76f),
                linePoints = listOf(0.88f, 0.72f, 0.80f, 0.55f, 0.60f, 0.36f, 0.28f, 0.12f),
                lineColor = Color(0xFFFF8F8F),
                progress = beforeProgress,
                tint = AppColors.appLoss,
                compact = compact,
                modifier = Modifier.weight(1f),
            )
            Box(Modifier.width(1.dp).fillMaxHeight().background(Color.White.copy(alpha = 0.09f)))
            OutcomeColumn(
                winRate = 68.0,
                hours = afterHours,
                bars = listOf(0.30f, 0.22f, 0.36f, 0.26f),
                linePoints = listOf(0.12f, 0.26f, 0.20f, 0.44f, 0.40f, 0.62f, 0.72f, 0.90f),
                lineColor = Color(0xFF8EF0B6),
                progress = afterProgress,
                tint = accent,
                compact = compact,
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun ColumnHeader(phase: String, compact: Boolean, modifier: Modifier = Modifier) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = phase,
            style = AppTypography.display.copy(fontSize = if (compact) 23.sp else 29.sp),
            fontWeight = FontWeight.Black,
            color = Color.White,
        )
        Text(
            text = "WagerProof",
            style = AppTypography.micro.copy(fontSize = if (compact) 9.sp else 10.sp),
            fontWeight = FontWeight.Bold,
            color = Color.White.copy(alpha = 0.5f),
        )
    }
}

@Composable
private fun OutcomeColumn(
    winRate: Double,
    hours: Double,
    bars: List<Float>,
    linePoints: List<Float>,
    lineColor: Color,
    progress: Float,
    tint: Color,
    compact: Boolean,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .padding(horizontal = if (compact) 12.dp else 18.dp, vertical = if (compact) 4.dp else 6.dp),
        verticalArrangement = Arrangement.spacedBy(if (compact) 6.dp else 9.dp),
    ) {
        StatBlock("WIN RATE", "${(progress * winRate).roundToInt()}%", tint, compact)
        StatBlock("APP TIME", formatHours(progress * hours, integerStyle = hours >= 10), tint, compact)

        val chartHeight = if (compact) 58.dp else 76.dp
        Box(Modifier.fillMaxWidth().height(chartHeight)) {
            // One faint gridline near the top, like the reference chart.
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .align(Alignment.TopStart)
                    .background(Color.White.copy(alpha = 0.07f)),
            )
            Row(
                modifier = Modifier.fillMaxSize(),
                horizontalArrangement = Arrangement.spacedBy(if (compact) 6.dp else 8.dp),
                verticalAlignment = Alignment.Bottom,
            ) {
                bars.forEachIndexed { index, value ->
                    val animated by animateFloatAsState(
                        targetValue = max(4f, value * chartHeight.value * progress),
                        animationSpec = spring(dampingRatio = 0.78f, stiffness = Spring.StiffnessMediumLow),
                        label = "bar-$index",
                    )
                    Box(
                        Modifier
                            .weight(1f)
                            .height(animated.dp)
                            .background(
                                Brush.verticalGradient(listOf(tint, tint.copy(alpha = 0.55f))),
                                RoundedCornerShape(2.5.dp),
                            ),
                    )
                }
            }
            TrendLine(
                points = linePoints,
                progress = progress,
                color = lineColor,
                strokeWidth = if (compact) 2.5f else 3f,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = if (compact) 4.dp else 6.dp, vertical = if (compact) 4.dp else 5.dp),
            )
        }

        Row(Modifier.fillMaxWidth()) {
            listOf("M", "T", "W", "T").forEach { day ->
                Text(
                    text = day,
                    style = AppTypography.monoCaption.copy(fontSize = if (compact) 7.sp else 8.sp),
                    fontWeight = FontWeight.Bold,
                    color = Color.White.copy(alpha = 0.35f),
                    textAlign = TextAlign.Center,
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

private fun formatHours(value: Double, integerStyle: Boolean): String =
    if (integerStyle) "${value.roundToInt()} hrs/wk" else String.format(Locale.US, "%.1f hrs/wk", value)

@Composable
private fun StatBlock(caption: String, value: String, tint: Color, compact: Boolean) {
    Column(verticalArrangement = Arrangement.spacedBy(if (compact) 1.dp else 2.dp)) {
        Text(
            text = caption,
            style = AppTypography.monoCaption.copy(fontSize = if (compact) 9.sp else 10.sp),
            fontWeight = FontWeight.Black,
            color = Color.White.copy(alpha = 0.6f),
        )
        Text(
            text = value,
            style = AppTypography.display.copy(fontSize = if (compact) 24.sp else 30.sp),
            fontWeight = FontWeight.Black,
            color = tint,
            maxLines = 1,
        )
    }
}

/**
 * Smoothed ROI trend over the bars. Points are normalized 0…1 heights measured
 * from the bottom, so a descending sequence slopes down. Catmull-Rom → cubic
 * bézier (tension 1/6) rounds the corners so it reads as an equity line rather
 * than ruler segments. The path is TRIMMED by [progress] so it draws on with
 * the reveal instead of appearing whole.
 */
@Composable
private fun TrendLine(
    points: List<Float>,
    progress: Float,
    color: Color,
    strokeWidth: Float,
    modifier: Modifier = Modifier,
) {
    val density = LocalDensity.current
    Canvas(modifier) {
        if (points.size < 2 || progress <= 0f) return@Canvas
        val stroke = with(density) { strokeWidth.dp.toPx() }
        val lastIndex = points.size - 1
        val visibleSpan = lastIndex * progress.coerceIn(0f, 1f)
        val lastFull = visibleSpan.toInt().coerceIn(0, lastIndex)

        fun pointAt(index: Int) = Offset(
            x = size.width * index / lastIndex,
            y = size.height * (1f - points[index].coerceIn(0f, 1f)),
        )

        val pts = ArrayList<Offset>(points.size)
        for (index in 0..lastFull) pts += pointAt(index)
        val fraction = visibleSpan - lastFull
        if (fraction > 0f && lastFull < lastIndex) {
            val prev = pts.last()
            val next = pointAt(lastFull + 1)
            pts += Offset(prev.x + (next.x - prev.x) * fraction, prev.y + (next.y - prev.y) * fraction)
        }
        if (pts.size < 2) return@Canvas

        val path = Path().apply {
            moveTo(pts[0].x, pts[0].y)
            for (i in 0 until pts.size - 1) {
                val p0 = pts[max(i - 1, 0)]
                val p1 = pts[i]
                val p2 = pts[i + 1]
                val p3 = pts[minOf(i + 2, pts.size - 1)]
                cubicTo(
                    p1.x + (p2.x - p0.x) / 6f, p1.y + (p2.y - p0.y) / 6f,
                    p2.x - (p3.x - p1.x) / 6f, p2.y - (p3.y - p1.y) / 6f,
                    p2.x, p2.y,
                )
            }
        }
        drawPath(path, color, style = Stroke(width = stroke, cap = StrokeCap.Round, join = StrokeJoin.Round))
    }
}

@Composable
private fun Benefits(accent: Color, compact: Boolean, stakesBucketRaw: String?) {
    // Bullet 1 becomes the money line when the onboarding stakes answer exists —
    // it ties the "money in play" thread into the paywall. Falls back to the
    // generic time bullet only when no stakes answer was given.
    val stakes = remember(stakesBucketRaw) { stakesBucketRaw?.let { StakesEstimates(it) } }
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(if (compact) 14.dp else 20.dp),
    ) {
        if (stakes != null) {
            BenefitRow(
                AppIcon.CHECKMARK_SHIELD_FILL,
                "Protect your ${stakes.yearlyActionDisplay}",
                " in projected bets this year",
                accent, compact,
            )
        }
        // No generic fallback for the money line: the old "Hours back every
        // week" bullet was cut to buy vertical space for the second CTA, so a
        // user with no stakes answer simply gets two bullets.
        BenefitRow(AppIcon.CHART_LINE_UPTREND, "Find high multiple parlays", " in seconds", accent, compact)
        BenefitRow(
            AppIcon.CHECKMARK_SEAL_FILL,
            "Public leaderboards",
            " with real graded wins you can copy",
            accent, compact,
        )
    }
}

@Composable
private fun BenefitRow(
    icon: AppIcon,
    lead: String,
    rest: String,
    accent: Color,
    compact: Boolean,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(if (compact) 13.dp else 15.dp),
    ) {
        Box(
            modifier = Modifier
                .size(if (compact) 34.dp else 38.dp)
                .background(accent.copy(alpha = 0.14f), RoundedCornerShape(10.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = icon.imageVector,
                contentDescription = null,
                tint = accent,
                modifier = Modifier.size(if (compact) 17.dp else 19.dp),
            )
        }
        Text(
            text = buildAnnotatedString {
                withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(lead) }
                withStyle(SpanStyle(fontWeight = FontWeight.Normal)) { append(rest) }
            },
            style = AppTypography.display.copy(fontSize = if (compact) 16.sp else 19.sp),
            color = Color.White,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

// MARK: - Page 2: verified social proof

/**
 * The first pair is sourced from the US App Store listing. The remaining
 * persona-focused copy is preview content for the paywall carousel.
 */
private data class SocialProofCard(
    val id: String,
    val title: String,
    val body: String,
    val footer: String,
)

private val SocialProofCards = listOf(
    SocialProofCard("spaceguy4", "BEST AI FOR SPORTS BETTING", "Takes complicated data and makes it easy to read.", "SpaceGuy4"),
    SocialProofCard("tendyboi", "LOVE THIS APP", "Tons of data for every game.", "TendyBoi"),
    SocialProofCard("line-shopper", "LINE SHOPPING FINALLY CLICKS", "The model-versus-market view makes it obvious when a line is worth taking.", "Marcus T."),
    SocialProofCard("parlay-builder", "MY PARLAYS HAVE A PROCESS", "I can see why every leg made the ticket instead of blindly stacking picks.", "Jalen R."),
    SocialProofCard("busy-slate", "SAVES ME HOURS ON GAME DAY", "I get the reasoning fast without bouncing between ten different apps.", "Chris M."),
    SocialProofCard("public-records", "THE PUBLIC RECORDS SOLD ME", "Seeing every win, loss, unit, and streak makes it obvious which agents to follow.", "Devon K."),
    SocialProofCard("prop-board", "PLAYER PROPS FINALLY MAKE SENSE", "The matchup trends and model edges help me narrow a huge prop board fast.", "Avery L."),
    SocialProofCard("mlb-routine", "MY MLB MORNING ROUTINE", "I can scan pitchers, splits, and the strongest market angles before the first game.", "Nate P."),
    SocialProofCard("less-second-guessing", "LESS TIME SECOND-GUESSING", "The reasoning is concise enough to understand quickly but detailed enough to trust.", "Maya S."),
    SocialProofCard("data-nerd", "BUILT FOR DATA NERDS", "I get the deeper numbers I want without losing the actual betting takeaway.", "Jordan W."),
    SocialProofCard("discord-ready", "THE DISCORD KEEPS ME READY", "The best signals reach me without needing to keep the app open all afternoon.", "Sam R."),
    SocialProofCard("track-record-trust", "THE TRACK RECORD BUILDS TRUST", "Public wins and losses make this feel accountable instead of like another picks app.", "Taylor B."),
)

@Composable
private fun SocialProofHero(compact: Boolean, autoScroll: Boolean, modifier: Modifier = Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(if (compact) 7.dp else 9.dp)) {
        RatingTile(compact)
        Box(Modifier.fillMaxWidth().weight(1f)) {
            AutoScrollingReviews(compact = compact, autoScroll = autoScroll)
            // Bottom fade so the clipped last row reads as "more below".
            Box(
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .height(if (compact) 28.dp else 42.dp)
                    .background(
                        Brush.verticalGradient(listOf(Color.Transparent, Color(0xFF060806).copy(alpha = 0.94f))),
                    ),
            )
        }
    }
}

@Composable
private fun RatingTile(compact: Boolean) {
    SocialTile(
        cornerRadius = 20.dp,
        modifier = Modifier.fillMaxWidth().height(if (compact) 44.dp else 54.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(if (compact) 8.dp else 12.dp),
            modifier = Modifier.fillMaxSize().clearAndSetSemantics {
                contentDescription = "Loved by thousands of bettors. Rated 4.7 out of 5."
            },
        ) {
            // iOS leads this tile with the Apple logo because the 4.7 is the App
            // Store rating. On Android that glyph would be nonsense, so the
            // platform-neutral verified seal carries the same "this is a real,
            // published rating" signal.
            Icon(
                imageVector = AppIcon.CHECKMARK_SEAL_FILL.imageVector,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(if (compact) 18.dp else 22.dp),
            )
            Text(
                text = "4.7",
                style = AppTypography.display.copy(fontSize = if (compact) 26.sp else 32.sp),
                fontWeight = FontWeight.Black,
                color = Color.White,
            )
            Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                StarRow(size = if (compact) 7.dp else 9.dp)
                Text(
                    text = "LOVED BY THOUSANDS",
                    style = AppTypography.monoCaption.copy(fontSize = if (compact) 7.5.sp else 9.sp),
                    fontWeight = FontWeight.Black,
                    color = AppColors.appTextSecondary,
                )
            }
        }
    }
}

@Composable
private fun StarRow(size: Dp) {
    Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        repeat(5) {
            Icon(
                imageVector = AppIcon.STAR_FILL.imageVector,
                contentDescription = null,
                tint = AppColors.appAccentAmber,
                modifier = Modifier.size(size),
            )
        }
    }
}

/**
 * Two-column review grid that drifts down then back up on its own. A user drag
 * pauses the drift for 4 s so a deliberate scroll isn't fought by the animation.
 */
@Composable
private fun AutoScrollingReviews(compact: Boolean, autoScroll: Boolean) {
    val gridState = rememberLazyGridState()
    var pausedUntil by remember { mutableLongStateOf(0L) }

    LaunchedEffect(gridState) {
        snapshotFlow { gridState.isScrollInProgress }
            .collect { scrolling -> if (!scrolling) pausedUntil = System.currentTimeMillis() + 4_000 }
    }

    LaunchedEffect(autoScroll) {
        if (!autoScroll) return@LaunchedEffect
        val rowCount = (SocialProofCards.size + 1) / 2
        var row = 0
        var direction = 1
        while (true) {
            delay(2_200)
            if (System.currentTimeMillis() < pausedUntil) continue
            if (row + direction >= rowCount || row + direction < 0) direction = -direction
            row += direction
            runCatching { gridState.animateScrollToItem(row * 2) }
            delay(1_400)
        }
    }

    LazyVerticalGrid(
        columns = GridCells.Fixed(2),
        state = gridState,
        modifier = Modifier.fillMaxSize(),
        horizontalArrangement = Arrangement.spacedBy(if (compact) 6.dp else 8.dp),
        verticalArrangement = Arrangement.spacedBy(if (compact) 6.dp else 8.dp),
    ) {
        items(items = SocialProofCards, key = { it.id }) { card ->
            ReviewCard(card, compact)
        }
    }
}

@Composable
private fun ReviewCard(card: SocialProofCard, compact: Boolean) {
    SocialTile(
        cornerRadius = 17.dp,
        modifier = Modifier.fillMaxWidth().height(if (compact) 102.dp else 118.dp),
    ) {
        Column(
            Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(if (compact) 3.dp else 4.dp),
        ) {
            StarRow(size = if (compact) 7.dp else 8.5.dp)
            Text(
                text = card.title,
                style = AppTypography.monoCaption.copy(fontSize = if (compact) 8.5.sp else 10.sp),
                fontWeight = FontWeight.Black,
                color = AppColors.appTextSecondary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = "“${card.body}”",
                fontSize = if (compact) 11.sp else 13.sp,
                lineHeight = if (compact) 14.sp else 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color.White,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(Modifier.weight(1f))
            Text(
                text = card.footer,
                fontSize = if (compact) 9.sp else 10.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = AppColors.appTextMuted,
                maxLines = 1,
            )
        }
    }
}

@Composable
private fun SocialTile(cornerRadius: Dp, modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    val shape = RoundedCornerShape(cornerRadius)
    Box(
        modifier = modifier
            .clip(shape)
            .background(Color.White.copy(alpha = 0.055f), shape)
            .border(1.dp, Color.White.copy(alpha = 0.12f), shape)
            .padding(9.dp),
    ) {
        content()
    }
}

// MARK: - Page 3: live Agent HQ

@Composable
private fun AgentHQHero(
    agentName: String,
    spriteIndex: Int,
    isActive: Boolean,
    modifier: Modifier = Modifier,
) {
    val agents = remember(agentName, spriteIndex) {
        listOf(
            PixelOfficeAgentSpec(agentName, "", null, max(0, spriteIndex) % 8, "working", "WORKING", true),
            PixelOfficeAgentSpec("Line Hawk", "", null, 1, "thinking", "THINKING", true),
            PixelOfficeAgentSpec("Totals Lab", "", null, 4, "working", "WORKING", true),
            PixelOfficeAgentSpec("Fade Finder", "", null, 6, "done", "PICKS READY", true),
            PixelOfficeAgentSpec("Model Maven", "", null, 3, "thinking", "THINKING", true),
            PixelOfficeAgentSpec("Value Hunter", "", null, 7, "working", "WORKING", true),
        )
    }

    Box(modifier, contentAlignment = Alignment.Center) {
        Box(
            Modifier
                .fillMaxHeight()
                .aspectRatio(864f / 800f)
                .clip(RoundedCornerShape(18.dp))
                .border(1.dp, Color.White.copy(alpha = 0.15f), RoundedCornerShape(18.dp)),
        ) {
            // Labels only — the scene, sprites, and pills keep their size. Long
            // agent names were crowding the name plates at this slide's scale.
            PixelOffice(
                agents = agents,
                isActive = isActive,
                modifier = Modifier.fillMaxSize(),
                labelTextScale = PAGE_SHRINK,
            )

            // PixelOffice always draws floor/time control chips bottom-right; iOS
            // hides them here via `showsControls: false` and core:design has no
            // such flag. Swallow taps over that corner instead — a tap-only
            // absorber doesn't consume drags, so pager swiping still works.
            Box(
                Modifier
                    .align(Alignment.BottomEnd)
                    .padding(4.dp)
                    .size(width = 190.dp, height = 44.dp)
                    .pointerInput(Unit) {
                        awaitEachGesture {
                            awaitFirstDown(requireUnconsumed = false)
                            waitForUpOrCancellation()?.consume()
                        }
                    },
            )

            Row(
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(12.dp)
                    .clip(CircleShape)
                    .background(Color.Black.copy(alpha = 0.42f))
                    .padding(horizontal = 10.dp, vertical = 7.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Box(Modifier.size(7.dp).background(AppColors.appPrimary, CircleShape))
                Text(
                    text = "LIVE AGENT HQ",
                    style = AppTypography.monoCaption.copy(fontSize = (10f * PAGE_SHRINK).sp),
                    fontWeight = FontWeight.Black,
                    color = Color.White,
                )
            }
        }
    }
}

// MARK: - Page 4: leaderboard

private data class Leader(
    val id: Int,
    val sprite: Int,
    val name: String,
    val sport: String,
    val record: String,
    val units: String,
    val winRate: String,
    val streak: Int,
)

private val Leaders = listOf(
    Leader(1, 2, "Sharp Signal", "NFL", "53–18", "+28.7u", "74.6%", 12),
    Leader(2, 6, "Fade Finder", "NBA", "46–19", "+23.1u", "70.8%", 10),
    Leader(3, 4, "Totals Lab", "MLB", "52–24", "+19.6u", "68.4%", 8),
    Leader(4, 1, "Line Hawk", "CFB", "48–24", "+16.2u", "66.7%", 6),
    Leader(5, 7, "Value Hunter", "NCAAB", "44–23", "+13.9u", "65.7%", 5),
)

@Composable
private fun LeaderboardHero(
    accent: Color,
    compact: Boolean,
    isActive: Boolean,
    reduceMotion: Boolean,
    modifier: Modifier = Modifier,
) {
    var selectingTopAgent by remember { mutableStateOf(false) }
    var showingTopAgentPicks by remember { mutableStateOf(false) }
    var winStampsVisible by remember { mutableStateOf(false) }

    LaunchedEffect(isActive, reduceMotion) {
        if (!isActive) {
            selectingTopAgent = false
            showingTopAgentPicks = false
            winStampsVisible = false
            return@LaunchedEffect
        }
        if (reduceMotion) {
            selectingTopAgent = true
            showingTopAgentPicks = true
            winStampsVisible = true
            return@LaunchedEffect
        }
        while (true) {
            selectingTopAgent = false
            showingTopAgentPicks = false
            winStampsVisible = false
            delay(1_250)
            selectingTopAgent = true
            delay(720)
            showingTopAgentPicks = true
            delay(520)
            winStampsVisible = true
            delay(3_400)
        }
    }

    BoxWithConstraints(modifier) {
        val tight = compact || maxWidth < 370.dp
        val shape = RoundedCornerShape(24.dp)
        // Single source of truth: the card's inset also feeds the ticket rail's
        // fit math below. If the two drift apart the rail overhangs the card and
        // the outer tickets get clipped by the card's own `clip(shape)`.
        val cardPadding = if (tight) 9.dp else 12.dp
        // Hoisted here: `maxWidth` belongs to this BoxWithConstraints scope and
        // is shadowed inside the nested Box where the rail is composed.
        val cardInteriorWidth = maxWidth - cardPadding * 2
        Column(
            modifier = Modifier
                .fillMaxSize()
                .clip(shape)
                .background(Color(0xFF121513), shape)
                .border(1.dp, Color.White.copy(alpha = 0.12f), shape)
                .padding(cardPadding),
            verticalArrangement = Arrangement.spacedBy(if (tight) 5.dp else 8.dp),
        ) {
            LeaderboardHeaderRow(selectingTopAgent, showingTopAgentPicks, accent, tight)
            LeaderRow(Leaders[0], rank = 1, tight = tight, accent = accent, highlighted = selectingTopAgent)

            Box(Modifier.fillMaxWidth().weight(1f)) {
                val runnersUpAlpha by animateFloatAsState(
                    if (selectingTopAgent) 0f else 1f,
                    tween(280),
                    label = "runners-up",
                )
                Column(
                    modifier = Modifier.fillMaxWidth().graphicsLayer { alpha = runnersUpAlpha },
                    verticalArrangement = Arrangement.spacedBy(if (tight) 5.dp else 8.dp),
                ) {
                    Leaders.drop(1).forEachIndexed { index, leader ->
                        LeaderRow(leader, rank = index + 2, tight = tight, accent = accent, highlighted = false)
                    }
                }
                MiniTicketRail(
                    accent = accent,
                    tight = tight,
                    visible = showingTopAgentPicks,
                    stamped = winStampsVisible,
                    availableWidth = cardInteriorWidth,
                    modifier = Modifier.align(Alignment.TopCenter),
                )
            }
        }
    }
}

@Composable
private fun LeaderboardHeaderRow(
    selecting: Boolean,
    showingPicks: Boolean,
    accent: Color,
    tight: Boolean,
) {
    val style = AppTypography.monoCaption.copy(fontSize = if (tight) 8.sp else 9.sp)
    Row(
        modifier = Modifier.fillMaxWidth().height(if (tight) 24.dp else 28.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (selecting) {
            Icon(
                imageVector = AppIcon.CHECKMARK_CIRCLE_FILL.imageVector,
                contentDescription = null,
                tint = accent,
                modifier = Modifier.size(if (tight) 10.dp else 12.dp),
            )
            Spacer(Modifier.width(4.dp))
            Text("TOP AGENT SELECTED", style = style, fontWeight = FontWeight.Black, color = accent)
            Spacer(Modifier.weight(1f))
            Text(
                text = if (showingPicks) "3 WON PICKS" else "OPENING CARD",
                style = style,
                fontWeight = FontWeight.Black,
                color = AppColors.appTextMuted,
            )
        } else {
            Text(
                text = "WIN %",
                style = style,
                fontWeight = FontWeight.Black,
                color = Color.Black,
                modifier = Modifier
                    .clip(CircleShape)
                    .background(accent)
                    .padding(horizontal = 10.dp, vertical = 5.dp),
            )
            Spacer(Modifier.width(6.dp))
            Text(
                text = "SEASON",
                style = style,
                fontWeight = FontWeight.Black,
                color = AppColors.appTextSecondary,
                modifier = Modifier
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.07f))
                    .padding(horizontal = 10.dp, vertical = 5.dp),
            )
            Spacer(Modifier.weight(1f))
        }
    }
}

@Composable
private fun LeaderRow(
    leader: Leader,
    rank: Int,
    tight: Boolean,
    accent: Color,
    highlighted: Boolean,
) {
    val isTop = rank == 1
    val rankColor = when (rank) {
        1 -> Color(0xFFFFD54A)
        2 -> Color(0xFFC7C7C7)
        else -> Color(0xFFCD8A4B)
    }
    val shape = RoundedCornerShape(14.dp)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(if (isTop) accent.copy(alpha = 0.10f) else AppColors.appBorder.copy(alpha = 0.24f), shape)
            .border(
                width = if (isTop && highlighted) 2.dp else 1.dp,
                color = if (isTop) {
                    accent.copy(alpha = if (highlighted) 0.95f else 0.55f)
                } else {
                    AppColors.appBorder.copy(alpha = 0.42f)
                },
                shape = shape,
            )
            .padding(horizontal = if (tight) 6.dp else 9.dp, vertical = if (tight) 5.dp else 7.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(if (tight) 5.dp else 9.dp),
    ) {
        Icon(
            imageVector = when (rank) {
                1 -> AppIcon.TROPHY_FILL.imageVector
                2 -> AppIcon.MEDAL_FILL.imageVector
                else -> AppIcon.MEDAL.imageVector
            },
            contentDescription = null,
            tint = rankColor,
            modifier = Modifier.size(if (tight) 13.dp else 17.dp),
        )
        PixelSpriteAvatar(
            spriteIndex = leader.sprite,
            animated = false,
            modifier = Modifier.size(width = if (tight) 23.dp else 30.dp, height = if (tight) 30.dp else 39.dp),
        )
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(
                text = leader.name,
                fontSize = if (tight) 10.5.sp else 13.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = leader.sport,
                style = AppTypography.monoCaption.copy(fontSize = if (tight) 7.5.sp else 9.sp),
                fontWeight = FontWeight.Black,
                color = AppColors.appTextMuted,
            )
        }
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(
                text = leader.record,
                style = AppTypography.monoCaption.copy(fontSize = if (tight) 9.sp else 11.sp),
                fontWeight = FontWeight.Bold,
                color = AppColors.appTextPrimary,
                maxLines = 1,
            )
            Text(
                text = leader.units,
                style = AppTypography.monoCaption.copy(fontSize = if (tight) 8.sp else 10.sp),
                fontWeight = FontWeight.Bold,
                color = AppColors.appPrimary,
                maxLines = 1,
            )
        }
        Text(
            text = leader.winRate,
            style = AppTypography.monoCaption.copy(fontSize = if (tight) 8.sp else 10.sp),
            fontWeight = FontWeight.Black,
            color = if (isTop) Color.Black else AppColors.appPrimary,
            maxLines = 1,
            modifier = Modifier
                .clip(CircleShape)
                .background(if (isTop) accent else accent.copy(alpha = 0.12f))
                .padding(horizontal = if (tight) 5.dp else 7.dp, vertical = 4.dp),
        )
        Row(
            modifier = Modifier
                .clip(CircleShape)
                .background(if (isTop) AppColors.appAccentAmber else AppColors.appAccentAmber.copy(alpha = 0.12f))
                .padding(horizontal = if (tight) 4.dp else 6.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            Icon(
                imageVector = AppIcon.FLAME_FILL.imageVector,
                contentDescription = null,
                tint = if (isTop) Color.Black else AppColors.appAccentAmber,
                modifier = Modifier.size(if (tight) 8.dp else 10.dp),
            )
            Text(
                text = "W${leader.streak}",
                style = AppTypography.monoCaption.copy(fontSize = if (tight) 7.5.sp else 9.5.sp),
                fontWeight = FontWeight.Black,
                color = if (isTop) Color.Black else AppColors.appAccentAmber,
                maxLines = 1,
            )
        }
    }
}

@Composable
private fun MiniTicketRail(
    accent: Color,
    tight: Boolean,
    visible: Boolean,
    stamped: Boolean,
    availableWidth: Dp,
    modifier: Modifier = Modifier,
) {
    val spacing = if (tight) 6.dp else 9.dp
    // Three tickets plus two gaps have to fit INSIDE the card. At the old fixed
    // 0.72 the rail measured ~402dp against a card interior nearer 350dp, so it
    // overhung both edges and `clip(shape)` cut the outer tickets off. Clamping
    // to the scale that actually fits keeps the padding even, and wide screens
    // still get the original size.
    val fittedScale = (availableWidth - spacing * 2) / 3 / MINI_TICKET_WIDTH
    val scale = (if (tight) 0.60f else 0.72f).coerceAtMost(fittedScale).coerceAtLeast(0.1f)
    val ticketWidth = MINI_TICKET_WIDTH * scale
    val ticketHeight = MINI_TICKET_HEIGHT * scale

    Row(
        modifier = modifier.padding(top = if (tight) 3.dp else 5.dp),
        horizontalArrangement = Arrangement.spacedBy(spacing),
    ) {
        PaywallTicketFixtures.topAgentPicks.forEachIndexed { index, pick ->
            val ticketAlpha by animateFloatAsState(
                targetValue = if (visible) 1f else 0f,
                animationSpec = tween(durationMillis = 320, delayMillis = index * 120),
                label = "ticket-alpha-$index",
            )
            val slide by animateFloatAsState(
                targetValue = if (visible) 0f else 72f + index * 22f,
                animationSpec = spring(dampingRatio = 0.80f, stiffness = Spring.StiffnessMediumLow),
                label = "ticket-slide-$index",
            )
            val stampScale by animateFloatAsState(
                targetValue = if (stamped) 1f else 0.45f,
                animationSpec = spring(dampingRatio = 0.60f, stiffness = Spring.StiffnessMedium),
                label = "stamp-$index",
            )
            Box(Modifier.size(ticketWidth, ticketHeight)) {
                Box(
                    Modifier.graphicsLayer {
                        scaleX = scale
                        scaleY = scale
                        transformOrigin = TransformOrigin(0f, 0f)
                        translationX = slide
                        alpha = ticketAlpha
                    },
                ) {
                    AgentPickMiniTicket(pick = pick, accent = accent)
                }
                Text(
                    text = "WON",
                    style = AppTypography.monoCaption.copy(fontSize = 9.sp),
                    fontWeight = FontWeight.Black,
                    color = Color.Black,
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .offset(x = (-6).dp, y = 6.dp)
                        .graphicsLayer {
                            scaleX = stampScale
                            scaleY = stampScale
                            alpha = if (stamped) 1f else 0f
                        }
                        .clip(CircleShape)
                        .background(accent)
                        .padding(horizontal = 7.dp, vertical = 3.dp),
                )
            }
        }
    }
}

// MARK: - Page 5: reasoned picks

/** Fixed footprint of `AgentPickMiniTicket` / `AgentParlayMiniTicket`. */
/**
 * Slides whose heroes were designed on a taller canvas render at 80% so they fit
 * without scrolling or clipping. Applied per-slide, not globally — the pages that
 * already fit are left alone.
 */
private const val PAGE_SHRINK = 0.8f

/**
 * Render [content] at [factor] of normal size. Overriding density scales every
 * `dp` AND `sp` inside together AND re-measures layout at the smaller size, so
 * the slide genuinely occupies less room instead of just drawing smaller the way
 * a `graphicsLayer` scale would. `fontScale` is passed through untouched so the
 * user's own text-size accessibility setting still applies on top.
 */
@Composable
private fun ScaledDown(factor: Float, content: @Composable () -> Unit) {
    val base = LocalDensity.current
    CompositionLocalProvider(
        LocalDensity provides Density(base.density * factor, base.fontScale),
        content = content,
    )
}

private val MINI_TICKET_WIDTH = 178.dp
private val MINI_TICKET_HEIGHT = 240.dp

@Composable
private fun ReasonedPicksHero(
    accent: Color,
    compact: Boolean,
    isActive: Boolean,
    reduceMotion: Boolean,
    modifier: Modifier = Modifier,
) {
    var revealStraight by remember { mutableStateOf(false) }
    var revealParlay by remember { mutableStateOf(false) }

    LaunchedEffect(isActive, reduceMotion) {
        if (!isActive) {
            revealStraight = false
            revealParlay = false
            return@LaunchedEffect
        }
        revealStraight = true
        if (!reduceMotion) delay(170)
        revealParlay = true
    }

    // × PAGE_SHRINK: the two tickets are the whole slide, so shrinking their own
    // scale knob shrinks "everything" here — no density override needed.
    val scale = (if (compact) 0.94f else 1.10f) * PAGE_SHRINK

    BoxWithConstraints(
        modifier.clearAndSetSemantics {
            contentDescription = "Two agent pick tickets. A four-leg Buffalo parlay at plus 2300 odds with four " +
                "of five confidence, and Ravens plus three and a half at minus 110. Both include the agent's reasoning."
        },
    ) {
        val width = maxWidth
        val height = maxHeight

        // These are the exact mini boarding passes from the live Today's Picks
        // rail — not a paywall recreation. The straight ticket sits behind.
        RevealedTicket(
            revealed = revealStraight,
            animated = !reduceMotion,
            scale = scale,
            rotation = -2.2f,
            centerX = width * 0.32f,
            centerY = height * 0.58f,
            slideFrom = 44f,
        ) {
            AgentPickMiniTicket(pick = PaywallTicketFixtures.straight, accent = accent)
        }
        RevealedTicket(
            revealed = revealParlay,
            animated = !reduceMotion,
            scale = scale,
            rotation = 1.6f,
            centerX = width * 0.68f,
            centerY = height * 0.42f,
            slideFrom = 52f,
        ) {
            AgentParlayMiniTicket(parlay = PaywallTicketFixtures.parlay, accent = accent)
        }
    }
}

@Composable
private fun RevealedTicket(
    revealed: Boolean,
    animated: Boolean,
    scale: Float,
    rotation: Float,
    centerX: Dp,
    centerY: Dp,
    slideFrom: Float,
    content: @Composable () -> Unit,
) {
    val target = if (revealed) 1f else 0f
    val fade by animateFloatAsState(target, tween(if (animated) 300 else 0), label = "ticket-fade")
    val slide by animateFloatAsState(
        targetValue = if (revealed) 0f else slideFrom,
        animationSpec = if (animated) {
            spring(dampingRatio = 0.82f, stiffness = Spring.StiffnessMediumLow)
        } else {
            tween(0)
        },
        label = "ticket-slide",
    )
    Box(
        modifier = Modifier
            .offset(
                x = centerX - MINI_TICKET_WIDTH * scale / 2,
                y = centerY - MINI_TICKET_HEIGHT * scale / 2,
            )
            .size(MINI_TICKET_WIDTH * scale, MINI_TICKET_HEIGHT * scale)
            .graphicsLayer {
                alpha = fade
                translationY = slide
            }
            .rotate(rotation),
    ) {
        Box(
            Modifier.graphicsLayer {
                scaleX = scale
                scaleY = scale
                transformOrigin = TransformOrigin(0f, 0f)
            },
        ) {
            content()
        }
    }
}

/**
 * Stable, local-only fixtures for the real ticket components above. Keeping the
 * fixture at the MODEL boundary means the production ticket UI stays the single
 * source of truth for geometry, typography, and content hierarchy.
 */
private object PaywallTicketFixtures {
    private const val PARLAY_ID = "paywall-ticket-parlay"
    private const val GAME_DATE = "2026-09-13"
    private const val CREATED_AT = "2026-07-17T15:00:00Z"

    private fun leg(
        id: String,
        selection: String,
        odds: String,
        betType: String,
        player: String? = null,
        market: String? = null,
        line: Double? = null,
    ) = AgentParlayLeg(
        id = id,
        parlayId = PARLAY_ID,
        gameId = "paywall-buf-kc",
        sport = AgentSport.NFL,
        matchup = "Buffalo Bills @ Kansas City Chiefs",
        gameDate = GAME_DATE,
        betType = betType,
        period = "full",
        pickSelection = selection,
        odds = odds,
        propPlayer = player,
        propMarket = market,
        propLine = line,
        legResult = AgentPick.PickResultStatus.PENDING,
        createdAt = CREATED_AT,
    )

    val parlay: AgentParlay = run {
        val legs = listOf(
            leg("paywall-leg-bills", "Bills ML", "+105", "moneyline"),
            leg("paywall-leg-allen", "Josh Allen 3+ Pass TDs", "+165", "prop", "Josh Allen", "Passing Touchdowns", 2.5),
            leg("paywall-leg-cook", "James Cook Anytime TD", "+110", "prop", "James Cook", "Anytime Touchdown", 0.5),
            leg("paywall-leg-shakir", "Khalil Shakir 50+ Rec Yds", "+110", "prop", "Khalil Shakir", "Receiving Yards", 49.5),
        )
        AgentParlay(
            id = PARLAY_ID,
            avatarId = "paywall-agent",
            sport = AgentParlaySport.NFL,
            legsCount = legs.size,
            combinedOdds = "+2300",
            units = 0.5,
            confidence = 4,
            reasoningText = "• Correlated pass volume\n• All legs clear model value",
            keyFactors = listOf(
                "Every leg clears the model's value threshold",
                "Projected game script keeps volume concentrated in Buffalo",
            ),
            result = AgentPick.PickResultStatus.PENDING,
            targetDate = GAME_DATE,
            scope = AgentParlayScope.DAILY,
            createdAt = CREATED_AT,
            legs = legs,
        )
    }

    val straight = AgentPick(
        id = "paywall-ticket-straight",
        avatarId = "paywall-agent",
        gameId = "paywall-bal-cin",
        sport = AgentSport.NFL,
        matchup = "Baltimore Ravens @ Cincinnati Bengals",
        gameDate = GAME_DATE,
        betType = "spread",
        pickSelection = "Ravens +3.5",
        odds = "-110",
        units = 1.0,
        confidence = 4,
        reasoningText = "• Model line: Ravens +1.2\n• Baltimore has the rest edge",
        keyFactors = listOf(
            "Model spread: Ravens +1.2",
            "Market is 2.3 points wider",
            "Rest advantage favors Baltimore",
        ),
        result = AgentPick.PickResultStatus.PENDING,
        createdAt = CREATED_AT,
    )

    private fun wonPick(
        id: String,
        matchup: String,
        betType: String,
        selection: String,
        odds: String,
        confidence: Int,
        reasoning: String,
    ) = AgentPick(
        id = id,
        avatarId = "paywall-sharp-signal",
        gameId = "paywall-$id",
        sport = AgentSport.NFL,
        matchup = matchup,
        gameDate = "2026-10-11",
        betType = betType,
        pickSelection = selection,
        odds = odds,
        units = 1.0,
        confidence = confidence,
        reasoningText = reasoning,
        keyFactors = listOf("Model edge cleared", "Market held through close"),
        result = AgentPick.PickResultStatus.WON,
        gradedAt = "2026-10-12T04:00:00Z",
        createdAt = "2026-10-11T14:00:00Z",
    )

    val topAgentPicks = listOf(
        wonPick(
            "leader-bills-ml", "Buffalo Bills @ Kansas City Chiefs", "moneyline", "Bills ML", "+105", 5,
            "Rest edge plus the stronger late-down profile.",
        ),
        wonPick(
            "leader-ravens-spread", "Baltimore Ravens @ Cincinnati Bengals", "spread", "Ravens +3.5", "-110", 4,
            "The model closed 2.1 points inside the market.",
        ),
        wonPick(
            "leader-cowboys-total", "Dallas Cowboys @ Philadelphia Eagles", "total", "Over 47.5", "-105", 4,
            "Both offenses ranked top five in early-down EPA.",
        ),
    )
}

// MARK: - Page 6: outliers marquee

private data class MarqueeItem(
    val id: String,
    val sport: OutliersTrendsSport,
    val card: OutliersTrendsCard,
)

private fun trendCard(
    id: String,
    matchup: String,
    subject: String,
    detail: String? = null,
    team: String,
    subjectKind: OutliersTrendsSubjectKind = OutliersTrendsSubjectKind.TEAM,
    market: String,
    label: String,
    headshotUrl: String? = null,
    rows: List<Triple<String, Double, Int>>,
) = OutliersTrendsCard(
    id = id,
    gameId = "paywall-$id",
    matchupLabel = matchup,
    subjectKind = subjectKind,
    subjectName = subject,
    subjectDetail = detail,
    teamAbbr = team,
    playerId = if (subjectKind == OutliersTrendsSubjectKind.PLAYER) "paywall-$id-player" else null,
    marketKey = market,
    betTypeLabel = label,
    trendValue = rows.firstOrNull()?.second ?: 0.80,
    trendSampleN = rows.firstOrNull()?.third ?: 5,
    lineContext = null,
    headshotUrl = headshotUrl,
    rows = rows.mapIndexed { index, row ->
        OutliersTrendsCardRow(
            id = "$id-r$index",
            text = row.first,
            coverageNote = null,
            dominantPct = row.second,
            sampleN = row.third,
        )
    },
)

private val OutliersLaneOne = listOf(
    MarqueeItem(
        "yankees-ml", OutliersTrendsSport.MLB,
        trendCard(
            id = "yankees-moneyline", matchup = "BOS @ NYY", subject = "Yankees", team = "NYY",
            market = "moneyline", label = "Moneyline",
            rows = listOf(
                Triple("At home", 1.0, 5),
                Triple("Vs right-handed starters", 1.0, 12),
                Triple("In series openers", 0.90, 10),
            ),
        ),
    ),
    MarqueeItem(
        "chiefs-spread", OutliersTrendsSport.NFL,
        trendCard(
            id = "chiefs-spread", matchup = "BUF @ KC", subject = "Chiefs", team = "KC",
            market = "spread", label = "Spread",
            rows = listOf(
                Triple("In primetime games", 1.0, 6),
                Triple("At home", 1.0, 9),
                Triple("Vs Buffalo", 0.90, 10),
            ),
        ),
    ),
    MarqueeItem(
        "dodgers-runline", OutliersTrendsSport.MLB,
        trendCard(
            id = "dodgers-run-line", matchup = "SF @ LAD", subject = "Dodgers", team = "LAD",
            market = "run_line", label = "Run Line",
            rows = listOf(
                Triple("-1.5 in wins", 1.0, 7),
                Triple("In home starts", 1.0, 10),
                Triple("By 2+ runs vs SF", 0.90, 10),
            ),
        ),
    ),
    MarqueeItem(
        "allen-pass", OutliersTrendsSport.NFL,
        trendCard(
            id = "allen-passing-yards", matchup = "BUF @ KC", subject = "Josh Allen",
            team = "BUF", subjectKind = OutliersTrendsSubjectKind.PLAYER,
            market = "passing_yards", label = "Passing Yards",
            // Fixture player id can't resolve a headshot, so pin Allen's ESPN photo.
            headshotUrl = "https://a.espncdn.com/i/headshots/nfl/players/full/3918298.png",
            rows = listOf(
                Triple("In road games", 1.0, 5),
                Triple("As an underdog", 1.0, 12),
                Triple("Vs Kansas City", 0.90, 10),
            ),
        ),
    ),
)

private val OutliersLaneTwo = listOf(
    MarqueeItem(
        "cowboys-total", OutliersTrendsSport.NFL,
        trendCard(
            id = "cowboys-total", matchup = "PHI @ DAL", subject = "Cowboys", team = "DAL",
            market = "total", label = "Game Total",
            rows = listOf(
                Triple("Over at home", 1.0, 5),
                Triple("Over in division games", 1.0, 10),
                Triple("Over in primetime", 0.90, 10),
            ),
        ),
    ),
    MarqueeItem(
        "orioles-total", OutliersTrendsSport.MLB,
        trendCard(
            id = "orioles-total", matchup = "TB @ BAL", subject = "Orioles", team = "BAL",
            market = "total", label = "Game Total",
            rows = listOf(
                Triple("Over in day games", 1.0, 5),
                Triple("Over vs lefty starters", 1.0, 8),
                Triple("Over at home", 0.917, 12),
            ),
        ),
    ),
    MarqueeItem(
        "bills-ml", OutliersTrendsSport.NFL,
        trendCard(
            id = "bills-moneyline", matchup = "BUF @ MIA", subject = "Bills", team = "BUF",
            market = "moneyline", label = "Moneyline",
            rows = listOf(
                Triple("After a loss", 1.0, 5),
                Triple("In division road games", 1.0, 12),
                Triple("As road favorites", 0.90, 10),
            ),
        ),
    ),
    MarqueeItem(
        "phillies-team-total", OutliersTrendsSport.MLB,
        trendCard(
            id = "phillies-team-total", matchup = "ATL @ PHI", subject = "Phillies", team = "PHI",
            market = "team_total", label = "Team Total",
            rows = listOf(
                Triple("At home", 1.0, 5),
                Triple("Vs Atlanta", 1.0, 9),
                Triple("5+ runs in night games", 0.917, 12),
            ),
        ),
    ),
)

@Composable
private fun OutliersHero(
    compact: Boolean,
    isActive: Boolean,
    reduceMotion: Boolean,
    modifier: Modifier = Modifier,
) {
    var marqueeIndex by remember { mutableIntStateOf(0) }

    LaunchedEffect(isActive, reduceMotion) {
        if (!isActive || reduceMotion) {
            marqueeIndex = 0
            return@LaunchedEffect
        }
        while (true) {
            delay(2_000)
            marqueeIndex += 1
        }
    }

    BoxWithConstraints(modifier) {
        val peek = if (compact) 16.dp else 22.dp
        val laneSpacing = if (compact) 7.dp else 8.dp
        val cardWidth = maxOf(if (compact) 210.dp else 240.dp, maxWidth - (peek + laneSpacing) * 2)
        val laneHeight = 132.dp

        Column(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(6.dp, Alignment.Bottom),
        ) {
            MarqueeLane(OutliersLaneOne, marqueeIndex, 1, cardWidth, laneSpacing, laneHeight)
            MarqueeLane(OutliersLaneTwo, marqueeIndex, -1, cardWidth, laneSpacing, laneHeight)
        }
    }
}

/**
 * Three visible cards keyed by card id: the centered one animates to offset 0
 * while its neighbours sit a full step out and dimmed. `direction` flips travel
 * so the two lanes drift opposite ways.
 *
 * The `key()` wrapper is load-bearing — without it the animation state would be
 * bound to the SLOT (prev/next/current) rather than the card, so every rotation
 * would teleport content instead of sliding it.
 */
@Composable
private fun MarqueeLane(
    items: List<MarqueeItem>,
    marqueeIndex: Int,
    direction: Int,
    cardWidth: Dp,
    spacing: Dp,
    laneHeight: Dp,
) {
    val n = items.size
    val step = cardWidth + spacing
    val base = ((direction * marqueeIndex) % n + n) % n
    val slots = listOf(
        items[(base - 1 + n) % n] to -1,
        items[(base + 1) % n] to 1,
        items[base] to 0,
    )

    Box(
        modifier = Modifier.fillMaxWidth().height(laneHeight).clip(RoundedCornerShape(16.dp)),
        contentAlignment = Alignment.Center,
    ) {
        slots.forEach { (item, slot) ->
            key(item.id) {
                val offsetX by animateDpAsState(
                    targetValue = step * slot,
                    animationSpec = spring(dampingRatio = 0.84f, stiffness = Spring.StiffnessMediumLow),
                    label = "marquee-offset",
                )
                val cardAlpha by animateFloatAsState(
                    targetValue = if (slot == 0) 1f else 0.5f,
                    animationSpec = tween(320),
                    label = "marquee-alpha",
                )
                Box(
                    Modifier
                        .offset(x = offsetX)
                        .width(cardWidth)
                        .height(laneHeight)
                        .graphicsLayer { alpha = cardAlpha }
                        .clip(RoundedCornerShape(16.dp)),
                ) {
                    OutliersTrendCard(
                        card = item.card,
                        sport = item.sport,
                        displayMode = OutliersTrendCardMode.Expanded,
                        marqueeStyle = true,
                    )
                }
            }
        }
    }
}

// MARK: - Page 7: community + AI connectors

@Composable
private fun CommunityConnectorsHero(compact: Boolean, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(if (compact) 7.dp else 10.dp, Alignment.CenterVertically),
    ) {
        DiscordIncludedBanner(compact)
        // Reuse the exact Settings connector banner so this entitlement looks
        // identical before and after purchase. Display-only here (no onClick).
        AIConnectorBanner(compact = compact)
    }
}

@Composable
private fun DiscordIncludedBanner(compact: Boolean) {
    val shape = RoundedCornerShape(23.dp)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(if (compact) 60.dp else 68.dp)
            .clip(shape)
            .background(Brush.horizontalGradient(listOf(Color(0xFF5C66F2), Color(0xFF9EA8FF))))
            .border(1.dp, Color.White.copy(alpha = 0.14f), shape)
            .padding(horizontal = 14.dp)
            .clearAndSetSemantics {
                contentDescription = "Private WagerProof Discord included with Pro"
            },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = AppIcon.BUBBLE_LEFT_AND_BUBBLE_RIGHT_FILL.imageVector,
            contentDescription = null,
            tint = Color.White.copy(alpha = 0.9f),
            modifier = Modifier.size(22.dp),
        )
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = "Join our Discord",
                style = AppTypography.display.copy(fontSize = if (compact) 16.sp else 18.sp),
                color = Color.White,
                maxLines = 1,
            )
            Text(
                text = "Picks, updates, and live chat",
                style = AppTypography.caption,
                color = Color.White.copy(alpha = 0.9f),
                maxLines = 1,
            )
        }
        Text(
            text = "Included",
            style = AppTypography.captionEmphasized,
            color = Color.White,
            modifier = Modifier
                .clip(CircleShape)
                .background(Color.White.copy(alpha = 0.22f))
                .padding(horizontal = 12.dp, vertical = 6.dp),
        )
    }
}
